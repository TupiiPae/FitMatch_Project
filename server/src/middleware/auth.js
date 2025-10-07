// src/middleware/auth.js
import jwt from "jsonwebtoken";

export const auth = (req, res, next) => {
  try {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : null;
    if (!token) {
      return res.status(401).json({
        message: "Thiếu token",
        tip: "Gửi header Authorization: Bearer <token>"
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // CHẤP NHẬN NHIỀU TÊN CLAIM (bao gồm các object lồng)
    req.userId =
      payload?.id ||
      payload?._id ||
      payload?.userId ||
      payload?.sub ||
      (payload.user && (payload.user.id || payload.user._id)) ||
      (payload.data && (payload.data.id || payload.data._id)) ||
      null;

    req.userRole =
      payload?.role ||
      (payload.user && payload.user.role) ||
      (payload.data && payload.data.role) ||
      null;

    if (!req.userId) {
      // ghi log payload (rút gọn) để debug — xóa hoặc giảm log ở production
      console.error("JWT hợp lệ nhưng không có claim id. payload:", {
        keys: Object.keys(payload || {}),
        // không in toàn bộ payload để tránh lộ thông tin nhạy cảm; nếu cần in thêm, bật thủ công
      });
      return res.status(401).json({ message: "Token thiếu thông tin người dùng (id/_id)" });
    }

    next();
  } catch (e) {
    console.error("JWT verify lỗi:", e.name, e.message);
    return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};
