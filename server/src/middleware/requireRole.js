// src/middleware/requireRole.js

const RANK = { user:1, admin_lv2:2, admin_lv1:3, admin:2 };

/** Chỉ cho các vai trò được liệt kê (không tự “leo thang”) */
export const requireRole = (...roles) => (req, res, next) => {
  const current = req.userRole || req.user?.role || "user";
  if (!roles.includes(current)) return res.status(403).json({ message: "Forbidden" });
  next();
};

/** Yêu cầu tối thiểu >= vai trò cho trước (ví dụ: admin_lv2 ⇒ Cấp 2 + Cấp 1) */
export const requireAtLeast = (minRole) => (req, res, next) => {
  const current = req.userRole || req.user?.role || "user";
  if ((RANK[current] || 0) < (RANK[minRole] || 0)) return res.status(403).json({ message: "Forbidden" });
  next();
};
