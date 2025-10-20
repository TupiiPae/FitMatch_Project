// server/src/routes/user.routes.js
import express from "express";
import { auth } from "../middleware/auth.js";
import {
  getMe,
  updateAccount,
  changePassword,
  deleteAccount,
  uploadAvatar,
  patchOnboarding,
  finalizeOnboarding,
} from "../controllers/user.controller.js";
import { uploadAvatarSingle } from "../middleware/upload.js"; // multer single("avatar")

const router = express.Router();

// ===== Me =====
router.get("/me", auth, getMe);

// ===== Account =====
router.patch("/account", auth, updateAccount);
router.post("/change-password", auth, changePassword);
router.delete("/", auth, deleteAccount);

// ===== Avatar =====
router.post("/avatar", auth, uploadAvatarSingle, uploadAvatar);

// ===== Onboarding =====
router.patch("/onboarding", auth, patchOnboarding);
router.post("/onboarding/finalize", auth, finalizeOnboarding);

// (Tuỳ chọn) Alias cũ để tương thích FE cũ, có thể bỏ nếu không cần
router.post("/onboarding/upsert", auth, patchOnboarding);

export default router;
