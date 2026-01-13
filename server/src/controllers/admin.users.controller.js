// server/src/controllers/admin.users.controller.js
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { OnboardingProfile } from "../models/OnboardingProfile.js";
import MatchRoom from "../models/MatchRoom.js";
import ChatConversation from "../models/ChatConversation.js";
import Notification from "../models/Notification.js";
import { getIO } from "../realtime/io.js";
import { responseOk } from "../utils/response.js";

/* ===================== Helpers ===================== */
const safeArr = (v) => (Array.isArray(v) ? v : []);
const pick = (...v) => v.find((x) => x !== undefined && x !== null && x !== "");

const uidFromReq = (req) =>
  String(pick(req?.adminId, req?.userId, req?.user?._id, req?.user?.id) || "");

const asOid = (v) => {
  try {
    return new mongoose.Types.ObjectId(String(v));
  } catch {
    return null;
  }
};

class HttpError extends Error {
  constructor(status = 400, message = "Bad request", extra = null) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const roomMemberIds = (room) => {
  const mem = safeArr(room?.members);
  const ids = mem
    .map((m) => String(m?.user?._id || m?.user || m?._id || m || ""))
    .filter(Boolean);
  return Array.from(new Set(ids));
};

const roomOwnerId = (room) => {
  const createdBy = room?.createdBy?._id || room?.createdBy;
  if (createdBy) return String(createdBy);

  const mem = safeArr(room?.members);
  const owner = mem.find((m) => String(m?.role || "").toLowerCase() === "owner");
  return String(owner?.user?._id || owner?.user || "");
};

const isOwnerMember = (room, uid) => {
  const mem = safeArr(room?.members);
  return mem.some((m) => {
    const id = String(m?.user?._id || m?.user || "");
    const role = String(m?.role || "").toLowerCase();
    return id && id === String(uid) && role === "owner";
  });
};

async function setConnectDiscoverable(userOid, value, session) {
  // update User (nếu field có)
  await User.updateOne(
    { _id: userOid },
    { $set: { connectDiscoverable: !!value } },
    { session }
  ).catch(() => {});

  // update OnboardingProfile (thường đặt ở đây)
  await OnboardingProfile.updateOne(
    { user: userOid },
    { $set: { connectDiscoverable: !!value } },
    { session }
  ).catch(() => {});
}

async function kickUserOutOfRoomAndSync(roomId, targetOid, session) {
  // hỗ trợ cả schema:
  // - members: [ObjectId]
  // - members: [{ user: ObjectId, role, ... }]
  await MatchRoom.updateOne(
    { _id: roomId },
    { $pull: { members: targetOid } },
    { session }
  ).catch(() => {});
  await MatchRoom.updateOne(
    { _id: roomId },
    { $pull: { members: { user: targetOid } } },
    { session }
  ).catch(() => {});

  // ChatConversation (tuỳ DB bạn dùng, cố gắng pull đa dạng key)
  await ChatConversation.updateMany(
    {
      $or: [{ _id: roomId }, { roomId }, { matchRoom: roomId }],
    },
    { $pull: { members: targetOid } },
    { session }
  ).catch(() => {});

  // sync status cho group room
  const room = await MatchRoom.findById(roomId)
    .select("type members maxMembers capacity status closedAt")
    .session(session)
    .lean()
    .catch(() => null);

  if (!room || String(room.type) !== "group") return room;

  const cnt = safeArr(room.members).length;
  const max = Number(room.maxMembers || room.capacity || 5);

  const patch = {};
  if (cnt === 0) {
    patch.status = "closed";
    patch.closedAt = room.closedAt || new Date();
  } else if (cnt >= max) {
    patch.status = "full";
    patch.closedAt = room.closedAt || new Date();
  } else {
    patch.status = "active";
    patch.closedAt = null;
  }

  await MatchRoom.updateOne({ _id: roomId }, { $set: patch }, { session }).catch(
    () => {}
  );
  return room;
}

async function notifySafe(payload, session, emitQueue) {
  // payload: {to, from, type, title, body, data}
  const toOid = asOid(payload?.to);
  if (!toOid) return null;

  const fromOid = asOid(payload?.from); // có thể null (nếu adminId không phải ObjectId)
  const doc = {
    to: toOid,
    from: fromOid || undefined,
    type: String(payload?.type || "system"),
    title: String(payload?.title || ""),
    body: String(payload?.body || ""),
    data: payload?.data || {},
    isRead: false,
  };

  const createdArr = await Notification.create([doc], { session }).catch(
    () => null
  );
  const created = Array.isArray(createdArr) ? createdArr[0] : createdArr;

  if (created && emitQueue) {
    emitQueue.push({ to: String(payload.to), notification: created });
  }
  return created;
}

/* ===================== Controllers ===================== */

// (Tuỳ bạn dùng) list users đơn giản cho admin
export async function adminListUsers(req, res) {
  try {
    const q = String(req.query.q || "").trim();
    const blocked = req.query.blocked;
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 50);
    const skip = (page - 1) * limit;

    const filter = { role: "user" };
    if (blocked === "true") filter.blocked = true;
    if (blocked === "false") filter.blocked = false;

    if (q) {
      filter.$or = [
        { email: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
        { username: { $regex: q, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    return responseOk(res, {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e?.message || "Server error" });
  }
}

export async function adminGetUser(req, res) {
  try {
    const id = asOid(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "Invalid user id" });

    const user = await User.findById(id).lean();
    if (!user) return res.status(404).json({ ok: false, message: "User not found" });

    const profile = await OnboardingProfile.findOne({ user: id }).lean().catch(() => null);

    return responseOk(res, { user, profile });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e?.message || "Server error" });
  }
}

/**
 * BLOCK USER:
 * - set blocked=true
 * - set connectDiscoverable=false
 * - kick ra khỏi các group rooms (nhưng CHẶN nếu user là owner)
 * - notify:
 *    + members còn lại: group_member_removed_by_admin (kèm kickedUserId + action=member_removed)
 *    + người bị kick: you_removed_by_admin (kèm kickedUserId + action=kicked_self)
 */
export async function adminBlockUser(req, res) {
  const adminId = uidFromReq(req);
  const targetId = String(pick(req.params.id, req.body.userId, req.body.id) || "");
  const reason = String(pick(req.body.reason, req.body.blockReason, req.body.note) || "").trim();

  const targetOid = asOid(targetId);
  if (!targetOid) return res.status(400).json({ ok: false, message: "Invalid user id" });

  const session = await mongoose.startSession();
  const emitQueue = [];
  let committed = false;

  try {
    session.startTransaction();

    const target = await User.findById(targetOid).session(session);
    if (!target) throw new HttpError(404, "User not found");

    // nếu bạn cho phép block admin thì bỏ đoạn này
    if (String(target.role || "").toLowerCase() === "admin") {
      throw new HttpError(400, "Không thể khóa tài khoản admin");
    }

    // lấy danh sách group rooms mà user đang là member
    const groupRooms = await MatchRoom.find({
      type: "group",
      $or: [{ "members.user": targetOid }, { members: targetOid }],
    })
      .select("_id name title members createdBy maxMembers capacity status closedAt type")
      .session(session)
      .lean();

    // chặn nếu user là owner nhóm
    const ownerRooms = groupRooms.filter((rm) => {
      const byCreatedBy = String(roomOwnerId(rm)) === String(targetOid);
      const byRole = isOwnerMember(rm, targetOid);
      return byCreatedBy || byRole;
    });

    if (ownerRooms.length) {
      const names = ownerRooms
        .map((x) => x?.name || x?.title || String(x?._id).slice(-6))
        .slice(0, 5);
      throw new HttpError(
        400,
        `Không thể khóa: user đang là chủ nhóm (${names.join(", ")}). Hãy chuyển quyền chủ nhóm trước.`,
        { ownerRooms: ownerRooms.map((x) => String(x._id)) }
      );
    }

    const targetName = String(
      pick(target?.name, target?.username, target?.email, "Người dùng") || "Người dùng"
    );

    // kick khỏi từng group room + gửi noti
    for (const rm of groupRooms) {
      const memberIds = roomMemberIds(rm);
      const targetIdStr = String(targetOid);

      if (!memberIds.includes(targetIdStr)) continue;

      await kickUserOutOfRoomAndSync(rm._id, targetOid, session);

      const roomName = rm?.name || rm?.title || `Nhóm #${String(rm._id).slice(-6)}`;
      const others = memberIds.filter((x) => x && x !== targetIdStr);

      // 1) notify members còn lại (chỉ thông báo)
      for (const toId of others) {
        await notifySafe(
          {
            to: String(toId),
            from: adminId,
            type: "group_member_removed_by_admin",
            title: "Thành viên bị buộc rời nhóm",
            body: `${targetName} đã bị admin FitMatch yêu cầu rời khỏi nhóm "${roomName}".`,
            data: {
              roomId: String(rm._id),
              kickedUserId: targetIdStr, // ✅ cực quan trọng để FE không auto-leave nhầm
              action: "member_removed",
              reason,
              by: "admin",
            },
          },
          session,
          emitQueue
        );
      }

      // 2) notify chính người bị kick
      await notifySafe(
        {
          to: targetIdStr,
          from: adminId,
          type: "you_removed_by_admin",
          title: "Bạn đã bị buộc rời khỏi nhóm",
          body: `Bạn đã bị admin FitMatch yêu cầu rời khỏi nhóm "${roomName}".`,
          data: {
            roomId: String(rm._id),
            kickedUserId: targetIdStr,
            action: "kicked_self",
            reason,
            by: "admin",
          },
        },
        session,
        emitQueue
      );
    }

    // (tuỳ bạn) rút khỏi các room khác (duo/other) để “chết hẳn connect”
    await MatchRoom.updateMany(
      { $or: [{ "members.user": targetOid }, { members: targetOid }] },
      { $pull: { members: targetOid } },
      { session }
    ).catch(() => {});
    await MatchRoom.updateMany(
      { $or: [{ "members.user": targetOid }, { members: targetOid }] },
      { $pull: { members: { user: targetOid } } },
      { session }
    ).catch(() => {});

    // rút khỏi mọi ChatConversation (dm/group) nếu bạn đang dùng members: [ObjectId]
    await ChatConversation.updateMany(
      { members: targetOid },
      { $pull: { members: targetOid } },
      { session }
    ).catch(() => {});

    // set blocked + tắt discoverable
    await User.updateOne(
      { _id: targetOid },
      {
        $set: {
          blocked: true,
          // nếu schema bạn có field này
          connectDiscoverable: false,
          // các field dưới nếu schema strict mà không có thì sẽ bỏ qua (không sao)
          blockedReason: reason || undefined,
          blockedAt: new Date(),
          blockedBy: asOid(adminId) || undefined,
        },
      },
      { session }
    );

    await setConnectDiscoverable(targetOid, false, session);

    await session.commitTransaction();
    committed = true;
  } catch (e) {
    await session.abortTransaction().catch(() => {});
    const status = e?.status || 500;
    return res.status(status).json({
      ok: false,
      message: e?.message || "Server error",
      ...(e?.extra ? { extra: e.extra } : {}),
    });
  } finally {
    session.endSession();
  }

  // emit realtime sau commit (tránh FE fetch noti không thấy)
  if (committed) {
    try {
      const io = getIO();
      for (const x of emitQueue) {
        io.to(String(x.to)).emit("notification:new", x.notification);
      }
    } catch {
      // ignore
    }
  }

  return responseOk(res, { ok: true, message: "Blocked user successfully" });
}

export async function adminUnblockUser(req, res) {
  const adminId = uidFromReq(req);
  const targetId = String(pick(req.params.id, req.body.userId, req.body.id) || "");
  const targetOid = asOid(targetId);
  if (!targetOid) return res.status(400).json({ ok: false, message: "Invalid user id" });

  const session = await mongoose.startSession();
  let committed = false;

  try {
    session.startTransaction();

    const target = await User.findById(targetOid).session(session);
    if (!target) throw new HttpError(404, "User not found");

    await User.updateOne(
      { _id: targetOid },
      {
        $set: { blocked: false },
        $unset: { blockedReason: "", blockedAt: "", blockedBy: "" },
      },
      { session }
    );

    // ⚠️ Không tự bật lại discoverable (tránh lộ thông tin lại)
    // Nếu bạn muốn auto bật lại thì đổi false -> true
    await setConnectDiscoverable(targetOid, false, session);

    // (tuỳ bạn) gửi noti cho user
    await notifySafe(
      {
        to: String(targetOid),
        from: adminId,
        type: "you_unblocked_by_admin",
        title: "Tài khoản đã được mở khóa",
        body: "Admin FitMatch đã mở khóa tài khoản của bạn.",
        data: { action: "unblocked", by: "admin" },
      },
      session,
      null
    ).catch(() => {});

    await session.commitTransaction();
    committed = true;
  } catch (e) {
    await session.abortTransaction().catch(() => {});
    const status = e?.status || 500;
    return res.status(status).json({ ok: false, message: e?.message || "Server error" });
  } finally {
    session.endSession();
  }

  return responseOk(res, { ok: true, message: committed ? "Unblocked user successfully" : "OK" });
}
