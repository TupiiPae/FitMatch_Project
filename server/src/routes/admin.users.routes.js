import express from "express";
import { auth } from "../middleware/auth.js";
import { requireAtLeast } from "../middleware/requireRole.js";
import { adminBlockUser, adminUnblockUser } from "../controllers/admin.users.controller.js";

const router = express.Router();

// chỉ cho admin đủ cấp
router.post("/users/:id/block", auth, requireAtLeast("admin_lv2"), adminBlockUser);
router.post("/users/:id/unblock", auth, requireAtLeast("admin_lv2"), adminUnblockUser);

export default router;
