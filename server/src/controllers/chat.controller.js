import mongoose from "mongoose";
import ChatMessage from "../models/ChatMessage.js";
import MatchRoom from "../models/MatchRoom.js";
import ChatConversation from "../models/ChatConversation.js";
import { User } from "../models/User.js"; // giữ đúng như bạn đang dùng
import { responseOk } from "../utils/response.js";
import { uploadImageWithResize } from "../utils/cloudinary.js";

const uidFromReq = (req) => String(req?.userId || req?.user?._id || "");
const asOid = (v) => {
  try { return new mongoose.Types.ObjectId(String(v)); } catch { return null; }
};
const safeArr = (v) => (Array.isArray(v) ? v : []);
const pick = (...v) => v.find((x) => x !== undefined && x !== null && x !== "");

// ✅ normalize ObjectId from value | populated obj
const oidOf = (x) => {
  if (!x) return null;
  if (x instanceof mongoose.Types.ObjectId) return x;
  if (x?._id) return asOid(x._id);
  return asOid(x);
};

const getUnreadOf = (conv, uid) => {
  if (!conv || !uid) return 0;
  const m = conv.unreadBy;
  if (!m) return 0;
  if (typeof m.get === "function") return Number(m.get(String(uid)) || 0);
  return Number(m[String(uid)] || 0);
};

const lastTextFrom = (text, attachments) => {
  const t = String(text || "").trim();
  if (t) return t;
  const at = safeArr(attachments);
  if (!at.length) return "";
  const img = at.find((x) => String(x?.type || "image") === "image" && x?.url);
  if (img) return "[Ảnh]";
  return "[Tệp]";
};

const buildLastMessageFromMsg = (msg) => {
  if (!msg) return null;
  const deleted = !!msg.deletedAt;
  const text = deleted ? "[Tin nhắn đã thu hồi]" : lastTextFrom(msg.content, msg.attachments);
  return {
    text,
    senderId: msg.senderId,
    createdAt: msg.createdAt,
  };
};

async function ensureMember(conversationId, uid) {
  const room = await MatchRoom.findById(conversationId).lean();
  if (!room) throw Object.assign(new Error("Room not found"), { status: 404 });
  const members = (room.members || []).map((m) => String(m?.user?._id || m?.user || ""));
  if (!members.includes(String(uid))) throw Object.assign(new Error("Forbidden"), { status: 403 });
  return room;
}

// ✅ upsert conv, members normalize
async function upsertConversationFromRoom(room){
  if(!room?._id) return;

  const members = safeArr(room.members)
    .map((m) => oidOf(m?.user))
    .filter(Boolean);

  const type =
  room.type === "group" ? "group" :
  room.type === "dm"    ? "dm" :
  "duo";

  await ChatConversation.updateOne(
    { _id: room._id },
    {
      $set: { type, members },
      $setOnInsert: { createdAt: new Date(), unreadBy: {} },
    },
    { upsert: true }
  );

  // ✅ return latest conv for caller (optional)
  return ChatConversation.findById(room._id)
    .select("type lastMessage lastMessageAt unreadBy members")
    .lean();
}

// =========================
// GET /api/chat/conversations/:id/messages?limit=50&before=ISO
// =========================
export async function getMessages(req, res) {
  const uid = String(req?.userId || req?.user?._id || "");
  const conversationId = String(req?.params?.id || "");
  await ensureMember(conversationId, uid);

  const cid = asOid(conversationId);
  const uidOid = asOid(uid);

  const q = { conversationId: cid };
  if (uidOid) q.hiddenFor = { $nin: [uidOid] };

  const items = await ChatMessage.find(q)
    .sort({ createdAt: 1 })
    .limit(Math.min(Number(req.query?.limit || 80), 200));

  return responseOk(res, { items });
}

