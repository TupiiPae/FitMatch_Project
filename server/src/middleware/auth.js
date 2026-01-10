// src/middleware/auth.js
import jwt from "jsonwebtoken";
import { User } from "../models/User.js"; // <-- chỉnh đúng path theo project bạn

const getBearerToken = (h = "") => {
  const m = String(h || "").match(/^Bearer\s+(.+)$/i); // case-insensitive
  return m ? m[1].trim() : null;
};

export const auth = (req, res, next) => {
  try {
    const token = getBearerToken(req.headers.authorization || "");
    if (!token) {
      return res.status(401).json({
        message: "Thiếu token",
        tip: "Gửi header Authorization: Bearer <token>",
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // CHẤP NHẬN NHIỀU TÊN CLAIM (bao gồm các object lồng)
    const id =
      payload?.id ||
      payload?._id ||
      payload?.userId ||
      payload?.sub ||
      (payload?.user && (payload.user.id || payload.user._id)) ||
      (payload?.data && (payload.data.id || payload.data._id)) ||
      null;

    const roleBase =
      payload?.role ||
      (payload?.user && payload.user.role) ||
      (payload?.data && payload.data.role) ||
      "user";

    const levelRaw =
      payload?.level ??
      (payload?.user && payload.user.level) ??
      (payload?.data && payload.data.level) ??
      undefined;

    const levelNum = levelRaw === undefined || levelRaw === null ? undefined : Number(levelRaw);
    const userLevel = Number.isFinite(levelNum) ? levelNum : undefined;

    if (!id) {
      console.error(
        "JWT hợp lệ nhưng không có claim id. payload.keys:",
        Object.keys(payload || {})
      );
      return res.status(401).json({ message: "Token thiếu thông tin người dùng (id/_id)" });
    }

    // ✅ set req.userId sớm để những đoạn dưới dùng được
    req.userId = id;

    // Giữ role gốc để không phá chỗ khác
    req.userRoleBase = roleBase;
    req.userRoleRaw = roleBase;
    req.userLevel = userLevel;

    // Role chuẩn hoá (nếu bạn cần phân biệt lv1/lv2)
    let roleNormalized = roleBase;
    if (roleBase === "admin" && userLevel === 1) roleNormalized = "admin_lv1";
    else if (roleBase === "admin" && userLevel === 2) roleNormalized = "admin_lv2";

    req.userRole = roleNormalized;
    req.isAdmin = roleBase === "admin";

    // ✅ update lastActiveAt (không để lỗi này làm rớt 401 nữa)
    const FIVE_MIN = 5 * 60 * 1000;
    if (User && req.userId) {
      User.updateOne(
        {
          _id: req.userId,
          $or: [
            { lastActiveAt: { $exists: false } },
            { lastActiveAt: { $lt: new Date(Date.now() - FIVE_MIN) } },
          ],
        },
        { $set: { lastActiveAt: new Date() } }
      ).catch(() => {});
    }

    next();
  } catch (e) {
    console.error("JWT verify lỗi:", e.name, e.message);
    return res.status(401).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
  }
};
