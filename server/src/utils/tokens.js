// server/src/utils/tokens.js
import jwt from "jsonwebtoken";

/**
 * Tạo JWT token cho người dùng
 * @param {Object} user - thông tin người dùng (ít nhất cần user._id)
 * @returns {string} token
 */
export const generateToken = (user) => {
  const payload = {
    id: user._id,
    username: user.username,
    role: user.role || "user",
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "7d", // thời gian hiệu lực token
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
  } catch {
    return null;
  }
};
