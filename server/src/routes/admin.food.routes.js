// server/src/routes/admin.food.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { requireAtLeast } from "../middleware/requireAdminLevel.js";
import Food from "../models/Food.js";
import { uploadImportAny, uploadFoodSingle } from "../middleware/upload.js";
import { importFoods, validateFoods } from "../controllers/admin.food.import.controller.js";
import { updateFood } from "../controllers/food.controller.js";

const r = Router();

// Toàn bộ route yêu cầu admin >= LV2
r.use(auth, requireAtLeast("admin_lv2"));

/**
 * GET /api/admin/foods
 *  Hỗ trợ: status, q, origin(user|admin), approvedFrom, approvedTo, limit, skip
 */
r.get("/foods", async (req, res) => {
  const { status, q = "", origin, approvedFrom, approvedTo } = req.query;
  const limit = Math.max(1, Number(req.query.limit ?? 100));
  const skip  = Math.max(0, Number(req.query.skip  ?? 0));

  const query = {};
  if (["pending", "approved", "rejected"].includes(String(status))) {
    query.status = String(status);
  }
  if (origin === "user") {
    query.createdBy = { $ne: null };
    query.$or = [{ createdByAdmin: { $exists: false } }, { createdByAdmin: null }];
  } else if (origin === "admin") {
    query.createdByAdmin = { $ne: null };
  }
  if (q && String(q).trim()) {
    query.name = { $regex: String(q).trim(), $options: "i" };
  }
  if (approvedFrom || approvedTo) {
    const range = {};
    if (approvedFrom) range.$gte = new Date(approvedFrom);
    if (approvedTo) {
      const t = new Date(approvedTo);
      t.setDate(t.getDate() + 1); // inclusive tới cuối ngày
      range.$lt = t;
    }
    query.approvedAt = range;
  }
  const [items, total] = await Promise.all([
    Food.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip)
    .populate({ path: "createdBy", select: "email username profile.nickname" })
    .lean(),
    Food.countDocuments(query),
  ]);

    res.json({ items, total, limit, skip, hasMore: skip + items.length < total });
});

// KHÔNG thêm "/admin" lần nữa ở path con!
r.post("/foods/import/validate", uploadImportAny, validateFoods);
r.post("/foods/import",          uploadImportAny, importFoods);
r.patch("/foods/:id", uploadFoodSingle, updateFood);

export default r;
