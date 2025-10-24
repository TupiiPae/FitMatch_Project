// src/middleware/requireAdminLevel.js
export const requireAdminLevel = (...levels) => (req, res, next) => {
  const lvl = Number(req.adminLevel);
  if (!lvl || !levels.includes(lvl)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

// Hoặc nếu muốn ">= cấp tối thiểu" (vd:  requireAtLeastLevel(2) cho phép lv2 & lv1):
export const requireAtLeastLevel = (min) => (req, res, next) => {
  const lvl = Number(req.adminLevel);
  if (!lvl || lvl < min) return res.status(403).json({ message: "Forbidden" });
  next();
};
