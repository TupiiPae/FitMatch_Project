// server/src/routes/suggestPlan.user.routes.js
import express from "express";
import { auth } from "../middleware/auth.js";
import {
  listSuggestPlansUser,
  getSuggestPlanUser,
  toggleSaveSuggestPlanUser,
} from "../controllers/suggestPlan.user.controller.js";

const router = express.Router();

// Tất cả endpoint đều yêu cầu user đăng nhập
router.use(auth);

// List + filter + search
// GET /api/user/suggest-plans?q=&category=&level=&goal=&scope=all|saved&limit=&skip=
router.get("/suggest-plans", listSuggestPlansUser);

// Chi tiết 1 lịch gợi ý
// GET /api/user/suggest-plans/:id
router.get("/suggest-plans/:id", getSuggestPlanUser);

// Lưu / bỏ lưu 1 lịch gợi ý
// POST /api/user/suggest-plans/:id/save
router.post("/suggest-plans/:id/save", toggleSaveSuggestPlanUser);

export default router;
