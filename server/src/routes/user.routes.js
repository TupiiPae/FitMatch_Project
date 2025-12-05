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
  uploadProgressPhoto, // << thêm
} from "../controllers/user.controller.js";
import { uploadAvatarSingle } from "../middleware/upload.js";

const router = express.Router();

// ===== Me =====
router.get("/me", auth, getMe);

// ===== Account =====
router.patch("/account", auth, updateAccount);
router.post("/change-password", auth, changePassword);
router.delete("/", auth, deleteAccount);

// ===== Avatar =====
router.post("/avatar", auth, uploadAvatarSingle, uploadAvatar);

// ===== Progress photos =====
router.post(
  "/progress-photo",
  auth,
  uploadAvatarSingle, // field "avatar"
  uploadProgressPhoto
);

// ===== Onboarding =====
router.patch("/onboarding", auth, patchOnboarding);
router.post("/onboarding/finalize", auth, finalizeOnboarding);

export default router;
