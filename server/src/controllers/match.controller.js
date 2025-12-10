// server/src/controllers/match.controller.js
import MatchRoom from "../models/MatchRoom.js";
import MatchRequest from "../models/MatchRequest.js";
import { User } from "../models/User.js";
import { responseOk } from "../utils/response.js";

// ===== Helpers =====

async function findActiveRoomOfUser(userId) {
  return MatchRoom.findOne({
    "members.user": userId,
    status: { $in: ["active", "full"] },
  });
}

// Map goal key -> label fallback (nếu chưa có connectGoalLabel)
const GOAL_LABELS = {
  giam_can: "Giảm cân",
  duy_tri: "Duy trì",
  tang_can: "Tăng cân",
  giam_mo: "Giảm mỡ",
  tang_co: "Tăng cơ",
};

const INTENSITY_LABELS = {
  level_1: "Không tập luyện, ít vận động",
  level_2: "Vận động nhẹ nhàng",
  level_3: "Chăm chỉ tập luyện",
  level_4: "Rất năng động",
};

function goalLabelFromKey(key) {
  if (!key) return null;
  return GOAL_LABELS[key] || null;
}

function intensityLabelFromKey(key) {
  if (!key) return null;
  return INTENSITY_LABELS[key] || null;
}

function calcAge(dobValue) {
  if (!dobValue) return null;
  const d = new Date(dobValue);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function hasAddress(profile) {
  const addr = profile?.address;
  if (!addr) return false;
  const { city, district, ward, country } = addr;
  return !!(city || district || ward || country);
}

function buildLocationLabel(profile, storedLabel) {
  if (storedLabel) return storedLabel;
  const addr = profile?.address;
  if (!addr) return "";
  const { district, city, country } = addr;
  if (district && city) return `${district}, ${city}`;
  if (city && country) return `${city}, ${country}`;
  return district || city || country || "";
}

function buildAreaInfo(meProfile, otherProfile) {
  if (!meProfile || !otherProfile) {
    return { areaKey: null, areaLabel: "" };
  }

  const a = meProfile.address || {};
  const b = otherProfile.address || {};

  const norm = (v) => (v || "").toString().trim().toLowerCase();

  const cityA = norm(a.city);
  const cityB = norm(b.city);
  const districtA = norm(a.district);
  const districtB = norm(b.district);
  const wardA = norm(a.ward);
  const wardB = norm(b.ward);

  // Không có thông tin địa chỉ → không tính khu vực
  if (!cityA || !cityB) {
    return { areaKey: null, areaLabel: "" };
  }

  if (cityA === cityB) {
    if (districtA && districtB && districtA === districtB) {
      if (wardA && wardB && wardA === wardB) {
        return { areaKey: "same_ward", areaLabel: "Rất gần bạn" }; // cùng phường
      }
      return {
        areaKey: "same_district",
        areaLabel: "Trong quận của bạn", // cùng quận
      };
    }
    return {
      areaKey: "same_city",
      areaLabel: "Cùng thành phố",
    };
  }

  return { areaKey: "other", areaLabel: "Ngoài khu vực" };
}


function buildNearbyUserCard(user, meProfile) {
  const profile = user.profile || {};
  const nickname =
    profile.nickname || user.username || "Người dùng FitMatch";

  const age = profile.dob ? calcAge(profile.dob) : null;
  const gender = profile.sex || null;

  const goalKey = user.connectGoalKey || profile.goal || null;
  const goalLabel =
    user.connectGoalLabel || goalLabelFromKey(goalKey) || null;

  const trainingTypes = Array.isArray(user.connectTrainingTypes)
    ? user.connectTrainingTypes
    : [];

  const frequency = user.connectTrainingFrequencyLabel || "";

  // INTENSITY giống BodyProfile (ưu tiên key trong profile)
  const intensityKey = profile.trainingIntensity || null;
  const intensityLabel = intensityLabelFromKey(intensityKey) || null;

  const locationLabel = buildLocationLabel(
    profile,
    user.connectLocationLabel
  );

  const bio = user.connectBio || "";
  const imageUrl = profile.avatarUrl || null;

  // 🔹 Tính khu vực so với chủ tài khoản
  const { areaKey, areaLabel } = buildAreaInfo(meProfile, profile);

  return {
    id: user._id,
    isGroup: false,
    nickname,
    age,
    gender,
    // distanceKm: null, // bỏ luôn, không dùng nữa
    goal: goalLabel,
    goalKey,
    trainingTypes,
    frequency,
    intensityKey,
    intensityLabel,
    locationLabel,
    bio,
    imageUrl,
    areaKey,   // "same_ward" | "same_district" | "same_city" | "other" | null
    areaLabel, // Text hiển thị: "Rất gần bạn"...
  };
}


function buildNearbyGroupCard(room) {
  const membersCount = room.members?.length || 0;
  return {
    id: room._id,
    nickname: room.name || "Nhóm tập luyện",
    isGroup: true,
    membersCount,
    gender: "mixed",
    // distanceKm: null,
    goal: room.goalKey || null,
    goalKey: room.goalKey || null,
    trainingTypes: room.trainingTypes || [],
    frequency: room.scheduleText || "",
    locationLabel: room.locationLabel || "",
    bio: room.description || "",
    imageUrl: room.coverImageUrl || null,
    areaKey: null,
    areaLabel: "",
  };
}

function getUserIdFromReq(req) {
  return req.userId || req.user?._id || null;
}

// ===== API =====

// GET /api/match/status
export async function getMatchStatus(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }

    const [me, room, incomingCount, outgoingCount] = await Promise.all([
      User.findById(userId)
        .select("connectDiscoverable hasAddressForConnect profile")
        .lean(),
      findActiveRoomOfUser(userId),
      MatchRequest.countDocuments({
        toUser: userId,
        status: "pending",
        type: "duo",
      }),
      MatchRequest.countDocuments({
        fromUser: userId,
        status: "pending",
      }),
    ]);

    if (!me) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    const hasAddr =
      me.hasAddressForConnect || hasAddress(me.profile || {});

    const pendingTotal = incomingCount + outgoingCount;

    return responseOk(res, {
      discoverable: !!me.connectDiscoverable,
      hasAddressForConnect: !!hasAddr,
      activeRoomId: room ? room._id : null,
      activeRoomType: room ? room.type : null,
      pendingRequestsCount: pendingTotal,
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/match/discoverable
export async function updateDiscoverable(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }
    const { discoverable } = req.body || {};

    const user = await User.findById(userId).select(
      "connectDiscoverable hasAddressForConnect profile"
    );
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    const hasAddr =
      user.hasAddressForConnect || hasAddress(user.profile || {});

    if (discoverable && !hasAddr) {
      return res.status(400).json({
        ok: false,
        error: "need_address",
        message:
          "Bạn cần cập nhật địa chỉ trong hồ sơ trước khi bật cho phép tìm kiếm.",
      });
    }

    user.connectDiscoverable = !!discoverable;
    if (!user.hasAddressForConnect && hasAddr) {
      user.hasAddressForConnect = true;
    }

    await user.save();

    return responseOk(res, {
      discoverable: user.connectDiscoverable,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/match/nearby?mode=one_to_one|group
export async function listNearby(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }

    const { mode = "one_to_one" } = req.query || {};

    const me = await User.findById(userId).lean();
    if (!me) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    let users = [];
    let groups = [];

    if (mode === "one_to_one") {
      users = await User.find({
        _id: { $ne: userId },
        role: "user",
        connectDiscoverable: true,
      })
        .limit(100)
        .lean();
    } else if (mode === "group") {
      groups = await MatchRoom.find({
        type: "group",
        status: { $in: ["active"] },
        $expr: { $lt: [{ $size: "$members" }, "$maxMembers"] }, // còn slot
      })
        .limit(50)
        .lean();
    }

    const userCards =
      mode === "one_to_one"
        ? users.map((u) => buildNearbyUserCard(u, me.profile))
        : [];

    const groupCards =
      mode === "group" ? groups.map(buildNearbyGroupCard) : [];

    // Pinned card của chính chủ nếu discoverable
    let selfCard = null;
    if (me.connectDiscoverable) {
      selfCard = buildNearbyUserCard(me, me.profile);
      selfCard.areaKey = "home";
      selfCard.areaLabel = "Nhà";
    }

    return responseOk(res, {
      self: selfCard,
      items: mode === "one_to_one" ? userCards : groupCards,
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/match/requests (gửi lời mời)
export async function createMatchRequest(req, res, next) {
  try {
    const fromUserId = getUserIdFromReq(req);
    if (!fromUserId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }

    const { type, targetUserId, targetRoomId, message } = req.body || {};

    if (!["duo", "group"].includes(type)) {
      return res.status(400).json({
        ok: false,
        error: "invalid_type",
      });
    }

    // Check đang ở room khác?
    const activeRoom = await findActiveRoomOfUser(fromUserId);
    if (activeRoom) {
      return res.status(409).json({
        ok: false,
        error: "user_already_in_room",
        message:
          "Bạn đã tham gia một phòng kết nối khác, hãy rời phòng trước khi gửi lời mời mới.",
      });
    }

    const fromUser = await User.findById(fromUserId).lean();
    if (!fromUser) {
      return res
        .status(404)
        .json({ ok: false, error: "from_user_not_found" });
    }

    const fromNickname =
      fromUser.profile?.nickname || fromUser.username || "";
    const fromGoalKey =
      fromUser.connectGoalKey || fromUser.profile?.goal || null;
    const fromGoalLabel =
      fromUser.connectGoalLabel || goalLabelFromKey(fromGoalKey) || "";

    if (type === "duo") {
      if (!targetUserId) {
        return res.status(400).json({
          ok: false,
          error: "missing_target_user",
        });
      }
      if (String(targetUserId) === String(fromUserId)) {
        return res.status(400).json({
          ok: false,
          error: "cannot_invite_self",
        });
      }

      const targetUser = await User.findById(targetUserId).lean();
      if (!targetUser) {
        return res.status(404).json({
          ok: false,
          error: "user_not_found",
        });
      }
      if (!targetUser.connectDiscoverable) {
        return res.status(400).json({
          ok: false,
          error: "target_not_discoverable",
          message: "Người dùng hiện không cho phép tìm kiếm.",
        });
      }

      const doc = await MatchRequest.create({
        type: "duo",
        fromUser: fromUserId,
        toUser: targetUserId,
        message: message || "",
        meta: {
          fromNickname,
          fromGoalKey,
          fromGoalLabel,
        },
      });

      return responseOk(res, { request: doc });
    }

    // type === "group"
    if (!targetRoomId) {
      return res.status(400).json({
        ok: false,
        error: "missing_target_room",
      });
    }

    const room = await MatchRoom.findById(targetRoomId).lean();
    if (!room || room.type !== "group") {
      return res.status(404).json({
        ok: false,
        error: "room_not_found",
      });
    }

    const currentCount = room.members?.length || 0;
    if (currentCount >= (room.maxMembers || 5)) {
      return res.status(409).json({
        ok: false,
        error: "group_full",
        message: "Nhóm đã đủ người.",
      });
    }

    const doc = await MatchRequest.create({
      type: "group",
      fromUser: fromUserId,
      toRoom: room._id,
      message: message || "",
      meta: {
        fromNickname,
        fromGoalKey,
        fromGoalLabel,
      },
    });

    return responseOk(res, { request: doc });
  } catch (err) {
    next(err);
  }
}

// GET /api/match/requests
export async function listMyRequests(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }

    const [incoming, outgoing] = await Promise.all([
      MatchRequest.find({
        toUser: userId,
        status: "pending",
        type: "duo",
      })
        .populate({
          path: "fromUser",
          select:
            "username profile.nickname profile.avatarUrl connectGoalKey connectGoalLabel",
        })
        .lean(),
      MatchRequest.find({
        fromUser: userId,
        status: "pending",
      })
        .populate({
          path: "toUser",
          select:
            "username profile.nickname profile.avatarUrl connectGoalKey connectGoalLabel",
        })
        .populate({
          path: "toRoom",
          select:
            "name coverImageUrl type members maxMembers status locationLabel",
        })
        .lean(),
    ]);

    return responseOk(res, {
      incoming,
      outgoing,
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/match/requests/:id/accept
export async function acceptRequest(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }
    const { id } = req.params;

    const reqDoc = await MatchRequest.findById(id)
      .populate("fromUser")
      .populate("toUser")
      .populate("toRoom")
      .exec();

    if (!reqDoc || reqDoc.status !== "pending") {
      return res.status(404).json({
        ok: false,
        error: "request_not_found",
      });
    }

    // Kiểm tra quyền accept:
    if (reqDoc.type === "duo") {
      if (String(reqDoc.toUser._id) !== String(userId)) {
        return res.status(403).json({
          ok: false,
          error: "not_allowed",
        });
      }
    } else if (reqDoc.type === "group") {
      // Sau này nếu cần check owner group thì bổ sung
    }

    // Check hai bên đã ở room nào chưa
    const [roomOfFrom, roomOfTo] = await Promise.all([
      findActiveRoomOfUser(reqDoc.fromUser._id),
      reqDoc.type === "duo"
        ? findActiveRoomOfUser(reqDoc.toUser._id)
        : null,
    ]);

    if (roomOfFrom || roomOfTo) {
      reqDoc.status = "rejected";
      reqDoc.resolvedAt = new Date();
      await reqDoc.save();

      return res.status(409).json({
        ok: false,
        error: "user_already_in_room",
        message:
          "Một trong hai người đã tham gia phòng kết nối khác. Lời mời này đã hết hiệu lực.",
      });
    }

    let room;
    if (reqDoc.type === "duo") {
      // tạo room mới 1:1
      room = await MatchRoom.create({
        type: "duo",
        createdBy: reqDoc.fromUser._id,
        members: [
          { user: reqDoc.fromUser._id, role: "owner" },
          { user: reqDoc.toUser._id, role: "member" },
        ],
        maxMembers: 2,
      });
    } else if (reqDoc.type === "group") {
      // Thêm user vào room group sẵn có
      room = await MatchRoom.findById(reqDoc.toRoom._id);
      if (!room || room.type !== "group") {
        return res.status(404).json({
          ok: false,
          error: "room_not_found",
        });
      }

      const currentCount = room.members?.length || 0;
      if (currentCount >= (room.maxMembers || 5)) {
        reqDoc.status = "rejected";
        reqDoc.resolvedAt = new Date();
        await reqDoc.save();

        return res.status(409).json({
          ok: false,
          error: "group_full",
          message: "Nhóm đã đủ người.",
        });
      }

      room.members.push({ user: reqDoc.fromUser._id, role: "member" });
      if (room.members.length >= room.maxMembers) {
        room.status = "full";
        room.closedAt = new Date();
      }
      await room.save();
    }

    reqDoc.status = "accepted";
    reqDoc.resolvedAt = new Date();
    await reqDoc.save();

    return responseOk(res, { roomId: room._id, roomType: room.type });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/match/requests/:id/reject
export async function rejectRequest(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }
    const { id } = req.params;

    const reqDoc = await MatchRequest.findById(id);
    if (!reqDoc || reqDoc.status !== "pending") {
      return res.status(404).json({
        ok: false,
        error: "request_not_found",
      });
    }

    if (reqDoc.type === "duo") {
      if (String(reqDoc.toUser) !== String(userId)) {
        return res.status(403).json({
          ok: false,
          error: "not_allowed",
        });
      }
    } else if (reqDoc.type === "group") {
      // Nếu cần giới hạn ai được reject (owner group) thì thêm logic
    }

    reqDoc.status = "rejected";
    reqDoc.resolvedAt = new Date();
    await reqDoc.save();

    return responseOk(res, {
      requestId: reqDoc._id,
      status: reqDoc.status,
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/match/requests/:id/cancel (hủy lời mời mình đã gửi)
export async function cancelRequest(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }
    const { id } = req.params;

    const reqDoc = await MatchRequest.findById(id);
    if (!reqDoc || reqDoc.status !== "pending") {
      return res.status(404).json({
        ok: false,
        error: "request_not_found",
      });
    }

    if (String(reqDoc.fromUser) !== String(userId)) {
      return res.status(403).json({
        ok: false,
        error: "not_allowed",
      });
    }

    reqDoc.status = "cancelled";
    reqDoc.resolvedAt = new Date();
    await reqDoc.save();

    return responseOk(res, {
      requestId: reqDoc._id,
      status: reqDoc.status,
    });
  } catch (err) {
    next(err);
  }
}
