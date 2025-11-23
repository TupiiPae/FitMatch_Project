// server/src/controllers/food.controller.js
import path from "path";
import fs from "fs";
import sharp from "sharp";
import Food from "../models/Food.js";
import NutritionLog from "../models/NutritionLog.js";
import SuggestMenu from "../models/SuggestMenu.js";
import { responseOk } from "../utils/response.js";
import { FOOD_DIR } from "../middleware/upload.js";
import { uploadImageWithResize, deleteFile } from "../utils/cloudinary.js";

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

// ---- helper: nhận diện admin (lv1/lv2/legacy) ----
function isAdminRole(req) {
  const role = String(req.userRole || "");
  const level = Number(req.userLevel || 0);
  return (
    role === "admin" ||
    role.startsWith("admin_") || // "admin_lv1" | "admin_lv2"
    level >= 1
  );
}

export async function listFoods(req, res) {
  const userId = req.userId;
  const isAdmin = isAdminRole(req);

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
    description: 1,
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
    ...(q ? { score: { $meta: "textScore" } } : {}),
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
    const isAdmin = isAdminRole(req);
    const b = req.body || {};

    const name = String(b.name || "").trim();
    const mass = Number(b.massG);
    const kcal = toNumOrNull(b.kcal);
    
    // Kiểm tra rất cơ bản, phần còn lại giao cho Mongoose validators ở model
    if (!name || !isNum(mass) || mass <= 0) {
      return res.status(400).json({ message: "name & massG required" });
    }
    
    // kcal là required trong model
    if (kcal === null || kcal === undefined) {
      return res.status(400).json({ message: "kcal is required" });
    }

    // Ảnh: chấp nhận multipart (req.file) hoặc link (b.imageUrl)
    let imageUrl = b.imageUrl || null;
    if (req.file) {
      try {
        // Upload lên Cloudinary
        imageUrl = await uploadImageWithResize(
          req.file.buffer,
          "asset/folder/foods",
          { width: 800, height: 800, fit: "inside", withoutEnlargement: true },
          { quality: 82 }
        );
      } catch (e) {
        console.error("[food.upload]", e?.message || e);
      }
    }

    // Base doc chung
    const baseDoc = {
      name,
      imageUrl,
      portionName: b.portionName || undefined,
      description: typeof b.description === "string" ? b.description.trim() || undefined : undefined,
      massG: mass,
      unit: b.unit === "ml" ? "ml" : "g",
      kcal: kcal, // Đã validate ở trên
      proteinG: toNumOrNull(b.proteinG),
      carbG: toNumOrNull(b.carbG),
      fatG: toNumOrNull(b.fatG),
      saltG: toNumOrNull(b.saltG),
      sugarG: toNumOrNull(b.sugarG),
      fiberG: toNumOrNull(b.fiberG),
      sourceType: b.sourceType || (isAdmin ? "other" : "user_submitted"),
    };

    if (isAdmin) {
      // Admin tạo → tự approved
      baseDoc.createdByAdmin = userId;
      baseDoc.status = "approved";
      baseDoc.approvedBy = userId;
      baseDoc.approvedAt = new Date();
    } else {
      // User tạo → pending
      baseDoc.createdBy = userId;
      baseDoc.status = "pending";
    }

    const doc = await Food.create(baseDoc);

    // Trả mã phù hợp
    if (isAdmin) {
      return res.status(201).json({ message: "Created & approved", id: doc._id });
    }
    return res.status(202).json({ message: "Submitted for approval", id: doc._id });
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
    const isAdmin = isAdminRole(req);
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

    ["name", "imageUrl", "portionName", "description", "sourceType"].forEach((k) => {
      if (b[k] !== undefined) {
        const v = typeof b[k] === "string" ? b[k].trim() : b[k];
        // Không ghi đè imageUrl nếu là chuỗi rỗng
        if (k === "imageUrl" && v === "") return;
        set[k] = v;
      }
    });
    ["kcal", "proteinG", "carbG", "fatG", "saltG", "sugarG", "fiberG"].forEach((k) => {
      if (b[k] !== undefined) set[k] = toNumOrNull(b[k]);
    });

    if (req.file) {
      try {
        // Xóa ảnh cũ từ Cloudinary nếu có
        if (doc.imageUrl && doc.imageUrl.includes("cloudinary.com")) {
          await deleteFile(doc.imageUrl, "image").catch(() => {});
        }
        
        // Upload ảnh mới lên Cloudinary
        const newImageUrl = await uploadImageWithResize(
          req.file.buffer,
          "asset/folder/foods",
          { width: 800, height: 800, fit: "inside", withoutEnlargement: true },
          { quality: 82 }
        );
        set.imageUrl = newImageUrl;
      } catch (e) {
        console.error("[food.upload][update]", e?.message || e);
      }
    }

    // Admin có quyền đổi status
    if (isAdmin && b.status && ["pending", "approved", "rejected"].includes(b.status)) {
      set.status = b.status;
      if (b.status === "approved") {
        if (!("approvedAt" in set)) set.approvedAt = new Date();
        if (!("approvedBy" in set)) set.approvedBy = userId;
        // set.rejectionReason = undefined; // nếu muốn clear lý do cũ
      } else if (b.status === "rejected") {
        const raw = String(b.rejectionReason ?? "").trim();
        if (!raw) {
          return res.status(400).json({ message: "Vui lòng nhập lý do từ chối (1–500 ký tự)" });
        }
        set.rejectionReason = raw.slice(0, 500);
        // Không buộc xóa approvedAt/approvedBy để giữ dấu vết; cần thì uncomment:
        // set.approvedAt = null; set.approvedBy = null;
      }
    }

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
  const isAdmin = isAdminRole(req);
  if (!isOwner && !isAdmin) return res.status(403).json({ message: "Forbidden" });

  // 🔍 Tìm các thực đơn gợi ý đang sử dụng món ăn này
  const menus = await SuggestMenu.find(
    { "days.meals.items.food": doc._id },
    { _id: 1, name: 1 }
  ).lean();

  if (menus.length > 0) {
    const names = menus
      .map((m) => m.name || `#${String(m._id).slice(-6)}`)
      .join(", ");

    return res.status(400).json({
      message: `Món ăn này đang được sử dụng trong ${menus.length} thực đơn gợi ý: ${names}. Vui lòng gỡ món ra khỏi các thực đơn đó trước khi xoá.`,
      menus: menus.map((m) => ({
        id: m._id,
        name: m.name,
      })),
    });
  }

  await Food.deleteOne({ _id: doc._id });
  return res.json(responseOk());
}

export async function approveFood(req, res) {
  const adminId = req.userId;
  const id = req.params.id;
  const doc = await Food.findByIdAndUpdate(
    id,
    { status: "approved", approvedAt: new Date(), approvedBy: adminId, rejectionReason: undefined },
    { new: true, runValidators: true }
  ).lean();
  if (!doc) return res.status(404).json({ message: "Not found" });
  res.json(doc);
}

export async function rejectFood(req, res) {
  const id = req.params.id;
  const raw = String(req.body?.reason ?? "").trim();
  if (!raw) {
    return res.status(400).json({ message: "Vui lòng nhập lý do từ chối" });
  }
  const reason = raw.slice(0, 500);
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
