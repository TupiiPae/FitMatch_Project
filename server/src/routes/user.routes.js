import express from "express";
import { auth } from "../middleware/auth.js";
import {
  getMe,
  patchOnboarding,
  finalizeOnboarding,
  updateAccount,        // 👈
  changePassword,       // 👈
  deleteAccount,        // 👈
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/me", auth, getMe);
router.patch("/account", auth, updateAccount);       // 👈 thêm
router.post("/change-password", auth, changePassword); // 👈 thêm
router.delete("/", auth, deleteAccount);             // 👈 thêm

router.patch("/onboarding", auth, patchOnboarding);
router.post("/onboarding/finalize", auth, finalizeOnboarding);

export default router;
