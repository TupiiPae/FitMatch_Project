// server/src/routes/chat.routes.js
import express from "express";
import { auth } from "../middleware/auth.js";
import {
  getMessages,
  uploadChatImage,
  getConversationSummary,
  listDmConversations,
  createOrGetDmConversation,
  searchDmUsers,
  getSharedTeam,
  deleteDmConversation,
} from "../controllers/chat.controller.js";
import { uploadChatImageSingle } from "../middleware/upload.js";

const r = express.Router();

const noStore = (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
};

// ===== existing =====
r.get("/conversations/:id/messages", auth, noStore, getMessages);
r.post("/conversations/:id/images", auth, noStore, uploadChatImageSingle, uploadChatImage);
r.get("/conversations/:id/summary", auth, noStore, getConversationSummary);

// ===== DM =====
r.get("/dm/conversations", auth, noStore, listDmConversations);
r.post("/dm/conversations", auth, noStore, createOrGetDmConversation);
r.get("/dm/users", auth, noStore, searchDmUsers);
r.get("/shared-team", auth, noStore, getSharedTeam);
r.delete("/dm/conversations/:id", auth, noStore, deleteDmConversation)

export default r;
