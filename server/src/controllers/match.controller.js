// server/src/controllers/match.controller.js
import MatchRoom from "../models/MatchRoom.js";
import MatchRequest from "../models/MatchRequest.js";
import { User } from "../models/User.js";
import { responseOk } from "../utils/response.js";
import { uploadImageWithResize } from "../utils/cloudinary.js";
import NutritionLog from "../models/NutritionLog.js";
import dayjs from "dayjs";
import ConnectReport from "../models/ConnectReport.js";
import { createNotification } from "../utils/notify.js";

async function notifySafe(payload) {
  try {
    await createNotification(payload);
  } catch (e) {
    /* không cho notify làm hỏng luồng chính */
  }
}

// ===== NOTI HELPERS =====
const pickName = (u) =>
  u?.profile?.nickname || u?.username || u?.email || "Người dùng FitMatch";

async function getUserNameById(uid) {
  try {
    const u = await User.findById(uid)
      .select("username email profile.nickname")
      .lean();
    return pickName(u);
  } catch {
    return "Người dùng FitMatch";
  }
}

function roomMemberIds(room) {
  return (room?.members || [])
    .map((m) => String(m?.user?._id || m?.user || ""))
    .filter(Boolean);
}

// ===== Helpers =====
async function findActiveRoomOfUser(userId) {
  return MatchRoom.findOne({
    type: { $in: ["duo", "group"] },
    "members.user": userId,
    status: { $in: ["active", "full"] },
  });
}

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
const FREQ_LABELS = {
  "1-2": "1-2 buổi/tuần",
  "2-3": "2-3 buổi/tuần",
  "3-5": "3-5 buổi/tuần",
  "5+": "Trên 5 buổi/tuần",
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

function getUserIdFromReq(req) {
  return req.userId || req.user?._id || null;
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

// full label theo yêu cầu: quốc gia - thành phố - quận - phường
function buildFullLocationLabel(profile) {
  const a = profile?.address || {};
  return [a.country, a.city, a.district, a.ward].filter(Boolean).join(" - ");
}

function buildAreaInfo(meProfile, otherProfile) {
  if (!meProfile || !otherProfile) return { areaKey: null, areaLabel: "" };
  const a = meProfile.address || {},
    b = otherProfile.address || {};
  const norm = (v) => (v || "").toString().trim().toLowerCase();
  const cityA = norm(a.city),
    cityB = norm(b.city);
  const districtA = norm(a.district),
    districtB = norm(b.district);
  const wardA = norm(a.ward),
    wardB = norm(b.ward);
  if (!cityA || !cityB) return { areaKey: null, areaLabel: "" };
  if (cityA === cityB) {
    if (districtA && districtB && districtA === districtB) {
      if (wardA && wardB && wardA === wardB)
        return { areaKey: "same_ward", areaLabel: "Rất gần bạn" };
      return { areaKey: "same_district", areaLabel: "Trong quận của bạn" };
    }
    return { areaKey: "same_city", areaLabel: "Cùng thành phố" };
  }
  return { areaKey: "other", areaLabel: "Ngoài khu vực" };
}

function buildNearbyUserCard(user, meProfile) {
  const profile = user.profile || {};
  const nickname = profile.nickname || user.username || "Người dùng FitMatch";
  const age = profile.dob ? calcAge(profile.dob) : null;
  const gender = profile.sex || null;

  const goalKey = user.connectGoalKey || profile.goal || null;
  const goalLabel = user.connectGoalLabel || goalLabelFromKey(goalKey) || null;

  const trainingTypes = Array.isArray(user.connectTrainingTypes)
    ? user.connectTrainingTypes
    : [];
  const frequency = user.connectTrainingFrequencyLabel || "";

  const intensityKey = profile.trainingIntensity || null;
  const intensityLabel = intensityLabelFromKey(intensityKey) || null;

  const locationLabel = buildLocationLabel(profile, user.connectLocationLabel);
  const bio = user.connectBio || "";
  const imageUrl = profile.avatarUrl || null;

  const { areaKey, areaLabel } = buildAreaInfo(meProfile, profile);

  return {
    id: user._id,
    isGroup: false,
    nickname,
    age,
    gender,
    goal: goalLabel,
    goalKey,
    trainingTypes,
    frequency,
    intensityKey,
    intensityLabel,
    locationLabel,
    bio,
    imageUrl,
    areaKey,
    areaLabel,
  };
}

function buildNearbyGroupCard(room) {
  const membersCount = room.members?.length || 0;
  const goalLabel =
    room.goalLabel || goalLabelFromKey(room.goalKey) || room.goalKey || null;
  return {
    id: room._id,
    nickname: room.name || "Nhóm tập luyện",
    isGroup: true,
    membersCount,
    gender: room.gender || "all",
    ageRange: room.ageRange || "all",
    trainingFrequency: room.trainingFrequency || null,
    frequency: room.trainingFrequency
      ? FREQ_LABELS[room.trainingFrequency] || room.trainingFrequency
      : room.scheduleText || "",
    joinPolicy: room.joinPolicy || "request",
    goal: goalLabel,
    goalKey: room.goalKey || null,
    trainingTypes: room.trainingTypes || [],
    locationLabel: room.locationLabel || "",
    bio: room.description || "",
    imageUrl: room.coverImageUrl || null,
    areaKey: null,
    areaLabel: "",
  };
}

async function isOwnerOfRoom(userId, roomId) {
  const r = await MatchRoom.findOne({
    _id: roomId,
    "members.user": userId,
    "members.role": "owner",
    status: { $in: ["active", "full"] },
  })
    .select("_id")
    .lean();
  return !!r;
}

function parseIntSafe(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ===== API =====

// GET /api/match/status
export async function getMatchStatus(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const [me, room] = await Promise.all([
      User.findById(userId)
        .select("connectDiscoverable hasAddressForConnect profile")
        .lean(),
      findActiveRoomOfUser(userId),
    ]);
    if (!me)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });

    const hasAddr = me.hasAddressForConnect || hasAddress(me.profile || {});

    // pending duo incoming (toUser)
    const incomingDuo = await MatchRequest.countDocuments({
      toUser: userId,
      status: "pending",
      type: "duo",
    });

    // pending group incoming (toRoom) chỉ tính nếu user là owner của room đó
    const ownerRooms = await MatchRoom.find({
      type: "group",
      status: { $in: ["active", "full"] },
      "members.user": userId,
      "members.role": "owner",
    })
      .select("_id")
      .lean();
    const ownerRoomIds = ownerRooms.map((x) => x._id);
    const incomingGroup = ownerRoomIds.length
      ? await MatchRequest.countDocuments({
          type: "group",
          status: "pending",
          toRoom: { $in: ownerRoomIds },
        })
      : 0;

    // outgoing pending (fromUser) (duo + group)
    const outgoing = await MatchRequest.countDocuments({
      fromUser: userId,
      status: "pending",
    });

    return responseOk(res, {
      discoverable: !!me.connectDiscoverable,
      hasAddressForConnect: !!hasAddr,
      activeRoomId: room ? room._id : null,
      activeRoomType: room ? room.type : null,
      pendingRequestsCount: incomingDuo + incomingGroup + outgoing,
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/match/discoverable
export async function updateDiscoverable(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { discoverable } = req.body || {};
    const user = await User.findById(userId).select(
      "connectDiscoverable hasAddressForConnect profile"
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });

    const hasAddr = user.hasAddressForConnect || hasAddress(user.profile || {});
    if (discoverable && !hasAddr) {
      return res.status(400).json({
        ok: false,
        error: "need_address",
        message: "Bạn cần cập nhật địa chỉ trong hồ sơ trước khi bật cho phép tìm kiếm.",
      });
    }

    user.connectDiscoverable = !!discoverable;
    if (!user.hasAddressForConnect && hasAddr) user.hasAddressForConnect = true;
    await user.save();

    return responseOk(res, { discoverable: user.connectDiscoverable });
  } catch (err) {
    next(err);
  }
}

// GET /api/match/nearby?mode=one_to_one|group
export async function listNearby(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { mode = "one_to_one" } = req.query || {};
    const me = await User.findById(userId).lean();
    if (!me)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });

    let users = [],
      groups = [];
    if (mode === "one_to_one") {
      users = await User.find({
        _id: { $ne: userId },
        role: "user",
        connectDiscoverable: true,
        blocked: false,
      })
        .limit(100)
        .lean();
    } else if (mode === "group") {
      groups = await MatchRoom.find({
        type: "group",
        status: { $in: ["active"] },
        $expr: { $lt: [{ $size: "$members" }, "$maxMembers"] },
      })
        .limit(50)
        .lean();
    }

    const userCards =
      mode === "one_to_one" ? users.map((u) => buildNearbyUserCard(u, me.profile)) : [];
    const groupCards = mode === "group" ? groups.map(buildNearbyGroupCard) : [];

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

/* ================== TEAM: CREATE GROUP (Cloudinary) ================== */
// POST /api/match/groups (multipart/form-data)
export async function createGroupRoom(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const activeRoom = await findActiveRoomOfUser(userId);
    if (activeRoom) {
      return res.status(409).json({
        ok: false,
        error: "user_already_in_room",
        message: "Bạn đã tham gia một phòng kết nối khác, hãy rời phòng trước khi tạo nhóm mới.",
      });
    }

    const file = req.file;
    if (!file)
      return res.status(400).json({
        ok: false,
        error: "missing_cover",
        message: "Vui lòng chọn ảnh nhóm (tối đa 5MB).",
      });

    const body = req.body || {};
    const name = (body.name || "").toString();
    const description = (body.description || "").toString();

    const ageRange = (body.ageRange || "").toString();
    const gender = (body.gender || "").toString();
    const trainingFrequency = (body.trainingFrequency || "").toString();
    const joinPolicy = ((body.joinPolicy || "request").toString() || "request");
    const maxMembers = parseIntSafe(body.maxMembers);

    if (!name || name.length > 50)
      return res.status(400).json({
        ok: false,
        error: "invalid_name",
        message: "Tên nhóm là bắt buộc và tối đa 50 ký tự.",
      });
    if (!description || description.length > 300)
      return res.status(400).json({
        ok: false,
        error: "invalid_description",
        message: "Mô tả nhóm là bắt buộc và tối đa 300 ký tự.",
      });

    if (!["all", "18-21", "22-27", "28-35", "36-45", "45+"].includes(ageRange))
      return res.status(400).json({
        ok: false,
        error: "invalid_ageRange",
        message: "Độ tuổi không hợp lệ.",
      });
    if (!["all", "male", "female"].includes(gender))
      return res.status(400).json({
        ok: false,
        error: "invalid_gender",
        message: "Giới tính không hợp lệ.",
      });
    if (!["1-2", "2-3", "3-5", "5+"].includes(trainingFrequency))
      return res.status(400).json({
        ok: false,
        error: "invalid_trainingFrequency",
        message: "Mức độ tập luyện không hợp lệ.",
      });
    if (!["request", "open"].includes(joinPolicy))
      return res.status(400).json({
        ok: false,
        error: "invalid_joinPolicy",
        message: "Kiểu gia nhập không hợp lệ.",
      });
    if (![2, 3, 4, 5].includes(maxMembers))
      return res.status(400).json({
        ok: false,
        error: "invalid_maxMembers",
        message: "Số thành viên tối đa không hợp lệ (2-5).",
      });

    const me = await User.findById(userId)
      .select("profile connectGoalKey connectGoalLabel username email")
      .lean();
    if (!me)
      return res.status(404).json({
        ok: false,
        error: "user_not_found",
        message: "Không tìm thấy người dùng.",
      });

    const locationLabel = buildFullLocationLabel(me.profile || {});
    if (!locationLabel) {
      return res.status(400).json({
        ok: false,
        error: "need_address",
        message: "Bạn cần cập nhật địa chỉ trong Thông tin tài khoản trước khi tạo nhóm.",
      });
    }

    const goalKey = me.connectGoalKey || me.profile?.goal || null;
    const goalLabel = me.connectGoalLabel || goalLabelFromKey(goalKey) || "";

    const coverImageUrl = await uploadImageWithResize(
      file.buffer,
      "asset/folder/connect-teams",
      { width: 1200, height: 1200, fit: "cover" },
      { quality: 85 }
    );

    const now = new Date();
    const room = await MatchRoom.create({
      type: "group",
      name,
      description,
      coverImageUrl,
      ageRange,
      gender,
      trainingFrequency,
      joinPolicy,
      maxMembers,
      locationLabel,
      goalKey,
      goalLabel,
      createdBy: userId,
      members: [{ user: userId, role: "owner", joinedAt: now }], // ✅ add joinedAt
      status: maxMembers <= 1 ? "full" : "active",
    });

    return responseOk(res, { roomId: room._id, roomType: room.type });
  } catch (err) {
    next(err);
  }
}

