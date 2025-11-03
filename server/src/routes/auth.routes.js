// src/routes/auth.routes.js
import express from "express";
import {
  register,
  login,
  passwordForgot,
  passwordVerify,
  passwordReset,
  passwordResend,
} from "../controllers/auth.controller.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { googleLogin } from "../controllers/auth.google.controller.js";

const router = express.Router();

// Giới hạn tốc độ để chống spam / brute-force
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);

router.post("/google", googleLogin);

// Quên mật khẩu (OTP qua email)
router.post("/password/forgot", authLimiter, passwordForgot);
router.post("/password/verify", authLimiter, passwordVerify);
router.post("/password/reset", authLimiter, passwordReset);
router.post("/password/resend", authLimiter, passwordResend);

export default router;
