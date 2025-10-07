// server/src/utils/tokens.js
import jwt from "jsonwebtoken";

/**
 * Tạo JWT token cho người dùng
 * @param {Object} user - Thông tin người dùng hoặc payload. 
 *                        Cần có ít nhất { id } hoặc { _id }.
 * @returns {string} token
 */
export const generateToken = (user = {}) => {
  // 👇 Hợp nhất cả id và _id để tránh mất giá trị
  const id = user.id || user._id;
  if (!id) {
    console.error("generateToken: Thiếu id/_id trong payload =>", user);
    throw new Error("Thiếu id để tạo token");
  }

  const payload = {
    id: id.toString(),
    username: user.username,
    role: user.role || "user",
  };

  // 👇 Thêm 'subject' (sub) để dễ tương thích JWT chuẩn
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "7d", // token sống 7 ngày
    subject: id.toString(),
  });
};

/**
 * Xác thực JWT token
 * @param {string} token - JWT token cần kiểm tra
 * @returns {Object|null} payload đã giải mã hoặc null nếu không hợp lệ
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    console.error("verifyToken lỗi:", err.message);
    return null;
  }
};