// =========================
// POST /api/chat/conversations/:id/images
// =========================
export async function uploadChatImage(req, res, next) {
  try {
    const uid = uidFromReq(req);
    const { id } = req.params;
    const room = await ensureMember(id, uid);

    // ✅ chặn upload ảnh nếu DM private và chưa có message nào
    if (String(room?.type || "") === "dm") {
      const members = (room.members || [])
        .map((m) => String(m?.user?._id || m?.user || ""))
        .filter(Boolean);

      const otherId = members.find((x) => x !== String(uid));
      if (otherId) {
        const other = await User.findById(otherId)
          .select("profile.chatRequest")
          .lean()
          .catch(() => null);

        const setting = String(other?.profile?.chatRequest || "all").toLowerCase();
        if (setting === "private") {
          const hasAnyMessage = await ChatMessage.exists({ conversationId: room._id });
          if (!hasAnyMessage) {
            return res.status(403).json({
              success: false,
              message: "Người này hiện không nhận tin nhắn từ người lạ",
              lockReason: "private_stranger",
            });
          }
        }
      }
    }

    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: "Không có ảnh" });

    const url = await uploadImageWithResize(
      file.buffer,
      "asset/folder/chat_images",
      { width: 2048, height: 2048, fit: "inside" },
      { quality: 85 }
    );

    return responseOk(res, {
      type: "image",
      url,
      name: file.originalname || "",
      size: file.size || 0,
    });
  } catch (e) {
    next(e);
  }
}

// =========================
// GET /api/chat/conversations/:id/summary
// =========================
export async function getConversationSummary(req, res, next) {
  try {
    const uid = uidFromReq(req);
    const uidOid = asOid(uid);
    const { id } = req.params;

    await ensureMember(id, uid);

    let conv = await ChatConversation.findById(id)
      .select("type lastMessage lastMessageAt unreadBy")
      .lean();

    if (!conv) {
      const room = await MatchRoom.findById(id).lean();
      if (room) {
        await upsertConversationFromRoom(room);
        conv = await ChatConversation.findById(id)
          .select("type lastMessage lastMessageAt unreadBy")
          .lean();
      }
    }

    // ✅ last message theo user (lọc hiddenFor)
    const cid = asOid(id);
    const q = { conversationId: cid };
    if (uidOid) q.hiddenFor = { $nin: [uidOid] };

    const lastVisible = await ChatMessage.findOne(q)
      .sort({ createdAt: -1 })
      .select("_id senderId content attachments createdAt deletedAt")
      .lean();

    const lastMessage = buildLastMessageFromMsg(lastVisible) || null;
    const lastMessageAt = lastVisible?.createdAt || null;

    const unread = getUnreadOf(conv, uid);

    return responseOk(res, {
      conversationId: id,
      unread,
      type: conv?.type || null,
      lastMessage,
      lastMessageAt,
    });
  } catch (e) {
    next(e);
  }
}

