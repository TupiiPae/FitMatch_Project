// server/src/routes/suggestPlan.user.routes.js
import express from "express";
import { auth } from "../middleware/auth.js";
import {
  listSuggestPlansUser,
  getSuggestPlanUser,
  toggleSaveSuggestPlanUser,
} from "../controllers/suggestPlan.user.controller.js";

const router = express.Router();

router.use(auth);

// List + filter + search
router.get("/suggest-plans", listSuggestPlansUser);

// Chi tiết 1 lịch
router.get("/suggest-plans/:id", getSuggestPlanUser);

// Lưu / bỏ lưu
router.post("/suggest-plans/:id/save", toggleSaveSuggestPlanUser);

export default router;