// POST /api/match/requests (gửi lời mời / join group)
export async function createMatchRequest(req, res, next) {
  try {
    const fromUserId = getUserIdFromReq(req);
    if (!fromUserId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { type, targetUserId, targetRoomId, message } = req.body || {};
    if (!["duo", "group"].includes(type))
      return res.status(400).json({ ok: false, error: "invalid_type" });

    // Check đang ở room khác?
    const activeRoom = await findActiveRoomOfUser(fromUserId);
    if (activeRoom) {
      return res.status(409).json({
        ok: false,
        error: "user_already_in_room",
        message: "Bạn đã tham gia một phòng kết nối khác, hãy rời phòng trước khi gửi lời mời mới.",
      });
    }

    const fromUser = await User.findById(fromUserId).lean();
    if (!fromUser)
      return res.status(404).json({ ok: false, error: "from_user_not_found" });

    const fromNickname = fromUser.profile?.nickname || fromUser.username || "";
    const fromGoalKey = fromUser.connectGoalKey || fromUser.profile?.goal || null;
    const fromGoalLabel = fromUser.connectGoalLabel || goalLabelFromKey(fromGoalKey) || "";

    // ===== DUO =====
    if (type === "duo") {
      if (!targetUserId)
        return res.status(400).json({ ok: false, error: "missing_target_user" });
      if (String(targetUserId) === String(fromUserId))
        return res.status(400).json({ ok: false, error: "cannot_invite_self" });

      const targetUser = await User.findById(targetUserId).lean();
      if (!targetUser) return res.status(404).json({ ok: false, error: "user_not_found" });
      if (!targetUser.connectDiscoverable)
        return res.status(400).json({
          ok: false,
          error: "target_not_discoverable",
          message: "Người dùng hiện không cho phép tìm kiếm.",
        });

      // tránh spam trùng request
      const existed = await MatchRequest.findOne({
        type: "duo",
        fromUser: fromUserId,
        toUser: targetUserId,
        status: "pending",
      }).lean();
      if (existed) return responseOk(res, { request: existed, duplicated: true });

      const doc = await MatchRequest.create({
        type: "duo",
        fromUser: fromUserId,
        toUser: targetUserId,
        message: message || "",
        meta: { fromNickname, fromGoalKey, fromGoalLabel },
      });

      await notifySafe({
        to: String(targetUserId),
        from: String(fromUserId),
        type: "match_request_duo",
        title: "Lời mời kết nối",
        body: `${fromNickname || "Một người dùng"} đã gửi lời mời kết nối với bạn.`,
        data: { screen: "Connect", tab: "requests", mode: "duo", requestId: String(doc._id) },
      });

      return responseOk(res, { request: doc });
    }

    // ===== GROUP =====
    if (!targetRoomId)
      return res.status(400).json({ ok: false, error: "missing_target_room" });

    const room = await MatchRoom.findById(targetRoomId);
    if (!room || room.type !== "group")
      return res.status(404).json({ ok: false, error: "room_not_found" });

    const currentCount = room.members?.length || 0;
    if (currentCount >= (room.maxMembers || 5))
      return res.status(409).json({ ok: false, error: "group_full", message: "Nhóm đã đủ người." });

    // nếu room open -> join thẳng, không tạo request
    if ((room.joinPolicy || "request") === "open") {
      const now = new Date();
      const members = room.members || [];
      const existed = members.find((m) => String(m.user) === String(fromUserId));
      if (!existed) members.push({ user: fromUserId, role: "member", joinedAt: now }); // ✅ add joinedAt
      else if (!existed.joinedAt) existed.joinedAt = now;
      room.members = members;

      if (room.members.length >= (room.maxMembers || 5)) {
        room.status = "full";
        room.closedAt = new Date();
      } else {
        room.status = "active";
        room.closedAt = null;
      }

      await room.save();

      const ownerIds = (room.members || [])
        .filter((m) => m.role === "owner")
        .map((m) => String(m.user));

      // ✅ thông báo "thành viên mới tham gia" cho owner (room open)
      for (const oid of ownerIds) {
        if (!oid || oid === String(fromUserId)) continue;
        await notifySafe({
          to: oid,
          from: String(fromUserId),
          type: "group_member_joined",
          title: "Thành viên mới tham gia",
          body: `${fromNickname || "Một người dùng"} đã tham gia nhóm "${room.name || "Nhóm tập luyện"}".`,
          data: { screen: "Connect", tab: "team", mode: "group", roomId: String(room._id) },
        });
      }

      return responseOk(res, {
        roomId: room._id,
        roomType: room.type,
        joined: true,
        joinPolicy: "open",
      });
    }

    // joinPolicy request -> tạo MatchRequest
    const existed = await MatchRequest.findOne({
      type: "group",
      fromUser: fromUserId,
      toRoom: room._id,
      status: "pending",
    }).lean();
    if (existed) return responseOk(res, { request: existed, duplicated: true });

    const doc = await MatchRequest.create({
      type: "group",
      fromUser: fromUserId,
      toRoom: room._id,
      message: message || "",
      meta: { fromNickname, fromGoalKey, fromGoalLabel },
    });

    const ownerIds = (room.members || [])
      .filter((m) => m.role === "owner")
      .map((m) => String(m.user));

    // ✅ realtime cho chủ nhóm: có người gửi yêu cầu vào nhóm
    for (const oid of ownerIds) {
      if (!oid) continue;
      await notifySafe({
        to: oid,
        from: String(fromUserId),
        type: "match_request_group",
        title: "Yêu cầu tham gia nhóm",
        body: `${fromNickname || "Một người dùng"} muốn tham gia nhóm "${room.name || "Nhóm tập luyện"}".`,
        data: { screen: "Connect", tab: "requests", mode: "group", roomId: String(room._id), requestId: String(doc._id) },
      });
    }

    return responseOk(res, { request: doc });
  } catch (err) {
    next(err);
  }
}

// GET /api/match/requests
export async function listMyRequests(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    // incoming duo: toUser = me
    const incomingDuoPromise = MatchRequest.find({
      toUser: userId,
      status: "pending",
      type: "duo",
    })
      .populate({
        path: "fromUser",
        select: "username profile.nickname profile.avatarUrl connectGoalKey connectGoalLabel",
      })
      .lean();

    // incoming group: toRoom thuộc rooms mà me là owner
    const ownerRooms = await MatchRoom.find({
      type: "group",
      status: { $in: ["active", "full"] },
      "members.user": userId,
      "members.role": "owner",
    })
      .select("_id")
      .lean();
    const ownerRoomIds = ownerRooms.map((x) => x._id);

    const incomingGroupPromise = ownerRoomIds.length
      ? MatchRequest.find({
          type: "group",
          status: "pending",
          toRoom: { $in: ownerRoomIds },
        })
          .populate({
            path: "fromUser",
            select: "username profile.nickname profile.avatarUrl connectGoalKey connectGoalLabel",
          })
          .populate({
            path: "toRoom",
            select: "name coverImageUrl type members maxMembers status locationLabel joinPolicy",
          })
          .lean()
      : Promise.resolve([]);

    // outgoing: fromUser = me
    const outgoingPromise = MatchRequest.find({ fromUser: userId, status: "pending" })
      .populate({
        path: "toUser",
        select: "username profile.nickname profile.avatarUrl connectGoalKey connectGoalLabel",
      })
      .populate({
        path: "toRoom",
        select: "name coverImageUrl type members maxMembers status locationLabel joinPolicy",
      })
      .lean();

    const [incoming, incomingGroups, outgoing] = await Promise.all([
      incomingDuoPromise,
      incomingGroupPromise,
      outgoingPromise,
    ]);

    return responseOk(res, { incoming, incomingGroups, outgoing });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/match/requests/:id/accept
export async function acceptRequest(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const { id } = req.params;

    const reqDoc = await MatchRequest.findById(id)
      .populate("fromUser")
      .populate("toUser")
      .populate("toRoom")
      .exec();
    if (!reqDoc || reqDoc.status !== "pending")
      return res.status(404).json({ ok: false, error: "request_not_found" });

    if (reqDoc.type === "duo") {
      if (String(reqDoc.toUser._id) !== String(userId))
        return res.status(403).json({ ok: false, error: "not_allowed" });
    } else if (reqDoc.type === "group") {
      // chỉ owner của phòng mới accept
      const roomId = reqDoc.toRoom?._id || reqDoc.toRoom;
      if (!roomId) return res.status(404).json({ ok: false, error: "room_not_found" });
      const okOwner = await isOwnerOfRoom(userId, roomId);
      if (!okOwner)
        return res.status(403).json({
          ok: false,
          error: "not_allowed",
          message: "Chỉ quản lý nhóm mới có thể duyệt yêu cầu.",
        });
    }

    // Check fromUser đã ở room khác chưa
    const roomOfFrom = await findActiveRoomOfUser(reqDoc.fromUser._id);
    if (roomOfFrom) {
      reqDoc.status = "rejected";
      reqDoc.resolvedAt = new Date();
      await reqDoc.save();
      return res.status(409).json({
        ok: false,
        error: "user_already_in_room",
        message: "Người gửi đã tham gia kết nối khác. Lời mời hết hiệu lực.",
      });
    }

    let room;

    if (reqDoc.type === "duo") {
      // Check toUser đã ở room khác chưa
      const roomOfTo = await findActiveRoomOfUser(reqDoc.toUser._id);
      if (roomOfTo) {
        reqDoc.status = "rejected";
        reqDoc.resolvedAt = new Date();
        await reqDoc.save();
        return res.status(409).json({
          ok: false,
          error: "user_already_in_room",
          message: "Một trong hai người đã tham gia kết nối. Lời mời hết hiệu lực.",
        });
      }

      const now = new Date();
      room = await MatchRoom.create({
        type: "duo",
        createdBy: reqDoc.fromUser._id,
        members: [
          { user: reqDoc.fromUser._id, role: "owner", joinedAt: now }, // ✅ add joinedAt
          { user: reqDoc.toUser._id, role: "member", joinedAt: now }, // ✅ add joinedAt
        ],
        maxMembers: 2,
      });
    } else {
      room = await MatchRoom.findById(reqDoc.toRoom._id);
      if (!room || room.type !== "group")
        return res.status(404).json({ ok: false, error: "room_not_found" });

      const currentCount = room.members?.length || 0;
      if (currentCount >= (room.maxMembers || 5)) {
        reqDoc.status = "rejected";
        reqDoc.resolvedAt = new Date();
        await reqDoc.save();
        return res.status(409).json({ ok: false, error: "group_full", message: "Nhóm đã đủ người." });
      }

      const now = new Date();
      const members = room.members || [];
      const existed = members.find((m) => String(m.user) === String(reqDoc.fromUser._id));
      if (!existed) members.push({ user: reqDoc.fromUser._id, role: "member", joinedAt: now }); // ✅ add joinedAt
      else if (!existed.joinedAt) existed.joinedAt = now;
      room.members = members;

      if (room.members.length >= room.maxMembers) {
        room.status = "full";
        room.closedAt = new Date();
      } else {
        room.status = "active";
        room.closedAt = null;
      }

      await room.save();
    }

    reqDoc.status = "accepted";
    reqDoc.resolvedAt = new Date();
    await reqDoc.save();

    // ✅ notify người gửi request
    if (reqDoc.type === "duo") {
      await notifySafe({
        to: String(reqDoc.fromUser?._id || reqDoc.fromUser),
        from: String(userId),
        type: "match_accepted_duo",
        title: "Kết nối được chấp nhận",
        body: "Đối phương đã chấp nhận lời mời kết nối của bạn.",
        data: {
          screen: "Connect",
          tab: "duo",
          mode: "duo",
          requestId: String(reqDoc._id),
          roomId: String(room._id),
          roomType: "duo",
        },
      });
    } else {
      await notifySafe({
        to: String(reqDoc.fromUser?._id || reqDoc.fromUser),
        from: String(userId),
        type: "match_accepted_group",
        title: "Đã duyệt vào nhóm",
        body: `Yêu cầu vào nhóm "${room?.name || "Nhóm tập luyện"}" đã được chấp nhận.`,
        data: {
          screen: "Connect",
          tab: "team",
          mode: "group",
          requestId: String(reqDoc._id),
          roomId: String(room._id),
          roomType: "group",
        },
      });

      // ✅ thông báo cho các thành viên còn lại: có thành viên mới đã tham gia
      const joinerId = String(reqDoc.fromUser?._id || reqDoc.fromUser);
      const joinerName = pickName(reqDoc.fromUser);

      const ids = roomMemberIds(room);
      for (const toId of ids) {
        if (toId === joinerId) continue;
        await notifySafe({
          to: toId,
          from: String(userId), // owner duyệt
          type: "group_member_joined",
          title: "Thành viên mới đã tham gia",
          body: `${joinerName} đã tham gia nhóm "${room?.name || "Nhóm tập luyện"}".`,
          data: { screen: "Connect", tab: "team", mode: "group", roomId: String(room._id) },
        });
      }
    }

    return responseOk(res, { roomId: room._id, roomType: room.type });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/match/requests/:id/reject
export async function rejectRequest(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const { id } = req.params;

    const reqDoc = await MatchRequest.findById(id);
    if (!reqDoc || reqDoc.status !== "pending")
      return res.status(404).json({ ok: false, error: "request_not_found" });

    if (reqDoc.type === "duo") {
      if (String(reqDoc.toUser) !== String(userId))
        return res.status(403).json({ ok: false, error: "not_allowed" });
    } else if (reqDoc.type === "group") {
      const okOwner = await isOwnerOfRoom(userId, reqDoc.toRoom);
      if (!okOwner)
        return res.status(403).json({
          ok: false,
          error: "not_allowed",
          message: "Chỉ quản lý nhóm mới có thể từ chối yêu cầu.",
        });
    }

    reqDoc.status = "rejected";
    reqDoc.resolvedAt = new Date();
    await reqDoc.save();

    // ✅ lấy roomName cho group để body rõ + data điều hướng
    let roomName = "";
    let roomId = null;
    if (reqDoc.type === "group" && reqDoc.toRoom) {
      const r = await MatchRoom.findById(reqDoc.toRoom).select("name").lean().catch(() => null);
      roomName = r?.name || "";
      roomId = String(reqDoc.toRoom);
    }

    await notifySafe({
      to: String(reqDoc.fromUser),
      from: String(userId),
      type: reqDoc.type === "duo" ? "match_rejected_duo" : "match_rejected_group",
      title: "Yêu cầu bị từ chối",
      body:
        reqDoc.type === "group"
          ? `Yêu cầu vào nhóm "${roomName || "Nhóm tập luyện"}" đã bị từ chối.`
          : "Yêu cầu kết nối của bạn đã bị từ chối.",
      data:
        reqDoc.type === "group"
          ? { screen: "Connect", tab: "requests", mode: "group", roomId, requestId: String(reqDoc._id) }
          : { screen: "Connect", tab: "requests", mode: "duo", requestId: String(reqDoc._id) },
    });

    return responseOk(res, { requestId: reqDoc._id, status: reqDoc.status });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/match/requests/:id/cancel
export async function cancelRequest(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const { id } = req.params;

    const reqDoc = await MatchRequest.findById(id);
    if (!reqDoc || reqDoc.status !== "pending")
      return res.status(404).json({ ok: false, error: "request_not_found" });
    if (String(reqDoc.fromUser) !== String(userId))
      return res.status(403).json({ ok: false, error: "not_allowed" });

    reqDoc.status = "cancelled";
    reqDoc.resolvedAt = new Date();
    await reqDoc.save();

    if (reqDoc.type === "duo") {
      if (reqDoc.toUser) {
        await notifySafe({
          to: String(reqDoc.toUser),
          from: String(userId),
          type: "match_cancelled_duo",
          title: "Đã hủy lời mời",
          body: "Đối phương đã hủy lời mời kết nối.",
          data: { screen: "Connect", tab: "requests", mode: "duo", requestId: String(reqDoc._id) },
        });
      }
    } else if (reqDoc.type === "group" && reqDoc.toRoom) {
      const r = await MatchRoom.findById(reqDoc.toRoom)
        .select("name members")
        .lean()
        .catch(() => null);
      const ownerIds = (r?.members || []).filter((m) => m.role === "owner").map((m) => String(m.user));
      for (const oid of ownerIds) {
        await notifySafe({
          to: oid,
          from: String(userId),
          type: "match_cancelled_group",
          title: "Đã hủy yêu cầu vào nhóm",
          body: `Một yêu cầu vào nhóm "${r?.name || "Nhóm tập luyện"}" đã bị hủy.`,
          data: { screen: "Connect", tab: "requests", mode: "group", roomId: String(reqDoc.toRoom), requestId: String(reqDoc._id) },
        });
      }
    }

    return responseOk(res, { requestId: reqDoc._id, status: reqDoc.status });
  } catch (err) {
    next(err);
  }
}

/* ========= ROOM DETAIL & LEAVE ========= */

// GET /api/match/rooms/:id
export async function getRoomDetail(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const { id } = req.params;

    const room = await MatchRoom.findById(id)
      .populate({
        path: "members.user",
        select: [
          "username",
          "email",
          "profile.nickname",
          "profile.avatarUrl",
          "profile.sex",
          "profile.dob",
          "profile.bio",
          "profile.address",
          "profile.locationLabel",
          "profile.goal",
          "profile.goalLabel",
          "profile.trainingTypes",
          "profile.trainingIntensity",
          "connectGoalKey",
          "connectGoalLabel",
          "connectBio",
          "connectLocationLabel",
          "connectTrainingTypes",
          "connectTrainingFrequencyLabel",
        ].join(" "),
      })
      .lean();

    if (!room)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phòng kết nối" });

    const isMember = (room.members || []).some((m) => {
      const u = m.user || {};
      const uid = u._id || u.id || u;
      return String(uid) === String(userId);
    });
    if (!isMember)
      return res
        .status(403)
        .json({ success: false, message: "Bạn không thuộc phòng kết nối này." });

    return responseOk(res, room);
  } catch (err) {
    next(err);
  }
}

// POST /api/match/rooms/:id/leave
// POST /api/match/rooms/:id/leave
export async function leaveMatchRoom(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const { id } = req.params;

    const room = await MatchRoom.findById(id);
    if (!room)
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy phòng kết nối" });

    const idx = room.members.findIndex((m) => String(m.user) === String(userId));
    if (idx === -1)
      return res
        .status(403)
        .json({ success: false, message: "Bạn không thuộc phòng kết nối này." });

    const leavingWasOwner = room.members[idx]?.role === "owner";

    // ✅ chặn owner rời nếu còn thành viên khác
    if (room.type === "group" && leavingWasOwner && room.members.length > 1) {
      return res.status(400).json({
        ok: false,
        error: "owner_cannot_leave",
        message:
          "Bạn không thể rời khỏi nhóm này trừ khi bạn chỉ định vai trò chủ phòng cho thành viên khác.",
      });
    }

    // snapshot name trước khi splice (để thông báo)
    const leaverName = await getUserNameById(userId);

    // remove member
    room.members.splice(idx, 1);

    if (room.members.length === 0) {
      room.status = "closed";
      room.closedAt = new Date();
    } else {
      if (room.members.length >= room.maxMembers) {
        room.status = "full";
        room.closedAt = new Date();
      } else {
        room.status = "active";
        room.closedAt = null;
      }
    }

    await room.save();

    // ==========================
    // ✅ NEW NOTIFICATIONS (added)
    // ==========================
    const remainIds = (room.members || [])
      .map((m) => String(m?.user || ""))
      .filter(Boolean);

    // 1) Duo: notify người còn lại
    if (room.type === "duo" && remainIds.length) {
      for (const toId of remainIds) {
        if (String(toId) === String(userId)) continue;
        await notifySafe({
          to: String(toId),
          from: String(userId),
          type: "duo_member_left",
          title: "Đối phương đã rời kết nối",
          body: `${leaverName} đã rời khỏi kết nối đôi.`,
          data: {
            screen: "Connect",
            tab: "duo",
            mode: "duo",
            roomId: String(room._id),
            action: "left",
          },
        });
      }
    }

    // 2) Group: notify các thành viên còn lại (không đụng tới "group_member_removed")
    if (room.type === "group" && remainIds.length) {
      const roomName = room?.name || "Nhóm tập luyện";
      for (const toId of remainIds) {
        if (String(toId) === String(userId)) continue;
        await notifySafe({
          to: String(toId),
          from: String(userId),
          type: "group_member_left",
          title: "Thành viên đã rời nhóm",
          body: `${leaverName} đã rời khỏi nhóm "${roomName}".`,
          data: {
            screen: "Connect",
            tab: "team",
            mode: "group",
            roomId: String(room._id),
            action: "left",
          },
        });
      }
    }

    return responseOk(res, {
      roomId: room._id,
      status: room.status,
      remainingMembers: room.members.length,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/match/rooms/:id/requests
export async function listRoomRequests(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id: roomId } = req.params;
    const room = await MatchRoom.findById(roomId).select("_id type").lean();
    if (!room || room.type !== "group")
      return res.status(404).json({ success: false, message: "Không tìm thấy nhóm" });

    const okOwner = await isOwnerOfRoom(userId, roomId);
    if (!okOwner)
      return res
        .status(403)
        .json({ success: false, message: "Chỉ chủ phòng mới xem được danh sách yêu cầu." });

    const qStatus = (req.query?.status || "").toString().trim().toLowerCase();
    const allowed = ["pending", "accepted", "rejected", "cancelled"];
    let statuses = [];
    if (!qStatus || qStatus === "all") statuses = ["pending", "accepted", "rejected"];
    else statuses = qStatus
      .split(",")
      .map((s) => s.trim())
      .filter((s) => allowed.includes(s));

    const filter = { type: "group", toRoom: roomId };
    if (statuses.length) filter.status = { $in: statuses };

    const docs = await MatchRequest.find(filter)
      .populate({
        path: "fromUser",
        select:
          "username email profile.nickname profile.avatarUrl profile.sex profile.dob profile.trainingIntensity profile.address connectGoalKey connectGoalLabel connectBio connectLocationLabel",
      })
      .sort({ createdAt: -1 })
      .lean();

    const items = docs.map((d) => ({
      _id: d._id,
      status: d.status,
      message: d.message || "",
      createdAt: d.createdAt,
      resolvedAt: d.resolvedAt || null,
      meta: d.meta || null,
      fromUser: d.fromUser || null,
    }));

    // nếu gọi ?status=pending thì trả list items luôn
    if (qStatus && qStatus !== "all") {
      return responseOk(res, { items });
    }

    const pending = items.filter((x) => x.status === "pending");
    const accepted = items.filter((x) => x.status === "accepted");
    const rejected = items.filter((x) => x.status === "rejected");

    return responseOk(res, {
      pending,
      accepted,
      rejected,
      counts: { pending: pending.length, accepted: accepted.length, rejected: rejected.length },
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/match/rooms/:id  (owner edit group)
export async function updateGroupRoom(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id: roomId } = req.params;
    const room = await MatchRoom.findById(roomId);
    if (!room)
      return res.status(404).json({ success: false, message: "Không tìm thấy phòng" });
    if (room.type !== "group")
      return res.status(400).json({ success: false, message: "Chỉ nhóm mới chỉnh sửa được" });

    const okOwner = await isOwnerOfRoom(userId, roomId);
    if (!okOwner)
      return res
        .status(403)
        .json({ success: false, message: "Chỉ chủ phòng mới có thể chỉnh sửa nhóm." });

    const body = req.body || {};
    const patch = {};

    const name = body.name != null ? String(body.name).trim() : null;
    const description = body.description != null ? String(body.description).trim() : null;
    const coverImageUrlBody = body.coverImageUrl != null ? String(body.coverImageUrl).trim() : null;

    const ageRange = body.ageRange != null ? String(body.ageRange).trim() : null;
    const gender = body.gender != null ? String(body.gender).trim() : null;
    const trainingFrequency = body.trainingFrequency != null ? String(body.trainingFrequency).trim() : null;
    const joinPolicy = body.joinPolicy != null ? String(body.joinPolicy).trim() : null;

    const maxMembersRaw = body.maxMembers != null ? body.maxMembers : null;
    const maxMembers = maxMembersRaw != null ? parseIntSafe(maxMembersRaw) : null;

    const locationLabel = body.locationLabel != null ? String(body.locationLabel).trim() : null;

    if (name !== null) {
      if (!name || name.length > 50)
        return res.status(400).json({ success: false, message: "Tên nhóm tối đa 50 ký tự." });
      patch.name = name;
    }
    if (description !== null) {
      if (!description || description.length > 300)
        return res.status(400).json({ success: false, message: "Mô tả tối đa 300 ký tự." });
      patch.description = description;
    }

    // upload file nếu có
    if (req.file) {
      const url = await uploadImageWithResize(
        req.file.buffer,
        "asset/folder/connect-teams",
        { width: 1200, height: 1200, fit: "cover" },
        { quality: 85 }
      );
      patch.coverImageUrl = url;
    } else if (coverImageUrlBody !== null) {
      if (!coverImageUrlBody)
        return res.status(400).json({ success: false, message: "Ảnh nhóm không được để trống." });
      patch.coverImageUrl = coverImageUrlBody;
    }

    if (ageRange !== null) {
      if (!["all", "18-21", "22-27", "28-35", "36-45", "45+"].includes(ageRange))
        return res.status(400).json({ success: false, message: "Độ tuổi không hợp lệ." });
      patch.ageRange = ageRange;
    }
    if (gender !== null) {
      if (!["all", "male", "female"].includes(gender))
        return res.status(400).json({ success: false, message: "Giới tính không hợp lệ." });
      patch.gender = gender;
    }
    if (trainingFrequency !== null) {
      if (!["1-2", "2-3", "3-5", "5+"].includes(trainingFrequency))
        return res.status(400).json({ success: false, message: "Mức độ tập luyện không hợp lệ." });
      patch.trainingFrequency = trainingFrequency;
    }
    if (joinPolicy !== null) {
      if (!["request", "open"].includes(joinPolicy))
        return res.status(400).json({ success: false, message: "JoinPolicy không hợp lệ." });
      patch.joinPolicy = joinPolicy;
    }
    if (maxMembers !== null) {
      if (![2, 3, 4, 5].includes(maxMembers))
        return res.status(400).json({ success: false, message: "Số thành viên tối đa không hợp lệ (2-5)." });
      const cnt = room.members?.length || 0;
      if (maxMembers < cnt)
        return res.status(400).json({
          success: false,
          message: `Số thành viên tối đa không thể nhỏ hơn số thành viên hiện tại (${cnt}).`,
        });
      patch.maxMembers = maxMembers;
    }
    if (locationLabel !== null) {
      patch.locationLabel = locationLabel;
    }

    Object.assign(room, patch);

    // sync status theo maxMembers
    if (patch.maxMembers != null) {
      const cnt = room.members?.length || 0;
      if (cnt >= room.maxMembers) {
        room.status = "full";
        room.closedAt = room.closedAt || new Date();
      } else {
        room.status = "active";
        room.closedAt = null;
      }
    }

    await room.save();

    // ✅ notify "group updated" cho các thành viên (trừ người chỉnh)
    const actorName = await getUserNameById(userId);
    const ids = roomMemberIds(room);
    for (const toId of ids) {
      if (toId === String(userId)) continue;
      await notifySafe({
        to: toId,
        from: String(userId),
        type: "group_updated",
        title: "Thông tin nhóm đã thay đổi",
        body: `${actorName} đã cập nhật thông tin nhóm "${room?.name || "Nhóm tập luyện"}".`,
        data: { screen: "Connect", tab: "team", mode: "group", roomId: String(room._id) },
      });
    }

    const populated = await MatchRoom.findById(roomId)
      .populate({
        path: "members.user",
        select:
          "username email profile.nickname profile.avatarUrl profile.sex profile.dob connectGoalKey connectGoalLabel profile.goal profile.trainingIntensity",
      })
      .lean();

    return responseOk(res, populated);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/match/rooms/:id/members/manage
export async function manageGroupMembers(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const { id: roomId } = req.params;
    const { makeOwnerId, removeIds } = req.body || {};

    const room = await MatchRoom.findById(roomId);
    if (!room)
      return res.status(404).json({ success: false, message: "Không tìm thấy nhóm" });
    if (room.type !== "group")
      return res.status(400).json({ success: false, message: "Chỉ nhóm mới có thể quản lý thành viên" });

    const okOwner = await isOwnerOfRoom(userId, roomId);
    if (!okOwner)
      return res.status(403).json({ success: false, message: "Chỉ chủ nhóm mới có thể quản lý thành viên." });

    const rm = Array.isArray(removeIds) ? removeIds.map((x) => String(x || "")).filter(Boolean) : [];
    const newOwner = makeOwnerId ? String(makeOwnerId) : null;
    if (!newOwner && !rm.length)
      return res.status(400).json({ success: false, message: "Không có thay đổi để áp dụng." });

    const members = room.members || [];
    const hasMember = (uid) => members.some((m) => String(m.user) === String(uid));
    const currentOwnerMember = members.find((m) => m.role === "owner") || null;
    const currentOwnerId = currentOwnerMember ? String(currentOwnerMember.user) : null;

    // snapshot trước khi đổi để bắn noti đúng
    const beforeMemberIds = new Set(members.map((m) => String(m.user)));
    const beforeOwnerId = currentOwnerId;

    // nếu remove chính mình khi vẫn là owner -> bắt buộc phải transfer trước
    if (rm.includes(String(userId)) && (!newOwner || newOwner === String(userId))) {
      return res.status(400).json({
        ok: false,
        error: "owner_cannot_leave",
        message: "Bạn không thể rời nhóm khi vẫn là chủ nhóm. Hãy chỉ định chủ nhóm mới trước.",
      });
    }

    // 1) transfer owner
    if (newOwner) {
      if (!hasMember(newOwner))
        return res.status(400).json({ success: false, message: "Người được chỉ định không thuộc nhóm." });

      if (currentOwnerId && newOwner !== currentOwnerId) {
        for (const m of members) {
          if (String(m.user) === currentOwnerId) m.role = "member";
          if (String(m.user) === newOwner) m.role = "owner";
        }
        room.createdBy = newOwner;
      }
    }

    // owner sau khi transfer
    const ownerAfter = (room.members || []).find((m) => m.role === "owner");
    const ownerAfterId = ownerAfter ? String(ownerAfter.user) : currentOwnerId;

    // 2) remove members (không cho remove owner hiện tại)
    const removeSet = new Set(rm.map(String));
    if (ownerAfterId) removeSet.delete(ownerAfterId);

    // chỉ remove người thực sự thuộc nhóm
    room.members = (room.members || []).filter((m) => !removeSet.has(String(m.user)));

    if ((room.members || []).length === 0) {
      room.status = "closed";
      room.closedAt = new Date();
    } else {
      if (room.members.length >= room.maxMembers) {
        room.status = "full";
        room.closedAt = room.closedAt || new Date();
      } else {
        room.status = "active";
        room.closedAt = null;
      }
    }

    await room.save();

    // ✅ NOTIFICATIONS: owner assigned + member removed
    const actorName = await getUserNameById(userId);

    // (a) Chỉ định nhóm trưởng -> thông báo cho TẤT CẢ thành viên
    if (newOwner && beforeOwnerId && String(newOwner) !== String(beforeOwnerId)) {
      const roomName = room?.name || "Nhóm tập luyện";
      const newOwnerName = await getUserNameById(newOwner);

      const idsAfter = roomMemberIds(room); // members sau khi đã save()

      for (const toId of idsAfter) {
        const isNewOwner = String(toId) === String(newOwner);

        await notifySafe({
          to: String(toId),
          from: String(userId),
          type: "group_owner_assigned",
          title: "Chỉ định nhóm trưởng",
          body: isNewOwner
            ? `${actorName} đã chỉ định bạn làm chủ nhóm "${roomName}".`
            : `${actorName} đã chỉ định ${newOwnerName} làm chủ nhóm "${roomName}".`,
          data: {
            screen: "Connect",
            tab: "team",
            mode: "group",
            roomId: String(room._id),
            action: "owner_assigned",
            ownerId: String(newOwner),
          },
        });
      }
    }

    // (c) Thông báo cho các thành viên còn lại: thành viên đã bị chủ nhóm mời ra
    const removedIds = [...removeSet].filter((rid) => beforeMemberIds.has(String(rid)));
    const remainIds = roomMemberIds(room);

    // lấy tên các user bị remove theo batch để giảm query
    let removedNameMap = new Map();
    if (removedIds.length) {
      const docs = await User.find({ _id: { $in: removedIds } })
        .select("username email profile.nickname")
        .lean()
        .catch(() => []);
      removedNameMap = new Map(docs.map((u) => [String(u._id), pickName(u)]));
    }

    const roomName = room?.name || "Nhóm tập luyện";

    for (const removedId of removedIds) {
      const removedName = removedNameMap.get(String(removedId)) || "Một thành viên";

      // (b) ✅ Thông báo cho CHÍNH người bị kick
      await notifySafe({
        to: String(removedId),
        from: String(userId),
        type: "group_member_kicked", // dùng lại type đang có để chắc chắn FE hiển thị
        title: "Đã bị mời ra khỏi nhóm",
        body: `${actorName} đã mời bạn ra khỏi nhóm "${roomName}".`,
        data: {
          screen: "Connect",
          tab: "team",
          mode: "group",
          roomId: String(room._id),
          action: "kicked_self",
          kickedUserId: String(removedId),
        },
      });

      // (c) Thông báo cho các thành viên còn lại
      for (const toId of remainIds) {
        if (String(toId) === String(userId)) continue; // không notify cho người kick

        await notifySafe({
          to: String(toId),
          from: String(userId),
          type: "group_member_kicked",
          title: "Thành viên đã bị mời ra khỏi nhóm",
          body: `${removedName} đã bị ${actorName} mời ra khỏi nhóm "${roomName}".`,
          data: {
            screen: "Connect",
            tab: "team",
            mode: "group",
            roomId: String(room._id),
            action: "kicked",
            kickedUserId: String(removedId),
          },
        });
      }
    }

    const populated = await MatchRoom.findById(roomId)
      .populate({
        path: "members.user",
        select:
          "username email profile.nickname profile.avatarUrl profile.sex profile.dob connectGoalKey connectGoalLabel profile.goal profile.trainingIntensity",
      })
      .lean();

    return responseOk(res, populated);
  } catch (err) {
    next(err);
  }
}

// GET /api/match/rooms/:id/streaks
export async function getRoomStreaks(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const { id: roomId } = req.params;

    const room = await MatchRoom.findById(roomId)
      .populate({ path: "members.user", select: "username email profile.nickname profile.avatarUrl" })
      .lean();
    if (!room)
      return res.status(404).json({ success: false, message: "Không tìm thấy phòng kết nối" });
    if (!["group", "duo"].includes(room.type))
      return res.status(400).json({ success: false, message: "Phòng này không hỗ trợ streak" });

    const isMember = (room.members || []).some((m) => {
      const u = m.user || {};
      const uid = u._id || u.id || u;
      return String(uid) === String(userId);
    });
    if (!isMember)
      return res.status(403).json({ success: false, message: "Bạn không thuộc phòng này." });

    const today = dayjs().startOf("day");
    const out = await Promise.all(
      (room.members || []).map(async (m) => {
        const u = m.user || {};
        const uid = u._id || u.id || u;
        const name = u?.profile?.nickname || u?.username || u?.email || "Người dùng FitMatch";
        const avatarUrl = u?.profile?.avatarUrl || null;

        const joinedAt = m?.joinedAt || room.createdAt || new Date();
        const joinDay = dayjs(joinedAt).startOf("day");
        const joinISO = joinDay.format("YYYY-MM-DD");

        const dates = await NutritionLog.distinct("date", { user: uid, date: { $gte: joinISO } });
        const set = new Set((dates || []).map(String));

        let current = 0;
        for (let d = today; !d.isBefore(joinDay, "day"); d = d.subtract(1, "day")) {
          const iso = d.format("YYYY-MM-DD");
          if (set.has(iso)) current++;
          else break;
        }

        let best = 0,
          run = 0;
        for (let d = joinDay; !d.isAfter(today, "day"); d = d.add(1, "day")) {
          const iso = d.format("YYYY-MM-DD");
          if (set.has(iso)) {
            run++;
            if (run > best) best = run;
          } else run = 0;
        }

        return {
          id: String(uid),
          name,
          avatarUrl,
          role: m?.role || "member",
          joinedAt,
          hasToday: set.has(today.format("YYYY-MM-DD")),
          currentStreak: Number(current || 0),
          bestStreak: Number(best || 0),
        };
      })
    );

    const maxBest = out.reduce((mx, x) => Math.max(mx, Number(x?.bestStreak || 0)), 0);
    return responseOk(res, {
      roomId: String(room._id),
      roomType: room.type,
      members: out,
      maxBest,
      today: today.format("YYYY-MM-DD"),
    });
  } catch (err) {
    next(err);
  }
}

const REPORT_REASONS = ["spam", "scam", "harassment", "inappropriate", "fake", "other"];

const isAdminRole = (req) =>
  String(req?.userRole || "").startsWith("admin") || String(req?.userRoleRaw || "") === "admin";

function buildUserReportSnapshot(u) {
  const profile = u?.profile || {};
  const goalKey = u?.connectGoalKey || profile?.goal || null;
  const goalLabel = u?.connectGoalLabel || goalLabelFromKey(goalKey) || "";
  const nickname = profile?.nickname || u?.username || u?.email || "Người dùng FitMatch";
  const avatarUrl = profile?.avatarUrl || null;
  const locationLabel = u?.connectLocationLabel || buildFullLocationLabel(profile) || "";
  return { targetType: "user", id: String(u?._id || ""), nickname, avatarUrl, goalKey, goalLabel, locationLabel };
}

function buildGroupReportSnapshot(r) {
  return {
    targetType: "group",
    id: String(r?._id || ""),
    name: r?.name || "Nhóm tập luyện",
    coverImageUrl: r?.coverImageUrl || null,
    locationLabel: r?.locationLabel || "",
    goalKey: r?.goalKey || null,
    goalLabel: r?.goalLabel || goalLabelFromKey(r?.goalKey) || "",
    maxMembers: r?.maxMembers || 5,
    membersCount: (r?.members || []).length || 0,
    joinPolicy: r?.joinPolicy || "request",
    createdBy: r?.createdBy ? String(r.createdBy) : null,
  };
}

// POST /api/match/reports
export async function createConnectReport(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });

    const body = req.body || {};
    const targetType = String(body.targetType || "").trim();
    const targetUserId = body.targetUserId ? String(body.targetUserId).trim() : null;
    const targetRoomId = body.targetRoomId ? String(body.targetRoomId).trim() : null;

    const reasonsRaw = Array.isArray(body.reasons) ? body.reasons : [];
    const reasons = [...new Set(reasonsRaw.map((x) => String(x || "").trim()).filter(Boolean))].filter((x) =>
      REPORT_REASONS.includes(x)
    );
    const otherReason = String(body.otherReason || "").trim();
    const note = String(body.note || "").trim();

    if (!["user", "group"].includes(targetType))
      return res.status(400).json({ ok: false, error: "invalid_targetType", message: "TargetType không hợp lệ." });
    if (targetType === "user" && !targetUserId)
      return res.status(400).json({ ok: false, error: "missing_targetUserId", message: "Thiếu targetUserId." });
    if (targetType === "group" && !targetRoomId)
      return res.status(400).json({ ok: false, error: "missing_targetRoomId", message: "Thiếu targetRoomId." });

    if (!reasons.length && !otherReason)
      return res.status(400).json({ ok: false, error: "missing_reasons", message: "Vui lòng chọn ít nhất 1 lý do hoặc nhập lý do khác." });
    if (otherReason && otherReason.length > 200)
      return res.status(400).json({ ok: false, error: "other_too_long", message: "Lý do khác tối đa 200 ký tự." });
    if (note && note.length > 500)
      return res.status(400).json({ ok: false, error: "note_too_long", message: "Ghi chú tối đa 500 ký tự." });

    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    let targetUser = null,
      targetRoom = null,
      snapshot = null;

    if (targetType === "user") {
      if (String(targetUserId) === String(userId))
        return res.status(400).json({ ok: false, error: "cannot_report_self", message: "Bạn không thể báo cáo chính mình." });

      targetUser = await User.findById(targetUserId)
        .select("username email role profile.nickname profile.avatarUrl profile.address profile.goal connectGoalKey connectGoalLabel connectLocationLabel")
        .lean();
      if (!targetUser)
        return res.status(404).json({ ok: false, error: "user_not_found", message: "Không tìm thấy người dùng bị báo cáo." });

      const existed = await ConnectReport.findOne({ reporter: userId, targetType: "user", targetUser: targetUserId, createdAt: { $gte: since } }).lean();
      if (existed) return responseOk(res, { report: existed, duplicated: true });

      snapshot = buildUserReportSnapshot(targetUser);
    } else {
      targetRoom = await MatchRoom.findById(targetRoomId)
        .select("type name coverImageUrl locationLabel goalKey goalLabel members maxMembers joinPolicy createdBy")
        .lean();
      if (!targetRoom || targetRoom.type !== "group")
        return res.status(404).json({ ok: false, error: "room_not_found", message: "Không tìm thấy nhóm bị báo cáo." });

      const existed = await ConnectReport.findOne({ reporter: userId, targetType: "group", targetRoom: targetRoomId, createdAt: { $gte: since } }).lean();
      if (existed) return responseOk(res, { report: existed, duplicated: true });

      snapshot = buildGroupReportSnapshot(targetRoom);
    }

    const doc = await ConnectReport.create({
      reporter: userId,
      targetType,
      targetUser: targetType === "user" ? targetUserId : null,
      targetRoom: targetType === "group" ? targetRoomId : null,
      reasons,
      otherReason,
      note,
      snapshot,
      status: "pending",
    });

    return responseOk(res, { report: doc });
  } catch (err) {
    next(err);
  }
}

// GET /api/match/reports/admin
export async function listConnectReportsAdmin(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!isAdminRole(req))
      return res.status(403).json({ success: false, message: "Chỉ admin mới xem được báo cáo." });

    const q = req.query || {};
    const status = String(q.status || "").trim();
    const type = String(q.type || "").trim();
    const search = String(q.search || "").trim();

    const targetUserId = String(q.targetUserId || "").trim();
    const targetRoomId = String(q.targetRoomId || "").trim();
    const isObjectIdLike = (s = "") => /^[0-9a-fA-F]{24}$/.test(String(s || "").trim());

    const page = Math.max(1, parseIntSafe(q.page) || 1);
    const limit = Math.min(50, Math.max(1, parseIntSafe(q.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (["pending", "reviewed", "dismissed"].includes(status)) filter.status = status;
    if (["user", "group"].includes(type)) filter.targetType = type;

    if (targetUserId && isObjectIdLike(targetUserId)) filter.targetUser = targetUserId;
    if (targetRoomId && isObjectIdLike(targetRoomId)) filter.targetRoom = targetRoomId;

    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { otherReason: rx },
        { note: rx },
        { adminNote: rx },
        { "snapshot.nickname": rx },
        { "snapshot.name": rx },
        { "snapshot.locationLabel": rx },
      ];
    }

    const [total, items] = await Promise.all([
      ConnectReport.countDocuments(filter),
      ConnectReport.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: "reporter", select: "username email profile.nickname profile.avatarUrl role" })
        .populate({ path: "targetUser", select: "username email profile.nickname profile.avatarUrl role" })
        .populate({ path: "targetRoom", select: "name coverImageUrl locationLabel goalLabel goalKey members maxMembers joinPolicy status type" })
        .lean(),
    ]);

    return responseOk(res, { items, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/match/reports/:id/admin
export async function updateConnectReportAdmin(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!isAdminRole(req))
      return res.status(403).json({ success: false, message: "Chỉ admin mới cập nhật được báo cáo." });

    const { id } = req.params;
    const body = req.body || {};
    const status = body.status != null ? String(body.status).trim() : null;
    const adminNote = body.adminNote != null ? String(body.adminNote).trim() : "";

    const doc = await ConnectReport.findById(id);
    if (!doc)
      return res.status(404).json({ success: false, message: "Không tìm thấy báo cáo." });

    if (status != null) {
      if (!["pending", "reviewed", "dismissed"].includes(status))
        return res.status(400).json({ success: false, message: "Status không hợp lệ." });
      doc.status = status;
      doc.resolvedAt = status === "pending" ? null : doc.resolvedAt || new Date();
    }
    doc.adminNote = adminNote || doc.adminNote || "";
    await doc.save();

    return responseOk(res, { report: doc });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/match/reports/:id/admin
export async function deleteConnectReportAdmin(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!isAdminRole(req))
      return res.status(403).json({ success: false, message: "Chỉ admin mới xóa được báo cáo." });

    const { id } = req.params;
    const doc = await ConnectReport.findById(id).select("_id").lean();
    if (!doc)
      return res.status(404).json({ success: false, message: "Không tìm thấy báo cáo." });

    await ConnectReport.deleteOne({ _id: id });
    return responseOk(res, { deletedId: String(id) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/match/reports/admin  (body: { ids:[] })
export async function deleteManyConnectReportsAdmin(req, res, next) {
  try {
    const userId = getUserIdFromReq(req);
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!isAdminRole(req))
      return res.status(403).json({ success: false, message: "Chỉ admin mới xóa được báo cáo." });

    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((x) => String(x || "")).filter(Boolean) : [];
    if (!ids.length)
      return res.status(400).json({ success: false, message: "Thiếu danh sách ids." });

    const rs = await ConnectReport.deleteMany({ _id: { $in: ids } });
    return responseOk(res, { deletedCount: Number(rs?.deletedCount || 0), ids });
  } catch (err) {
    next(err);
  }
}
