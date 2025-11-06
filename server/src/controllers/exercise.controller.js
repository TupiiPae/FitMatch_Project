// server/src/controllers/exercise.controller.js
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import sharp from "sharp";

import Exercise, {
  EXERCISE_TYPES,
  MUSCLE_GROUPS,
  EQUIPMENTS,
  LEVELS,
} from "../models/Exercise.js";
import { responseOk } from "../utils/response.js";

/* ====== Local paths for saving uploaded images (memoryStorage) ====== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// PROJECT_ROOT: .../server
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const UPLOAD_ROOT = path.join(PROJECT_ROOT, "uploads");
const EXERCISE_DIR = path.join(UPLOAD_ROOT, "exercises");
fs.mkdirSync(EXERCISE_DIR, { recursive: true });

/* ====== Helpers ====== */
const toNum = (v) => (v === "" || v == null ? null : Number(v));
const isJsonArray = (s) => typeof s === "string" && /^\s*\[/.test(s);

/** Lưu ảnh từ memoryStorage -> .webp vào /uploads/exercises */
async function saveImageFromBuffer(file) {
  if (!file?.buffer) return null;

  // Đặt tên file .webp an toàn
  const base = Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  const filename = `${base}.webp`;
  const absPath = path.join(EXERCISE_DIR, filename);

  // Dùng sharp để convert/nén
  await sharp(file.buffer)
    .rotate() // auto-orient
    .webp({ quality: 85 })
    .toFile(absPath);

  return filename;
}

/** Tạo URL tuyệt đối từ host + đường dẫn con */
function absoluteUrl(req, relativePath) {
  const host = `${req.protocol}://${req.get("host")}`;
  // relativePath kiểu '/uploads/exercises/xxx.webp'
  return `${host}${relativePath}`;
}

/** Chuẩn hoá: xoá chuỗi rỗng, parse mảng, ép số, gắn imageUrl nếu có file */
function normalizeBody(body, fileOrFiles, req) {
  const b = { ...(body || {}) };

  // parse mảng (primary/secondary từ FormData stringify hoặc chuỗi "A, B")
  ["primaryMuscles", "secondaryMuscles"].forEach((k) => {
    const val = b[k];
    if (Array.isArray(val)) return;
    if (isJsonArray(val)) {
      try {
        b[k] = JSON.parse(val);
      } catch {
        b[k] = [];
      }
    } else if (typeof val === "string" && val.trim()) {
      b[k] = val
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    } else {
      b[k] = [];
    }
  });

  // ép số
  if ("caloriePerRep" in b) b.caloriePerRep = toNum(b.caloriePerRep);

  // Ưu tiên file upload (nếu có) -> imageUrl
  // Hỗ trợ cả req.file (single) và req.files?.image?.[0] (fields)
  const imgFile = fileOrFiles?.image?.[0] || fileOrFiles || null;

  // Nếu diskStorage: file.path + file.filename sẽ tồn tại
  if (imgFile?.path && imgFile?.filename) {
    b.imageUrl = absoluteUrl(req, `/uploads/exercises/${imgFile.filename}`);
  }

  // Nếu memoryStorage: không có path/filename -> sẽ được xử lý ở create/update
  // (Ở đây chưa set gì, để hàm create/update sau khi save buffer mới gán imageUrl)

  // xoá key rỗng để tránh override
  Object.keys(b).forEach((k) => {
    const v = b[k];
    if (v === undefined || v === null) delete b[k];
    else if (typeof v === "string" && v.trim() === "") delete b[k];
    else if (Array.isArray(v) && v.length === 0) delete b[k];
  });

  return b;
}

/* =========================
 * Controllers
 * ========================= */
export async function listExercises(req, res, next) {
  try {
    const {
      q,
      type,
      equipment,
      level,
      primary, // filter theo 1 nhóm cơ chính
      secondary, // filter theo 1 nhóm cơ phụ
      limit = 10,
      skip = 0,
      status,
    } = req.query;

    const $and = [];
    if (q) $and.push({ $text: { $search: q } });
    if (type) $and.push({ type });
    if (equipment) $and.push({ equipment });
    if (level) $and.push({ level });
    if (status) $and.push({ status });
    if (primary) $and.push({ primaryMuscles: primary });
    if (secondary) $and.push({ secondaryMuscles: secondary });

    const filter = $and.length ? { $and } : {};
    const total = await Exercise.countDocuments(filter);
    const items = await Exercise.find(filter)
      .sort({ createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean();

    return responseOk(res, { items, total });
  } catch (err) {
    return next(err);
  }
}

export async function getExercise(req, res, next) {
  try {
    const { id } = req.params;
    const it = await Exercise.findById(id).lean();
    return responseOk(res, it);
  } catch (err) {
    return next(err);
  }
}

export async function createExercise(req, res, next) {
  try {
    // Hỗ trợ cả single("image") -> req.file và fields -> req.files.image[0]
    const imgFile = (req.files?.image && req.files.image[0]) || req.file || null;

    // Chuẩn hoá body trước
    const b = normalizeBody(req.body, req.files || req.file, req);

    // Nếu dùng memoryStorage và có ảnh -> lưu ra /uploads/exercises/*.webp
    if (imgFile && imgFile.buffer && !b.imageUrl) {
      const filename = await saveImageFromBuffer(imgFile);
      if (filename) {
        b.imageUrl = absoluteUrl(req, `/uploads/exercises/${filename}`);
      }
    }

    // Bổ sung các field mặc định
    if (!b.type) b.type = "Strength";
    if (req.admin?._id) b.createdByAdmin = req.admin._id;

    // Lưu DB (mô hình đang required imageUrl – giữ nguyên validate ở model)
    const doc = await Exercise.create(b);
    return responseOk(res, doc, 201);
  } catch (err) {
    // Trả 422 nếu lỗi validate, tránh làm server "ngắt"
    if (err?.name === "ValidationError") {
      return res.status(422).json({ success: false, message: err.message, errors: err.errors });
    }
    return next(err);
  }
}

export async function updateExercise(req, res, next) {
  try {
    const { id } = req.params;
    const imgFile = (req.files?.image && req.files.image[0]) || req.file || null;

    const upd = normalizeBody(req.body, req.files || req.file, req);

    // Nếu memoryStorage có ảnh mới -> lưu file và set imageUrl
    if (imgFile && imgFile.buffer && !upd.imageUrl) {
      const filename = await saveImageFromBuffer(imgFile);
      if (filename) {
        upd.imageUrl = absoluteUrl(req, `/uploads/exercises/${filename}`);
      }
    }

    const it = await Exercise.findByIdAndUpdate(id, upd, {
      new: true,
      runValidators: true,
    }).lean();

    return responseOk(res, it);
  } catch (err) {
    if (err?.name === "ValidationError") {
      return res.status(422).json({ success: false, message: err.message, errors: err.errors });
    }
    return next(err);
  }
}

export async function deleteExercise(req, res, next) {
  try {
    const { id } = req.params;
    await Exercise.findByIdAndDelete(id);
    return responseOk(res, { ok: true });
  } catch (err) {
    return next(err);
  }
}

export function meta(_req, res) {
  return responseOk(res, { EXERCISE_TYPES, MUSCLE_GROUPS, EQUIPMENTS, LEVELS });
}
