// src/middleware/requireRole.js

const RANK = { user: 1, admin: 2, admin_lv2: 2, admin_lv1: 3 };

/** Chỉ cho các vai trò được liệt kê (không tự “leo thang”) */
export const requireRole = (...roles) => (req, res, next) => {
  // Nếu role là "admin" nhưng có level -> chuyển thành hiệu lực
  const eff = effectiveRole(req.userRole, req.userLevel);
  if (!roles.includes(eff)) return res.status(403).json({ message: "Forbidden" });
  next();
};

/** Yêu cầu tối thiểu >= vai trò cho trước (ví dụ: admin_lv2 ⇒ Cấp 2 + Cấp 1) */
export const requireAtLeast = (minRole) => (req, res, next) => {
  const eff = effectiveRole(req.userRole, req.userLevel);
  if ((RANK[eff] || 0) < (RANK[minRole] || 0)) return res.status(403).json({ message: "Forbidden" });
  next();
};

function effectiveRole(userRole, userLevel) {
  if (userRole === "admin") {
    if (Number(userLevel) === 1) return "admin_lv1";
    if (Number(userLevel) === 2) return "admin_lv2";
  }
  return userRole || "user";
}
