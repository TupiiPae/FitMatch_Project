// server/src/middleware/requireAdminLevel.js

/** Lấy level hiệu lực từ req:
 *  - Ưu tiên req.adminLevel (số)
 *  - Sau đó req.userLevel (số)
 *  - Fallback từ req.userRole: admin_lv2 -> 2; admin_lv1|admin -> 1; khác -> 0
 */
function getEffectiveLevel(req) {
  const lvlA = Number(req.adminLevel || 0);
  if (Number.isFinite(lvlA) && lvlA > 0) return lvlA;

  const lvlU = Number(req.userLevel || 0);
  if (Number.isFinite(lvlU) && lvlU > 0) return lvlU;

  const role = String(req.userRole || "").toLowerCase();
  if (role.includes("admin_lv2")) return 2;
  if (role === "admin_lv1" || role === "admin") return 1;
  return 0;
}

/** Chuẩn hoá tham số min:
 *  - "admin_lv2" -> 2
 *  - "admin_lv1" -> 1
 *  - số -> chính nó
 *  - mặc định -> 1
 */
function normalizeMin(min) {
  if (typeof min === "number") return min;
  const s = String(min || "").toLowerCase();
  if (s.includes("lv2")) return 2;
  if (s.includes("lv1")) return 1;
  return 1;
}

/**
 * Yêu cầu CHÍNH XÁC các cấp được truyền vào.
 * requireAdminLevel(1)  => chỉ LV1
 * requireAdminLevel(1,2)=> LV1 hoặc LV2
 */
export const requireAdminLevel = (...levels) => (req, res, next) => {
  const lvl = getEffectiveLevel(req);
  if (!lvl || !levels.includes(lvl)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

/**
 * Cho phép mọi cấp <= min (vì 1 là cao nhất).
 * requireAtLeastLevel(2) -> LV1 & LV2
 * requireAtLeastLevel(1) -> chỉ LV1
 */
export const requireAtLeastLevel = (min) => (req, res, next) => {
  const need = Number(min);
  const lvl = getEffectiveLevel(req);
  if (!lvl || lvl > need) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

/** Alias tiện dụng để dùng như tài liệu trước: */
export const requireAtLeast = (min = "admin_lv2") => {
  const need = normalizeMin(min);
  return requireAtLeastLevel(need);
};
