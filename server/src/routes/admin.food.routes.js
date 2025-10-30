// server/src/routes/admin.food.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { requireAtLeast } from "../middleware/requireAdminLevel.js";
import Food from "../models/Food.js";
import { uploadImportAny } from "../middleware/upload.js";
import { importFoods, validateFoods } from "../controllers/admin.food.import.controller.js";

const r = Router();

// Toàn bộ route yêu cầu admin >= LV2
r.use(auth, requireAtLeast("admin_lv2"));

/**
 * GET /api/admin/foods
 * Hỗ trợ: status, q, origin(user|admin), limit, skip
 */
r.get("/foods", async (req, res) => {
  const { status, q = "", origin, limit = 100, skip = 0 } = req.query;

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

  const items = await Food.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip(Number(skip))
    .populate({ path: "createdBy", select: "email username profile.nickname" })
    .lean();

  res.json({ items, total: items.length, limit: Number(limit), skip: Number(skip) });
});

// KHÔNG thêm "/admin" lần nữa ở path con!
r.post("/foods/import/validate", uploadImportAny, validateFoods);
r.post("/foods/import",          uploadImportAny, importFoods);

export default r;
