import express from "express";
import { register, login } from "../controllers/auth.controller.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = express.Router();

// Giới hạn tốc độ để chống spam / brute-force
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);

export default router;
