// src/middleware/adminAuth.js
import { verifyToken } from "../utils/tokens.js";

export const adminAuth = (req, res, next) => {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ message: "Unauthorized" });
  const payload = verifyToken(m[1]);
  if (!payload || payload.role !== "admin") {
    return res.status(401).json({ message: "Unauthorized" });
  }
  req.adminId = payload.id;
  req.adminLevel = Number(payload.level) || 2;
  req.adminUsername = payload.username;
  next();
};
