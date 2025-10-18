// server/src/routes/user.routes.js
import express from "express";
import { auth } from "../middleware/auth.js";
import {getMe, updateAccount, changePassword, deleteAccount, uploadAvatar } from "../controllers/user.controller.js";
import { uploadAvatarSingle } from "../middleware/upload.js"; // 👈 multer single("avatar")           

const router = express.Router();

// Me
router.get("/me", auth, getMe);

// Account
router.patch("/account", auth, updateAccount);
router.post("/change-password", auth, changePassword);
router.delete("/", auth, deleteAccount);
router.post("/avatar", auth, uploadAvatarSingle, uploadAvatar);

// ⚠️ Khuyến nghị: bỏ 2 route dưới vì đã có onboarding.routes.js riêng
// router.patch("/onboarding", auth, patchOnboarding);
// router.post("/onboarding/finalize", auth, finalizeOnboarding);

export default router;
