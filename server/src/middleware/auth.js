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
    const id =
      payload?.id ||
      payload?._id ||
      payload?.userId ||
      payload?.sub ||
      (payload.user && (payload.user.id || payload.user._id)) ||
      (payload.data && (payload.data.id || payload.data._id)) ||
      null;

    let role =
      payload?.role ||
      (payload.user && payload.user.role) ||
      (payload.data && payload.data.role) ||
      null;

    // LẤY LEVEL (nếu có)
    const level =
      payload?.level ??
      (payload.user && payload.user.level) ??
      (payload.data && payload.data.level) ??
      null;

    if (!id) {
      console.error("JWT hợp lệ nhưng không có claim id. payload.keys:", Object.keys(payload || {}));
      return res.status(401).json({ message: "Token thiếu thông tin người dùng (id/_id)" });
    }

    // Chuẩn hoá role cho hệ thống admin (map sang admin_lv1/admin_lv2 nếu có level)
    // Lưu cả bản raw nếu cần debug
    req.userRoleRaw = role;
    req.userLevel = typeof level === "number" ? level : (level ? Number(level) : undefined);

    if (role === "admin" && req.userLevel === 1) role = "admin_lv1";
    else if (role === "admin" && req.userLevel === 2) role = "admin_lv2";

    req.userId = id;
    req.userRole = role || "user";

    next();
  } catch (e) {
    console.error("JWT verify lỗi:", e.name, e.message);
    return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};
