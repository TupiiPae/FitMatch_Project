import express from "express";
import { auth } from "../middleware/auth.js";
import {
  listMyNotifications,
  getUnreadCount,
  markRead,
  markAllRead,
} from "../controllers/notification.controller.js";

const r = express.Router();

r.get("/", auth, listMyNotifications);
r.get("/unread-count", auth, getUnreadCount);
r.patch("/:id/read", auth, markRead);
r.patch("/read-all", auth, markAllRead);

export default r;
