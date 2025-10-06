// server/src/middleware/rateLimit.js
import rateLimit from "express-rate-limit";

// Giới hạn số lượng request để tránh spam API (chống brute force)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 20,                  // mỗi IP tối đa 20 request trong 15 phút
  message: {
    success: false,
    message: "Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
