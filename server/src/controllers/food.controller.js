// server/src/controllers/food.controller.js
import path from "path";
import fs from "fs";
import sharp from "sharp";
import Food from "../models/Food.js";
import NutritionLog from "../models/NutritionLog.js";
import { responseOk } from "../utils/response.js";
import { FOOD_DIR } from "../middleware/upload.js";

const isNum = (v) => Number.isFinite(v);
const toNumOrNull = (v) =>
  v === undefined || v === null || v === ""
    ? null
    : Number.isFinite(Number(v))
    ? Number(v)
    : null;
const ensureDir = () => {
  try {
    fs.mkdirSync(FOOD_DIR, { recursive: true });
  } catch (_) {}
};

// ---- helper: map lỗi validate ----
function toValidationMap(err) {
  if (!err || err.name !== "ValidationError") return null;
  const out = {};
  for (const k of Object.keys(err.errors || {})) {
    const e = err.errors[k];
    const path = (e && e.path) || k;
    out[path] = e.message || "Dữ liệu không hợp lệ";
  }
  return out;
}

export async function listFoods(req, res) {
  const userId = req.userId;
  const isAdmin = req.userRole === "admin";
  const {
    q,
    status,
    onlyMine,
    favorites,
    approvedFrom,
    approvedTo,
    limit = 30,
    skip = 0,
  } = req.query;

  const match = {};
  const and = [];

  if (isAdmin) {
    if (status) and.push({ status });
  } else {
    if (onlyMine) and.push({ createdBy: userId });
    else and.push({ status: "approved" });
  }

  if (favorites && userId) and.push({ likedBy: userId });
  if (q) match.$text = { $search: q };

  if (approvedFrom || approvedTo) {
    and.push({ status: "approved" });
    const range = {};
    if (approvedFrom) range.$gte = new Date(approvedFrom);
    if (approvedTo) {
      const t = new Date(approvedTo);
      t.setDate(t.getDate() + 1);
      range.$lt = t;
    }
    and.push({ approvedAt: range });
  }

  if (and.length) match.$and = and;

  const proj = {
    name: 1,
    imageUrl: 1,
    portionName: 1,
    massG: 1,
    unit: 1,
    kcal: 1,
    proteinG: 1,
    carbG: 1,
    fatG: 1,
    saltG: 1,
    sugarG: 1,
    fiberG: 1,
    likedBy: 1,
    status: 1,
    createdBy: 1,
    createdByAdmin: 1,
    approvedAt: 1,
    approvedBy: 1,
    updatedAt: 1,
    createdAt: 1,
  };

  const sort = q ? { score: { $meta: "textScore" } } : { updatedAt: -1 };

  const docs = await Food.find(match)
    .sort(sort)
    .skip(Number(skip))
    .limit(Number(limit) + 1)
    .select(proj)
    .lean();

  const items = docs.slice(0, Number(limit));
  const hasMore = docs.length > Number(limit);
  res.json({ items, hasMore, total: items.length });
}

export async function getFood(req, res) {
  const d = await Food.findById(req.params.id).lean();
  if (!d) return res.status(404).json({ message: "Not found" });
  const isFavorite = req.userId
    ? d.likedBy?.some((x) => String(x) === String(req.userId))
    : false;
  res.json({ ...d, isFavorite });
}