// ===================================================
// DM: GET /api/chat/dm/conversations
// ===================================================
export async function listDmConversations(req, res, next) {
  try {
    const uid = uidFromReq(req);
    const uidOid = asOid(uid);
    if (!uidOid) throw Object.assign(new Error("UNAUTHORIZED"), { status: 401 });

    const rooms = await MatchRoom.find({
      type: "dm",
      $or: [{ "members.user": uidOid }, { "members.user._id": uidOid }],
      status: { $ne: "closed" },
    })
      .select("_id members updatedAt createdAt")
      .lean();

    const roomIds = rooms.map((r) => r._id);
    if (!roomIds.length) return responseOk(res, { items: [] });

    const convs = await ChatConversation.find({ _id: { $in: roomIds } })
      .select("_id unreadBy")
      .lean();
    const convMap = new Map(convs.map((c) => [String(c._id), c]));

    // ✅ last message (lọc hiddenFor) để render preview đúng theo user
    const lastAgg = await ChatMessage.aggregate([
      {
        $match: {
          conversationId: { $in: roomIds },
          hiddenFor: { $nin: [uidOid] },
        },
      },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$conversationId", doc: { $first: "$$ROOT" } } },
      {
        $project: {
          _id: 0,
          conversationId: "$_id",
          senderId: "$doc.senderId",
          content: "$doc.content",
          attachments: "$doc.attachments",
          createdAt: "$doc.createdAt",
          deletedAt: "$doc.deletedAt",
        },
      },
    ]);
    const lastMap = new Map(lastAgg.map((x) => [String(x.conversationId), x]));

    // ✅ stats: có message chưa? ai đã gửi?
    const statsAgg = await ChatMessage.aggregate([
      { $match: { conversationId: { $in: roomIds } } },
      {
        $group: {
          _id: "$conversationId",
          count: { $sum: 1 },
          meSent: {
            $max: { $cond: [{ $eq: ["$senderId", uidOid] }, 1, 0] },
          },
          otherSent: {
            $max: { $cond: [{ $ne: ["$senderId", uidOid] }, 1, 0] },
          },
        },
      },
    ]);
    const statsMap = new Map(statsAgg.map((x) => [String(x._id), x]));

    // peerIds unique
    const peerIds = [
      ...new Set(
        rooms
          .map((r) => {
            const ms = safeArr(r.members);
            const peer = ms.find((m) => String(m?.user?._id || m?.user || "") !== String(uidOid));
            return String(peer?.user?._id || peer?.user || "");
          })
          .filter(Boolean)
      ),
    ];

    const peers = await User.find({ _id: { $in: peerIds.map(asOid).filter(Boolean) } })
      .select("_id email profile.nickname profile.avatarUrl profile.avatar profile.address profile.chatRequest")
      .lean();
    const peerMap = new Map(peers.map((u) => [String(u._id), u]));

    const items = rooms
      .map((r) => {
        const sid = String(r._id);
        const stats = statsMap.get(sid);
        const lastVisible = lastMap.get(sid);

        // ✅ quan trọng:
        // - không có tin nhắn => không trả về sidebar
        // - hoặc user đã hidden hết => không có lastVisible => cũng không trả về
        if (!stats || !stats.count || !lastVisible) return null;

        const ms = safeArr(r.members);
        const peer = ms.find((m) => String(m?.user?._id || m?.user || "") !== String(uidOid));
        const peerId = String(peer?.user?._id || peer?.user || "");
        if (!peerId) return null;

        const conv = convMap.get(sid) || null;

        const lastMessage = buildLastMessageFromMsg(lastVisible);
        const lastAt = lastVisible.createdAt;

        return {
          _id: r._id,
          peer: peerMap.get(peerId) || { _id: peerId },
          lastMessage,
          lastMessageAt: lastAt,
          unread: getUnreadOf(conv, uid),
          type: "dm",
          meSent: stats.meSent === 1,
          otherSent: stats.otherSent === 1,
        };
      })
      .filter(Boolean);

    items.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));

    return responseOk(res, { items });
  } catch (e) {
    next(e);
  }
}

// ===================================================
// DM: POST /api/chat/dm/conversations  { userId }
// ===================================================
export async function createOrGetDmConversation(req, res, next) {
  try {
    const uid = uidFromReq(req);
    const uidOid = asOid(uid);
    if (!uidOid) return res.status(401).json({ success: false, message: "UNAUTHORIZED" });

    const targetId = String(req.body?.userId || "").trim();
    const targetOid = asOid(targetId);
    if (!targetOid) return res.status(400).json({ success: false, message: "Invalid userId" });
    if (String(targetOid) === String(uidOid))
      return res.status(400).json({ success: false, message: "Bạn không thể nhắn tin cho chính mình." });

    // ✅ lấy peer info luôn để FE render header ngay
    const target = await User.findById(targetOid)
      .select("_id email profile.nickname profile.avatarUrl profile.avatar profile.address profile.chatRequest")
      .lean();
    if (!target) return res.status(404).json({ success: false, message: "User not found" });

    let room = await MatchRoom.findOne({
      type: "dm",
      status: { $ne: "closed" },
      $and: [
        { $or: [{ "members.user": uidOid }, { "members.user._id": uidOid }] },
        { $or: [{ "members.user": targetOid }, { "members.user._id": targetOid }] },
      ],
    })
      .select("_id type members")
      .lean();

    if (!room) {
      const created = await MatchRoom.create({
        type: "dm",
        createdBy: uidOid,
        maxMembers: 2, 
        members: [
          { user: uidOid, role: "owner" },
          { user: targetOid, role: "member" },
        ],
      });
      room = created.toObject();
    }

    // ✅ upsert ChatConversation (type: "duo" đúng enum của ChatConversation)
    const members = safeArr(room.members)
      .map((m) => (m?.user?._id ? asOid(m.user._id) : asOid(m?.user)))
      .filter(Boolean);

    await ChatConversation.updateOne(
      { _id: room._id },
      { $set: { type: "dm", members }, $setOnInsert: { unreadBy: {} } },
      { upsert: true }
    );

    // ✅ DM privacy check: nếu peer bật private thì chỉ cho nhắn khi conversation đã từng có message
    const peerSetting = String(target?.profile?.chatRequest || "all"); // default all
    let canSend = true;
    let lockReason = null;

    if (peerSetting === "private") {
      const hasAnyMessage = await ChatMessage.exists({ conversationId: room._id });
      canSend = !!hasAnyMessage;
      if (!canSend) lockReason = "private_stranger";
    }

    return responseOk(res, {
      _id: room._id,
      id: room._id,
      type: "dm",
      peer: target,
      canSend,
      lockReason,
    });
  } catch (e) {
    if (e?.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message:
          Object.values(e.errors || {})
            .map((x) => x?.message)
            .filter(Boolean)
            .join(" | ") || "ValidationError",
      });
    }
    next(e);
  }
}

