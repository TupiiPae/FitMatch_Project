// server/src/utils/tokens.js
import jwt from "jsonwebtoken";

/**
 * Tạo JWT token từ payload bất kỳ (yêu cầu có id/_id/userId/sub).
 * - Giữ nguyên mọi claim truyền vào (vd: role, level, username, ...).
 * - subject (sub) = id
 * - expiresIn mặc định 7d (có thể override qua options)
 */
export const generateToken = (payload = {}, options = {}) => {
  // Chuẩn hóa id
  const id =
    payload.id ||
    payload._id ||
    payload.userId ||
    payload.sub;

  if (!id) {
    console.error("generateToken: Thiếu id/_id/userId/sub trong payload =>", Object.keys(payload || {}));
    throw new Error("Thiếu id để tạo token");
  }

  // Loại bỏ các key id khác để tránh trùng lặp, rồi trải các claim còn lại
  const {
    id: _drop1,
    _id: _drop2,
    userId: _drop3,
    sub: _drop4,
    ...rest
  } = payload;

  // Nếu caller không set role, fallback 'user'
  const finalPayload = {
    id: String(id),
    role: payload.role || "user",
    ...rest, // giữ nguyên các claim khác như username, level, ...
  };

  const signOpts = {
    expiresIn: "7d",
    subject: String(id),
    ...options, // cho phép override (vd: { expiresIn: "1h" })
  };

  return jwt.sign(finalPayload, process.env.JWT_SECRET, signOpts);
};

/**
 * Xác thực JWT token
 * @param {string} token
 * @returns {Object|null} payload đã giải mã hoặc null
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    console.error("verifyToken lỗi:", err.message);
    return null;
  }
};

/**
 * Giải mã không kiểm tra chữ ký (debug)
 */
export const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
};
