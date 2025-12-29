import Notification from "../models/Notification.js";
import { getIO } from "../realtime/io.js";

export async function createNotification({
  to,
  from = null,
  type,
  title = "",
  body = "",
  data = {},
}) {
  if (!to || !type) return null;

  const noti = await Notification.create({ to, from, type, title, body, data });

  const io = getIO();
  if (io) {
    const toId = String(to);
    io.to(`user:${toId}`).emit("noti:new", {
      _id: String(noti._id),
      to: toId,
      from: from ? String(from) : null,
      type,
      title,
      body,
      data,
      readAt: noti.readAt,
      createdAt: noti.createdAt,
    });

    // update badge count realtime
    const unread = await Notification.countDocuments({ to, readAt: null });
    io.to(`user:${toId}`).emit("noti:count", { unread });
  }

  return noti;
}
