// server/src/routes/admin.food.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { requireAtLeast } from "../middleware/requireRole.js";
import {
  listFoods,
  getFood,
  createFood,
  updateFood,
  deleteFood,
  approveFood,
  rejectFood,
} from "../controllers/food.controller.js";
import { uploadFoodSingle } from "../middleware/upload.js";

const r = Router();

// ===== TẤT CẢ CHỨC NĂNG: admin cấp 2 trở lên =====
r.use(auth, requireAtLeast("admin_lv2"));

/**
 * GET /api/admin/foods?status=pending|approved|rejected&limit=&skip=&q=
 * (không cần upload)
 */
r.get("/foods", listFoods);

/**
 * GET /api/admin/foods/:id
 */
r.get("/foods/:id", getFood);

/**
 * POST /api/admin/foods
 * - Cho phép admin tạo món trực tiếp
 * - Hỗ trợ multipart (field "image") hoặc JSON (imageUrl)
 * - Dùng controller để resize ảnh, set createdByAdmin, map fields, v.v.
 */
r.post("/foods", uploadFoodSingle, createFood);

/**
 * PATCH /api/admin/foods/:id
 * - Hỗ trợ multipart (field "image") hoặc JSON
 */
r.patch("/foods/:id", uploadFoodSingle, updateFood);

/**
 * DELETE /api/admin/foods/:id
 */
r.delete("/foods/:id", deleteFood);

/**
 * DUYỆT & TỪ CHỐI
 * *Theo yêu cầu mới*: cấp 2 cũng có quyền duyệt → không đặt requireRole("admin_lv1")
 */
r.post("/foods/:id/approve", approveFood);
r.post("/foods/:id/reject", rejectFood);

export default r;
