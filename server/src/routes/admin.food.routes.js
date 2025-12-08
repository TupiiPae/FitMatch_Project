// server/src/routes/admin.food.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { requireAtLeast } from "../middleware/requireAdminLevel.js";
import Food from "../models/Food.js";
import { uploadImportAny, uploadFoodSingle } from "../middleware/upload.js";
import {
  importFoods,
  validateFoods,
} from "../controllers/admin.food.import.controller.js";
import {
  createFood,
  updateFood,
  getFood,
  deleteFood,
  approveFood,
  rejectFood,
} from "../controllers/food.controller.js";

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
  const skip = Math.max(0, Number(req.query.skip ?? 0));

  const query = {};

  // ----- Lọc theo trạng thái -----
  if (["pending", "approved", "rejected"].includes(String(status))) {
    query.status = String(status);
  }

  // ----- Lọc theo nguồn tạo (origin) -----
  if (origin === "user") {
    query.createdBy = { $ne: null };
    query.$or = [
      { createdByAdmin: { $exists: false } },
      { createdByAdmin: null },
    ];
  } else if (origin === "admin") {
    query.createdByAdmin = { $ne: null };
  }

  // ----- Tìm kiếm theo tên -----
  if (q && String(q).trim()) {
    query.name = { $regex: String(q).trim(), $options: "i" };
  }

  // ----- Lọc theo thời gian duyệt (approvedAt) -----
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

  // ====== LỌC THEO KHOẢNG SỐ (min–max) ======

  function toNum(value) {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function applyRange(field, minKey, maxKey) {
    const minRaw = req.query[minKey];
    const maxRaw = req.query[maxKey];

    const min = toNum(minRaw);
    const max = toNum(maxRaw);

    if (min == null && max == null) return;

    const cond = {};
    if (min != null) cond.$gte = min;
    if (max != null) cond.$lte = max;

    // Nếu field đã có condition (hiếm), merge lại
    if (query[field] && typeof query[field] === "object") {
      Object.assign(query[field], cond);
    } else {
      query[field] = cond;
    }
  }

  // ⚠️ TÊN PARAM PHẢI TRÙNG VỚI FE (Food_List.jsx.buildListParams)
  applyRange("massG",    "massGMin",    "massGMax");
  applyRange("kcal",     "kcalMin",     "kcalMax");
  applyRange("proteinG", "proteinGMin", "proteinGMax");
  applyRange("carbG",    "carbGMin",    "carbMax");
  applyRange("fatG",     "fatGMin",     "fatMax");

  // ----- Query DB -----
  const [items, total] = await Promise.all([
    Food.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate({
        path: "createdBy",
        select: "email username profile.nickname",
      })
      .lean(),
    Food.countDocuments(query),
  ]);

  res.json({
    items,
    total,
    limit,
    skip,
    hasMore: skip + items.length < total,
  });
});

/** Tạo món ăn mới (admin) */
r.post("/foods", uploadFoodSingle, createFood);

/** LẤY CHI TIẾT 1 MÓN ĂN (ADMIN) – cái FE đang dùng ở Food_Edit.getFood */
r.get("/foods/:id", getFood);

/** CẬP NHẬT MÓN ĂN (ADMIN) */
r.patch("/foods/:id", uploadFoodSingle, updateFood);

/** XOÁ MÓN ĂN (ADMIN) */
r.delete("/foods/:id", deleteFood);

/** DUYỆT MÓN ĂN (ADMIN) */
r.post("/foods/:id/approve", approveFood);

/** TỪ CHỐI MÓN ĂN (ADMIN) */
r.post("/foods/:id/reject", rejectFood);

/** IMPORT / VALIDATE IMPORT */
r.post("/foods/import/validate", uploadImportAny, validateFoods);
r.post("/foods/import", uploadImportAny, importFoods);

export default r;
