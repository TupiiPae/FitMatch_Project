// server/src/realtime/socket.js
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import ChatMessage from "../models/ChatMessage.js";
import MatchRoom from "../models/MatchRoom.js";
import ChatConversation from "../models/ChatConversation.js";

let io = null;

const safeArr = (v) => (Array.isArray(v) ? v : []);
const normToken = (t) => (!t ? "" : String(t).replace(/^Bearer\s+/i, "").trim());
const uidFromDecoded = (d) => String(d?.id || d?._id || d?.userId || d?.sub || "");

const asOid = (v) => {
  try {
    return new mongoose.Types.ObjectId(String(v));
  } catch {
    return null;
  }
};

const roomUserIds = (roomName) => {
  const out = new Set();
  try {
    const sids = io?.sockets?.adapter?.rooms?.get(roomName);
    if (!sids) return out;
    for (const sid of sids) {
      const s = io.sockets.sockets.get(sid);
      const uid = String(s?.user?._id || "");
      if (uid) out.add(uid);
    }
  } catch {}
  return out;
};

const getUnreadOf = (conv, uid) => {
  if (!conv || !uid) return 0;
  const m = conv.unreadBy;
  if (!m) return 0;
  if (typeof m.get === "function") return Number(m.get(String(uid)) || 0);
  return Number(m[String(uid)] || 0);
};

