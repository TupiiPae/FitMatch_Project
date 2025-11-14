// server/src/routes/admin.suggestPlan.routes.js
import express from "express";
import { adminAuth } from "../middleware/adminAuth.js";
import {
  uploadExerciseImageSingle, // single("image") – reuse middleware upload ảnh
} from "../middleware/upload.js";
import {
  createSuggestPlanAdmin,
  listSuggestPlansAdmin,
} from "../controllers/suggestPlan.controller.js";

const router = express.Router();

// Tất cả route dưới đây yêu cầu adminAuth (giống admin.exercise.routes)
router.use(adminAuth);

// GET /api/admin/suggest-plans
router.get("/suggest-plans", listSuggestPlansAdmin);

// POST /api/admin/suggest-plans
// Nhận file "image" (optional) + body JSON/multipart
router.post("/suggest-plans", uploadExerciseImageSingle, createSuggestPlanAdmin);

export default router;