export async function createFood(req, res) {
  try {
    const userId = req.userId;
    const isAdmin = req.userRole === "admin";
    const b = req.body || {};
    const name = String(b.name || "").trim();
    const mass = Number(b.massG);
    // Kiểm tra rất cơ bản, phần còn lại giao cho Mongoose validators ở model
    if (!name || !isNum(mass) || mass <= 0) {
      return res.status(400).json({ message: "name & massG required" });
    }

    let imageUrl = b.imageUrl || null;
    if (req.file) {
      try {
        ensureDir();
        const fn = `${userId || "anon"}-${Date.now()}.webp`;
        const out = path.join(FOOD_DIR, fn);
        await sharp(req.file.buffer)
          .rotate()
          .resize(800, 800, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 82 })
          .toFile(out);
        imageUrl = `/uploads/foods/${fn}`;
      } catch (e) {
        console.error("[food.upload]", e?.message || e);
      }
    }

    const base = {
      name,
      imageUrl,
      portionName: b.portionName || undefined,
      massG: mass,
      unit: b.unit === "ml" ? "ml" : "g",
      kcal: toNumOrNull(b.kcal),
      proteinG: toNumOrNull(b.proteinG),
      carbG: toNumOrNull(b.carbG),
      fatG: toNumOrNull(b.fatG),
      saltG: toNumOrNull(b.saltG),
      sugarG: toNumOrNull(b.sugarG),
      fiberG: toNumOrNull(b.fiberG),
      status: "pending",
      sourceType: b.sourceType || "user_submitted",
    };

    // Phân biệt người tạo: user vs admin
    if (isAdmin) {
      base.createdByAdmin = userId;
    } else {
      base.createdBy = userId;
    }

    const doc = await Food.create(base);
    return res
      .status(202)
      .json({ message: "Submitted for approval", id: doc._id });
  } catch (err) {
    const map = toValidationMap(err);
    if (map)
      return res
        .status(422)
        .json({ message: "Dữ liệu không hợp lệ", errors: map });
    console.error("[createFood]", err?.message || err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
}

export async function updateFood(req, res) {
  try {
    const userId = req.userId;
    const doc = await Food.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    const isOwner = String(doc.createdBy || "") === String(userId);
    const isAdmin = req.userRole === "admin";
    if (!isOwner && !isAdmin)
      return res.status(403).json({ message: "Forbidden" });

    const b = req.body || {};
    const set = {};

    if (b.massG !== undefined) {
      const m = Number(b.massG);
      if (!isNum(m) || m <= 0)
        return res.status(400).json({ message: "massG must be > 0" });
      set.massG = m;
    }
    if (b.unit !== undefined) set.unit = b.unit === "ml" ? "ml" : "g";

    ["name", "imageUrl", "portionName", "sourceType"].forEach((k) => {
      if (b[k] !== undefined) set[k] = typeof b[k] === "string" ? b[k].trim() : b[k];
    });
    ["kcal", "proteinG", "carbG", "fatG", "saltG", "sugarG", "fiberG"].forEach((k) => {
      if (b[k] !== undefined) set[k] = toNumOrNull(b[k]);
    });

    if (req.file) {
      try {
        ensureDir();
        const fn = `${userId || "anon"}-${Date.now()}.webp`;
        const out = path.join(FOOD_DIR, fn);
        await sharp(req.file.buffer)
          .rotate()
          .resize(800, 800, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 82 })
          .toFile(out);
        set.imageUrl = `/uploads/foods/${fn}`;
      } catch (e) {
        console.error("[food.upload][update]", e?.message || e);
      }
    }

    if (isAdmin && b.status && ["pending", "approved", "rejected"].includes(b.status)) {
      set.status = b.status;
      if (b.status === "approved") {
        if (!("approvedAt" in set)) set.approvedAt = new Date();
        if (!("approvedBy" in set)) set.approvedBy = userId;
      } else {
        // giữ nguyên approvedAt/approvedBy; nếu muốn clear, có thể bật:
        // set.approvedAt = null; set.approvedBy = null;
      }
    }

    // Dùng findByIdAndUpdate + runValidators để trigger validators của model
    await Food.findByIdAndUpdate(doc._id, { $set: set }, { runValidators: true });
    return res.json(responseOk());
  } catch (err) {
    const map = toValidationMap(err);
    if (map)
      return res
        .status(422)
        .json({ message: "Dữ liệu không hợp lệ", errors: map });
    console.error("[updateFood]", err?.message || err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
}

export async function deleteFood(req, res) {
  const userId = req.userId;
  const doc = await Food.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Not found" });

  const isOwner = String(doc.createdBy || "") === String(userId);
  const isAdmin = req.userRole === "admin";
  if (!isOwner && !isAdmin) return res.status(403).json({ message: "Forbidden" });

  await Food.deleteOne({ _id: doc._id });
  res.json(responseOk());
}

export async function approveFood(req, res) {
  const adminId = req.userId;
  const id = req.params.id;
  const doc = await Food.findByIdAndUpdate(
    id,
    { status: "approved", approvedAt: new Date(), approvedBy: adminId },
    { new: true, runValidators: true }
  ).lean();
  if (!doc) return res.status(404).json({ message: "Not found" });
  res.json(doc);
}

export async function rejectFood(req, res) {
  const id = req.params.id;
  const reason = (req.body?.reason || "").slice(0, 500);
  const doc = await Food.findByIdAndUpdate(
    id,
    { status: "rejected", rejectionReason: reason || undefined },
    { new: true, runValidators: true }
  ).lean();
  if (!doc) return res.status(404).json({ message: "Not found" });
  res.json(doc);
}

export async function toggleFavorite(req, res) {
  const userId = req.userId;
  const f = await Food.findById(req.params.id);
  if (!f) return res.status(404).json({ message: "Not found" });
  const has = f.likedBy.some((x) => String(x) === String(userId));
  f.likedBy = has
    ? f.likedBy.filter((x) => String(x) !== String(userId))
    : [...f.likedBy, userId];
  await f.save();
  res.json({ isFavorite: !has });
}

export async function recordView(req, res) {
  const userId = req.userId;
  const f = await Food.findById(req.params.id);
  if (!f) return res.status(404).json({ message: "Not found" });
  f.views += 1;
  const i = f.viewedBy.findIndex((v) => String(v.user) === String(userId));
  if (i >= 0) {
    f.viewedBy[i].lastViewedAt = new Date();
    f.viewedBy[i].count += 1;
  } else {
    f.viewedBy.push({ user: userId, lastViewedAt: new Date(), count: 1 });
  }
  await f.save();
  res.json(responseOk());
}

export async function createLog(req, res) {
  const userId = req.userId;
  const { foodId, date, hour, quantity = 1, massG } = req.body || {};
  if (!foodId || !date || hour == null)
    return res.status(400).json({ message: "foodId, date, hour required" });
  await NutritionLog.create({
    user: userId,
    food: foodId,
    date,
    hour,
    quantity,
    massG: massG ?? undefined,
  });
  res.json(responseOk());
}
