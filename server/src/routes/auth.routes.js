// src/routes/auth.routes.js
import express from "express";
import {
  register,
  login,
  passwordForgot,
  passwordVerify,
  passwordReset,
  passwordResend,
  registerOtpRequest,
  registerOtpResend,
} from "../controllers/auth.controller.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { googleLogin } from "../controllers/auth.google.controller.js";

const router = express.Router();

/** (Không bắt buộc) Health check cho cụm /auth */
router.get("/ping", (_req, res) => res.json({ ok: true, ts: Date.now() }));

router.post("/register/otp", authLimiter, registerOtpRequest);
router.post("/register/otp/resend", authLimiter, registerOtpResend);

// Đăng ký / Đăng nhập (chống brute-force)
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);

// Đăng nhập Google (nên có limiter để tránh spam token)
router.post("/google", authLimiter, googleLogin);

// Quên mật khẩu (OTP qua email)
router.post("/password/forgot", authLimiter, passwordForgot);
router.post("/password/verify", authLimiter, passwordVerify);
router.post("/password/reset", authLimiter, passwordReset);
router.post("/password/resend", authLimiter, passwordResend);


export default router;
