// server/src/routes/admin.food.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { requireRole, requireAtLeast } from "../middleware/requireRole.js";
import Food from "../models/Food.js";
import { responseOk } from "../utils/response.js";

const r = Router();

// ===== VÙNG CHO CẤP 2 TRỞ LÊN (admin_lv2 & admin_lv1) =====
r.use(auth, requireAtLeast("admin_lv2"));

/**
 * GET /api/admin/foods?status=pending|approved|rejected&limit=&skip=&q=
 */
r.get("/foods", async (req, res) => {
  const {
    status,
    q = "",
    limit = 100,
    skip = 0,
  } = req.query;

  const query = {};
  if (["pending", "approved", "rejected"].includes(String(status))) {
    query.status = String(status);
  }
  if (q) {
    // tuỳ schema của bạn có các field gì — ví dụ tìm theo name
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

/**
 * (tuỳ chọn) POST /api/admin/foods
 * Cho phép admin tạo món trực tiếp
 */
r.post("/foods", async (req, res) => {
  const body = req.body || {};
  const doc = await Food.create({
    ...body,
    status: body.status || "approved", // tuỳ chính sách: admin tạo có thể auto approved
    createdBy: req.userId,
  });
  res.status(201).json({ id: String(doc._id) });
});

/**
 * (tuỳ chọn) PATCH /api/admin/foods/:id
 */
r.patch("/foods/:id", async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};
  const doc = await Food.findByIdAndUpdate(id, { $set: body }, { new: true, runValidators: true }).lean();
  if (!doc) return res.status(404).json({ message: "Not found" });
  res.json({ id: String(doc._id) });
});

/**
 * (tuỳ chọn) DELETE /api/admin/foods/:id
 */
r.delete("/foods/:id", async (req, res) => {
  const { id } = req.params;
  const doc = await Food.findByIdAndDelete(id).lean();
  if (!doc) return res.status(404).json({ message: "Not found" });
  res.json(responseOk());
});

// ===== HÀNH ĐỘNG CHỈ CẤP 1 (DUYỆT) =====
r.post("/foods/:id/approve", requireRole("admin_lv1"), async (req, res) => {
  const id = req.params.id;
  const adminId = req.userId;

  const doc = await Food.findById(id);
  if (!doc) return res.status(404).json({ message: "Not found" });

  doc.status = "approved";
  doc.approvedBy = adminId;
  doc.approvedAt = new Date();
  doc.rejectionReason = undefined;
  await doc.save();

  res.json(responseOk());
});

r.post("/foods/:id/reject", requireRole("admin_lv1"), async (req, res) => {
  const id = req.params.id;
  const reason = (req.body?.reason || "").slice(0, 500);
  const adminId = req.userId;

  const doc = await Food.findById(id);
  if (!doc) return res.status(404).json({ message: "Not found" });

  doc.status = "rejected";
  doc.approvedBy = adminId;
  doc.approvedAt = undefined;
  doc.rejectionReason = reason || undefined;
  await doc.save();

  res.json(responseOk());
});

export default r;
