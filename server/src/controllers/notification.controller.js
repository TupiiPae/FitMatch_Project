import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import { getIO } from "../realtime/io.js";

const uidFromReq = (req) => String(req?.userId || req?.user?._id || "");
const asOid = (v) => {
  try { return new mongoose.Types.ObjectId(String(v)); } catch { return null; }
};

export async function listMyNotifications(req, res) {
  try {
    const uid = uidFromReq(req);
    const to = asOid(uid);
    if (!to) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const limit = Math.min(parseInt(req.query.limit || "20", 10), 50);
    const cursor = req.query.cursor ? new Date(req.query.cursor) : null; // createdAt cursor

    const q = { to };
    if (cursor) q.createdAt = { $lt: cursor };

    const items = await Notification.find(q)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const nextCursor = items.length ? items[items.length - 1].createdAt : null;
    res.json({ ok: true, items, nextCursor });
  } catch (e) {
    res.status(500).json({ ok: false, message: e?.message || "List notifications failed" });
  }
}

export async function getUnreadCount(req, res) {
  try {
    const uid = uidFromReq(req);
    const to = asOid(uid);
    if (!to) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const unread = await Notification.countDocuments({ to, readAt: null });
    res.json({ ok: true, unread });
  } catch (e) {
    res.status(500).json({ ok: false, message: e?.message || "Count failed" });
  }
}

export async function markRead(req, res) {
  try {
    const uid = uidFromReq(req);
    const to = asOid(uid);
    if (!to) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const id = asOid(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "Bad id" });

    const r = await Notification.findOneAndUpdate(
      { _id: id, to },
      { $set: { readAt: new Date() } },
      { new: true }
    ).lean();

    if (!r) return res.status(404).json({ ok: false, message: "Not found" });

    const io = getIO();
    if (io) {
      io.to(`user:${uid}`).emit("noti:read_update", { id: String(r._id), readAt: r.readAt });
      const unread = await Notification.countDocuments({ to, readAt: null });
      io.to(`user:${uid}`).emit("noti:count", { unread });
    }

    res.json({ ok: true, item: r });
  } catch (e) {
    res.status(500).json({ ok: false, message: e?.message || "Mark read failed" });
  }
}

export async function markAllRead(req, res) {
  try {
    const uid = uidFromReq(req);
    const to = asOid(uid);
    if (!to) return res.status(401).json({ ok: false, message: "Unauthorized" });

    await Notification.updateMany({ to, readAt: null }, { $set: { readAt: new Date() } });

    const io = getIO();
    if (io) io.to(`user:${uid}`).emit("noti:count", { unread: 0 });

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, message: e?.message || "Mark all read failed" });
  }
}
