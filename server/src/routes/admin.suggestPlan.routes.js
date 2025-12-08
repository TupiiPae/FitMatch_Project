// server/src/routes/admin.suggestPlan.routes.js
import express from "express";
import { adminAuth } from "../middleware/adminAuth.js";
import { uploadExerciseImageSingle } from "../middleware/upload.js";
import {
  listSuggestPlans,
  getSuggestPlan,
  createSuggestPlan,
  updateSuggestPlan,
  deleteSuggestPlan,
} from "../controllers/suggestPlan.controller.js";

const router = express.Router();

router.use(adminAuth);

// LIST + GET 1
router.get("/suggest-plans", listSuggestPlans);
router.get("/suggest-plans/:id", getSuggestPlan);

// CREATE / UPDATE: dùng CHUNG uploadExerciseImageSingle (field "image")
router.post("/suggest-plans", uploadExerciseImageSingle, createSuggestPlan);
router.patch("/suggest-plans/:id", uploadExerciseImageSingle, updateSuggestPlan);

// DELETE
router.delete("/suggest-plans/:id", deleteSuggestPlan);

export default router;
