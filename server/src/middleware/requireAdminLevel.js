// src/middleware/requireAdminLevel.js

/**
 * Chấp nhận CHÍNH XÁC các cấp được truyền vào.
 * Ví dụ: requireAdminLevel(1) -> chỉ LV1
 *        requireAdminLevel(1,2) -> LV1 hoặc LV2
 */
export const requireAdminLevel = (...levels) => (req, res, next) => {
  const lvl = Number(req.adminLevel);
  if (!lvl || !levels.includes(lvl)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

/**
 * Cho phép mọi cấp <= min (vì 1 là cao nhất).
 * Ví dụ: requireAtLeastLevel(2) -> LV1 & LV2
 *        requireAtLeastLevel(1) -> chỉ LV1
 */
export const requireAtLeastLevel = (min) => (req, res, next) => {
  const lvl = Number(req.adminLevel);
  if (!lvl || lvl > Number(min)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};
