import express from "express";
import { getMe, patchOnboarding, finalizeOnboarding } from "../controllers/user.controller.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.get("/me", auth, getMe);
router.patch("/onboarding", auth, patchOnboarding);
router.post("/onboarding/finalize", auth, finalizeOnboarding);

export default router;
