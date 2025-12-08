// server/src/routes/onboarding.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { upsertOnboarding, getMyOnboarding, createGoal } from "../controllers/onboarding.controller.js";

const router = Router();

router.post("/upsert", auth, upsertOnboarding);
router.get("/me", auth, getMyOnboarding);
router.post("/goal", auth, createGoal); // nếu bạn đã thêm createGoal

export default router;
