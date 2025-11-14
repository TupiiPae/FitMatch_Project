// server/src/routes/admin.users.routes.js
import express from "express";

import { adminBlockUser, adminUnblockUser } from "../controllers/admin.users.controller.js";

const router = express.Router();

// Yêu cầu admin cấp phù hợp (tùy hệ thống của bạn):
router.post("/users/:id/block", adminBlockUser);
router.post("/users/:id/unblock", adminUnblockUser);

export default router;