const REACTIONS = ["like", "heart", "laugh", "sad", "angry", "wow"];
const normReaction = (x) => {
  const v = String(x || "").trim();
  if (!v) return null;
  const low = v.toLowerCase();
  if (REACTIONS.includes(low)) return low;
  const map = {
    "👍": "like",
    "❤️": "heart",
    "❤": "heart",
    "😂": "laugh",
    "😆": "laugh",
    "😮": "wow",
    "😲": "wow",
    "🤯": "wow",
    "😢": "sad",
    "😭": "sad",
    "😡": "angry",
    "😠": "angry",
  };
  return map[v] || null;
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

async function ensureMember(conversationId, uid) {
  const room = await MatchRoom.findById(conversationId).lean();
  if (!room) throw Object.assign(new Error("Room not found"), { status: 404 });

  const members = (room.members || []).map((m) => String(m?.user?._id || m?.user || ""));
  if (!members.includes(String(uid))) throw Object.assign(new Error("Forbidden"), { status: 403 });

  return room;
}

// ✅ FIX CONFLICT: KHÔNG setOnInsert unreadBy:{}
async function upsertConversationFromRoom(
  room,
  { lastText, lastSenderId, lastAt, incUnreadFor = [] } = {}
) {
  if (!room?._id) return;

  const convId = room._id;
  const type = room.type === "group" ? "group" : "duo";
  const members = (room.members || []).map((m) => m?.user?._id || m?.user).filter(Boolean);

  const $set = {
    type,
    members,
    ...(lastText != null
      ? { lastMessage: { text: lastText, senderId: lastSenderId, createdAt: lastAt } }
      : {}),
    ...(lastAt ? { lastMessageAt: lastAt } : {}),
  };

  const $inc = {};
  for (const uid of incUnreadFor) {
    if (!uid) continue;
    $inc[`unreadBy.${String(uid)}`] = 1;
  }

  await ChatConversation.updateOne(
    { _id: convId },
    {
      $set,
      ...(Object.keys($inc).length ? { $inc } : {}),
      // ✅ chỉ set field KHÔNG đụng unreadBy root
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
}

async function resetUnread(conversationId, uid) {
  await ChatConversation.updateOne(
    { _id: conversationId },
    { $set: { [`unreadBy.${String(uid)}`]: 0 } }
  );
}

async function maybeUpdateLastOnRevoke(room, conversationId, revokedMsg) {
  try {
    if (!room?._id || !revokedMsg?.createdAt) return;

    const conv = await ChatConversation.findById(conversationId)
      .select("lastMessageAt")
      .lean();

    const lastAt = conv?.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0;
    const msgAt = revokedMsg?.createdAt ? new Date(revokedMsg.createdAt).getTime() : 0;
    if (!lastAt || !msgAt || lastAt !== msgAt) return;

    await upsertConversationFromRoom(room, {
      lastText: "[Tin nhắn đã thu hồi]",
      lastSenderId: revokedMsg.senderId,
      lastAt: revokedMsg.createdAt,
    });
  } catch {}
}

async function emitConversationUpdateToAll(room, conversationId, senderUidStr, payload = {}) {
  const memberIds = (room?.members || [])
    .map((m) => String(m?.user?._id || m?.user || ""))
    .filter(Boolean);

  const conv = await ChatConversation.findById(conversationId)
    .select("unreadBy lastMessage lastMessageAt")
    .lean()
    .catch(() => null);

  for (const mId of memberIds) {
    io.to(`user:${mId}`).emit("chat:conversation_update", {
      conversationId: String(conversationId),
      lastMessage: payload.lastMessage ?? conv?.lastMessage ?? null,
      lastMessageAt: payload.lastMessageAt ?? conv?.lastMessageAt ?? null,
      unread: String(mId) === String(senderUidStr) ? 0 : getUnreadOf(conv, mId),
    });
  }
}

export function initSocket(httpServer, { corsOrigin } = {}) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigin || true, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const raw =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization ||
        socket.handshake.query?.token;

      const token = normToken(raw);
      if (!token) return next(new Error("NO_TOKEN"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const uid = uidFromDecoded(decoded);
      if (!uid) return next(new Error("UNAUTHORIZED"));

      socket.user = { _id: uid, role: decoded?.role, level: decoded?.level };
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    const uid = String(socket.user?._id || "");
    const uidOid = asOid(uid);
    if (uid) socket.join(`user:${uid}`);

    socket.on("chat:join", async ({ conversationId } = {}, ack) => {
      try {
        if (!conversationId) throw new Error("Missing conversationId");
        const room = await ensureMember(conversationId, uid);

        socket.join(`conv:${conversationId}`);

        await upsertConversationFromRoom(room, {});
        await resetUnread(conversationId, uid);

        io.to(`user:${uid}`).emit("chat:conversation_update", { conversationId, unread: 0 });

        ack?.({ ok: true });
      } catch (e) {
        ack?.({ ok: false, message: e?.message || "join failed" });
      }
    });

    socket.on("chat:leave", ({ conversationId } = {}, ack) => {
      if (conversationId) socket.leave(`conv:${conversationId}`);
      ack?.({ ok: true });
    });

    socket.on("chat:send", async ({ conversationId, clientMsgId, content, attachments = [], replyTo } = {}, ack) => {
      try {
        if (!conversationId) throw new Error("Missing conversationId");
        if (!uidOid) throw new Error("UNAUTHORIZED");

        const text = String(content || "").trim();
        const at = safeArr(attachments).filter((x) => x && x.url);
        if (!text && !at.length) throw new Error("Empty message");

        const room = await ensureMember(conversationId, uid);

        if (clientMsgId) {
          const existed = await ChatMessage.findOne({ conversationId, senderId: uidOid, clientMsgId }).lean();
          if (existed) { ack?.({ ok: true, message: existed, duplicated: true }); return; }
        }

        const replyOid = replyTo ? asOid(replyTo) : null;
        let reply = null;

        if (replyOid) {
          const ref = await ChatMessage.findOne({ _id: replyOid, conversationId })
            .select("_id senderId content attachments createdAt deletedAt")
            .lean();
          if (ref) {
            const refText = ref.deletedAt ? "[Tin nhắn đã thu hồi]" : String(ref.content || "");
            const refFirst = safeArr(ref.attachments)[0];
            reply = {
              _id: ref._id,
              senderId: ref.senderId,
              content: refText,
              attachment: refFirst
                ? { type: refFirst.type || "image", url: refFirst.url, name: refFirst.name, size: refFirst.size }
                : null,
              createdAt: ref.createdAt,
            };
          }
        }

        const msg = await ChatMessage.create({
          conversationId,
          senderId: uidOid,
          content: text,
          attachments: at,
          clientMsgId: clientMsgId || "",
          replyTo: replyOid || null,
          reply: reply || null,
        });

        const plain = msg.toObject();

        const otherIds = (room.members || [])
          .map((m) => String(m?.user?._id || m?.user || ""))
          .filter((x) => x && x !== String(uid));

        const lastText = lastTextFrom(text, at);

        const viewers = roomUserIds(`conv:${conversationId}`);
        const incUnreadFor = otherIds.filter((x) => !viewers.has(String(x)));

        await upsertConversationFromRoom(room, {
          lastText,
          lastSenderId: uidOid,
          lastAt: msg.createdAt,
          incUnreadFor,
        });

        io.to(`conv:${conversationId}`).emit("chat:new", plain);

        await emitConversationUpdateToAll(room, conversationId, uid, {
          lastMessage: { text: lastText, senderId: uid, createdAt: msg.createdAt },
          lastMessageAt: msg.createdAt,
        });

        ack?.({ ok: true, message: plain });
      } catch (e) {
        ack?.({ ok: false, message: e?.message || "send failed" });
      }
    });

    socket.on("chat:seen", async ({ conversationId, messageId } = {}, ack) => {
      try {
        if (!conversationId || !messageId) throw new Error("Missing");
        if (!uidOid) throw new Error("UNAUTHORIZED");

        const room = await ensureMember(conversationId, uid);
        const mid = asOid(messageId);
        if (!mid) throw new Error("Invalid messageId");

        const now = new Date();

        await ChatMessage.updateOne(
          { _id: mid, conversationId },
          [{
            $set: {
              seenBy: {
                $let: {
                  vars: { base: { $ifNull: ["$seenBy", []] } },
                  in: {
                    $concatArrays: [
                      { $filter: { input: "$$base", as: "s", cond: { $ne: ["$$s.userId", uidOid] } } },
                      [{ userId: uidOid, seenAt: now }]
                    ]
                  }
                }
              }
            }
          }]
        );

        await resetUnread(conversationId, uid);

        io.to(`conv:${conversationId}`).emit("chat:seen_update", {
          conversationId: String(conversationId),
          messageId: String(mid),
          userId: uid,
          seenAt: now.toISOString(),
        });

        await emitConversationUpdateToAll(room, conversationId, uid, {});
        ack?.({ ok: true });
      } catch (e) {
        ack?.({ ok: false, message: e?.message || "seen failed" });
      }
    });

    const handleRevoke = async ({ conversationId, messageId } = {}, ack) => {
      try {
        if (!conversationId || !messageId) throw new Error("Missing");
        if (!uidOid) throw new Error("UNAUTHORIZED");

        const room = await ensureMember(conversationId, uid);
        const mid = asOid(messageId);
        if (!mid) throw new Error("Invalid messageId");

        const existed = await ChatMessage.findOne({ _id: mid, conversationId })
          .select("_id senderId createdAt deletedAt")
          .lean();

        if (!existed) throw new Error("Message not found");
        if (String(existed.senderId) !== String(uidOid)) throw new Error("Forbidden");

        const now = new Date();
        await ChatMessage.updateOne(
          { _id: mid, conversationId, senderId: uidOid },
          { $set: { deletedAt: now, content: "", attachments: [], editedAt: now } }
        );

        const payload = { conversationId, messageId: String(mid), deletedAt: now.toISOString(), by: uid };

        io.to(`conv:${conversationId}`).emit("chat:revoke_update", payload);
        io.to(`conv:${conversationId}`).emit("chat:deleted", payload);

        await maybeUpdateLastOnRevoke(room, conversationId, { ...existed, senderId: uidOid });
        await emitConversationUpdateToAll(room, conversationId, uid, {});

        ack?.({ ok: true });
      } catch (e) {
        ack?.({ ok: false, message: e?.message || "revoke failed" });
      }
    };

    socket.on("chat:revoke", handleRevoke);
    socket.on("chat:delete", handleRevoke);

    socket.on("chat:react", async ({ conversationId, messageId, emoji } = {}, ack) => {
      try {
        if (!conversationId || !messageId) throw new Error("Missing");
        if (!uidOid) throw new Error("UNAUTHORIZED");

        const key = normReaction(emoji);
        if (!key) throw new Error("Invalid emoji");

        await ensureMember(conversationId, uid);

        const mid = asOid(messageId);
        if (!mid) throw new Error("Invalid messageId");

        const msg = await ChatMessage.findOne({ _id: mid, conversationId })
          .select("_id deletedAt reactions")
          .lean();

        if (!msg) throw new Error("Message not found");
        if (msg.deletedAt) throw new Error("Message revoked");

        const list = safeArr(msg.reactions);
        const cur = list.find((r) => String(r?.userId || "") === String(uidOid)) || null;
        const willClear = cur?.emoji === key;

        const now = new Date();
        const uidVal = uidOid;
        const addArr = willClear ? [] : [{ emoji: key, userId: uidVal, reactedAt: now }];

        await ChatMessage.updateOne(
          { _id: mid, conversationId },
          [{
            $set: {
              reactions: {
                $let: {
                  vars: { base: { $ifNull: ["$reactions", []] } },
                  in: {
                    $concatArrays: [
                      { $filter: { input: "$$base", as: "r", cond: { $ne: ["$$r.userId", uidVal] } } },
                      addArr
                    ]
                  }
                }
              }
            }
          }]
        );

        const updated = await ChatMessage.findById(mid).lean();

        io.to(`conv:${conversationId}`).emit("chat:reaction_update", { conversationId, message: updated });
        io.to(`conv:${conversationId}`).emit("chat:react_update", { conversationId, message: updated });

        ack?.({ ok: true, message: updated, action: willClear ? "clear" : "set", reaction: key });
      } catch (e) {
        ack?.({ ok: false, message: e?.message || "react failed" });
      }
    });
  });

  return io;
}
