// server/src/routes/admin.users.routes.js
import express from "express";
import { auth, requireAtLeast, requireRole } from "../middleware/auth.js";
import { adminBlockUser, adminUnblockUser } from "../controllers/admin.users.controller.js";

const router = express.Router();

// Yêu cầu admin cấp phù hợp (tùy hệ thống của bạn):
router.post("/users/:id/block", auth, requireAtLeast("admin_lv2"), adminBlockUser);
router.post("/users/:id/unblock", auth, requireAtLeast("admin_lv2"), adminUnblockUser);

export default router;
