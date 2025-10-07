import { Router } from "express";
import { auth } from "../middleware/auth.js"; // giữ nguyên đúng path bạn đang dùng
import { upsertOnboarding, getMyOnboarding } from "../controllers/onboarding.controller.js";

const router = Router();
router.use(auth);
router.get("/me", getMyOnboarding);
router.post("/upsert", upsertOnboarding);

export default router;