// ===================================================
// DM: GET /api/chat/dm/search-users?q=...
// ===================================================
export async function searchDmUsers(req, res, next) {
  try {
    const uid = uidFromReq(req);
    const uidOid = asOid(uid);
    if (!uidOid) throw Object.assign(new Error("UNAUTHORIZED"), { status: 401 });

    const q = String(req.query?.q || "").trim();
    if (!q) return responseOk(res, []);

    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

    const users = await User.find({
      _id: { $ne: uidOid },
      $or: [{ "profile.nickname": rx }, { email: rx }],
    })
      .select("_id email profile.nickname profile.avatarUrl profile.avatar profile.address profile.chatRequest")
      .limit(20)
      .lean();

    return responseOk(res, { items: users });
  } catch (e) {
    next(e);
  }
}


export async function getSharedTeam(req, res, next) {
  try {
    const uid = uidFromReq(req);
    const uidOid = asOid(uid);
    if (!uidOid) throw Object.assign(new Error("UNAUTHORIZED"), { status: 401 });

    const otherId = String(req.query?.userId || "").trim();
    const otherOid = asOid(otherId);
    if (!otherOid) return responseOk(res, { shared: false, room: null });
    if (String(otherOid) === String(uidOid)) return responseOk(res, { shared: false, room: null });

    // tìm 1 nhóm mà cả 2 cùng tham gia (ưu tiên mới nhất)
    const room = await MatchRoom.findOne({
      type: { $in: ["group", "team"] },
      status: { $ne: "closed" },
      $and: [
        { $or: [{ "members.user": uidOid }, { "members.user._id": uidOid }] },
        { $or: [{ "members.user": otherOid }, { "members.user._id": otherOid }] },
      ],
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .select("_id name teamName title roomName groupName")
      .lean();

    const name =
      (room && (room.name || room.teamName || room.title || room.roomName || room.groupName)) || "";

    return responseOk(res, {
      shared: !!room,
      room: room ? { _id: room._id, name: name || "Nhóm" } : null,
    });
  } catch (e) {
    next(e);
  }
}

// DM: DELETE /api/chat/dm/conversations/:id
// => chỉ xóa ở phía tôi bằng cách hidden all messages for me
export async function deleteDmConversation(req, res, next) {
  try {
    const uid = uidFromReq(req);
    const uidOid = asOid(uid);
    if (!uidOid) throw Object.assign(new Error("UNAUTHORIZED"), { status: 401 });

    const conversationId = String(req.params?.id || "").trim();
    const cid = asOid(conversationId);
    if (!cid) throw Object.assign(new Error("Invalid conversationId"), { status: 400 });

    const room = await ensureMember(conversationId, uid);

    // chỉ cho DM
    if (String(room?.type || "") !== "dm") {
      throw Object.assign(new Error("Chỉ hỗ trợ xóa đoạn chat DM."), { status: 400 });
    }

    // ✅ 1) Ẩn toàn bộ message trong conversation đối với user hiện tại
    await ChatMessage.updateMany(
      { conversationId: cid },
      { $addToSet: { hiddenFor: uidOid } }
    );

    // ✅ 2) Reset unread của user về 0 (để không còn badge)
    await ChatConversation.updateOne(
      { _id: cid },
      { $set: { [`unreadBy.${String(uidOid)}`]: 0 } }
    );

    // Không xóa ChatConversation, không xóa DB messages
    return responseOk(res, {
      deletedForMe: true,
      conversationId,
    });
  } catch (e) {
    next(e);
  }
}