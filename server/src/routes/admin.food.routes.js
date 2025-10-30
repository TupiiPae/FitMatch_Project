// server/src/routes/admin.food.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { requireRole, requireAtLeast } from "../middleware/requireRole.js";
import Food from "../models/Food.js";
import { uploadImportAny } from "../middleware/upload.js";
import { importFoods, validateFoods } from "../controllers/admin.food.import.controller.js";
import { responseOk } from "../utils/response.js";

const r = Router();

// Cho admin_lv2 trở lên
r.use(auth, requireAtLeast("admin_lv2"));

/**
 * GET /api/admin/foods
 * Hỗ trợ: status, q, origin(user|admin), limit, skip
 */
r.get("/foods", async (req, res) => {
  const {
    status,
    q = "",
    origin,
    limit = 100,
    skip = 0,
  } = req.query;

  const query = {};

  // lọc trạng thái (tùy chọn)
  if (["pending", "approved", "rejected"].includes(String(status))) {
    query.status = String(status);
  }

  // lọc nguồn tạo (nếu cần)
  if (origin === "user") {
    query.createdBy = { $ne: null };
    query.$or = [{ createdByAdmin: { $exists: false } }, { createdByAdmin: null }];
  } else if (origin === "admin") {
    query.createdByAdmin = { $ne: null };
  }

  // text search tối giản
  if (q && String(q).trim()) {
    query.name = { $regex: String(q).trim(), $options: "i" };
  }

  const items = await Food.find(query)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip(Number(skip))
    // QUAN TRỌNG: populate người tạo để FE hiển thị nickname & email
    .populate({ path: "createdBy", select: "email username profile.nickname" })
    .lean();

  res.json({
    items,
    total: items.length,
    limit: Number(limit),
    skip: Number(skip),
  });
});

r.post("/admin/foods/import/validate", requireAtLeast("admin_lv2"), uploadImportAny, validateFoods);
r.post("/admin/foods/import",          requireAtLeast("admin_lv2"), uploadImportAny, importFoods);

export default r;
