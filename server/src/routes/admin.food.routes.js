import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import Food from "../models/Food.js";
import { responseOk } from "../utils/response.js";

const r = Router();
r.use(auth, requireRole("admin"));

// GET /api/admin/foods?status=pending|approved|rejected&limit=&skip=
r.get("/foods", async (req, res) => {
  const { status = "pending", limit = 100, skip = 0 } = req.query;
  const q = {};
  if (["pending","approved","rejected"].includes(status)) q.status = status;
  const items = await Food.find(q)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip(Number(skip))
    .populate({ path: "createdBy", select: "email username profile.nickname" })
    .lean();
  res.json({ items });
});

// POST /api/admin/foods/:id/approve
r.post("/foods/:id/approve", async (req, res) => {
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

// POST /api/admin/foods/:id/reject
r.post("/foods/:id/reject", async (req, res) => {
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
