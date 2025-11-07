// server/src/controllers/exercise.controller.js
import path from "path";
import fs from "fs";
import sharp from "sharp";
import Exercise, {
  EXERCISE_TYPES,
  MUSCLE_GROUPS,
  EQUIPMENTS,
  LEVELS,
} from "../models/Exercise.js";
import { responseOk } from "../utils/response.js";
import {
  EXERCISE_IMG_DIR as EX_DIR,
  EXERCISE_VID_DIR as EX_VID_DIR,
} from "../middleware/upload.js";

/* ========= Helpers ========= */
const toNum = (v) => (v === "" || v == null ? null : Number(v));
const isJsonArray = (s) => typeof s === "string" && /^\s*\[/.test(s);
const ensureDir = (d) => { try { fs.mkdirSync(d, { recursive: true }); } catch {} };

/** Lưu ảnh từ buffer -> .webp vào /uploads/exercises, trả tên file */
async function saveImageFromBuffer(file) {
  if (!file?.buffer) return null;
  ensureDir(EX_DIR);
  const base = Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  const filename = `${base}.webp`;
  const absPath = path.join(EX_DIR, filename);
  await sharp(file.buffer)
    .rotate()
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(absPath);
  return filename;
}

/** Chọn đuôi video an toàn */
function pickVideoExt(mt, original = "") {
  const low = (mt || "").toLowerCase();
  const nameLow = (original || "").toLowerCase();
  if (low.includes("webm") || nameLow.endsWith(".webm")) return ".webm";
  if (low.includes("ogg") || nameLow.endsWith(".ogv") || nameLow.endsWith(".ogg")) return ".ogv";
  if (nameLow.endsWith(".mov")) return ".mov";
  if (nameLow.endsWith(".mkv")) return ".mkv";
  return ".mp4";
}

/** Lưu video từ buffer -> file gốc trong /uploads/exercises_videos, trả tên file */
async function saveVideoFromBuffer(file) {
  if (!file?.buffer) return null;
  ensureDir(EX_VID_DIR);
  const base = Date.now() + "-" + Math.random().toString(36).slice(2, 10);
  const ext = pickVideoExt(file.mimetype, file.originalname);
  const filename = `${base}${ext}`;
  const absPath = path.join(EX_VID_DIR, filename);
  await fs.promises.writeFile(absPath, file.buffer);
  return filename;
}

/** Chuẩn hoá body: parse mảng, ép số, loại bỏ chuỗi rỗng */
function normalizeBody(body) {
  const b = { ...(body || {}) };

  ["primaryMuscles", "secondaryMuscles"].forEach((k) => {
    const val = b[k];
    if (Array.isArray(val)) return;
    if (isJsonArray(val)) {
      try { b[k] = JSON.parse(val); } catch { b[k] = []; }
    } else if (typeof val === "string" && val.trim()) {
      b[k] = val.split(",").map((x) => x.trim()).filter(Boolean);
    } else {
      b[k] = [];
    }
  });

  if ("caloriePerRep" in b) b.caloriePerRep = toNum(b.caloriePerRep);

  Object.keys(b).forEach((k) => {
    const v = b[k];
    if (v === undefined || v === null) delete b[k];
    else if (typeof v === "string" && v.trim() === "") delete b[k];
  });

  return b;
}

/* ========= Controllers ========= */

// GET /api/admin/exercises
export async function listExercises(req, res, next) {
  try {
    const {
      q,
      type,
      equipment,
      level,
      primary,
      secondary,
      status,
      limit = 10,
      skip = 0,
    } = req.query;

    const and = [];
    const qTrim = (q || "").trim();
    if (qTrim) and.push({ $text: { $search: qTrim } });
    if (type) and.push({ type });
    if (equipment) and.push({ equipment });
    if (level) and.push({ level });
    if (status) and.push({ status });
    if (primary) and.push({ primaryMuscles: primary });
    if (secondary) and.push({ secondaryMuscles: secondary });

    const filter = and.length ? { $and: and } : {};
    const lim = Math.max(1, Number(limit));
    const skp = Math.max(0, Number(skip));

    const [total, items] = await Promise.all([
      Exercise.countDocuments(filter),
      Exercise.find(filter).sort({ createdAt: -1 }).skip(skp).limit(lim).lean(),
    ]);

    const hasMore = skp + items.length < total;
    return res.json({ items, total, limit: lim, skip: skp, hasMore });
  } catch (err) {
    return next(err);
  }
}

// GET /api/admin/exercises/:id
export async function getExercise(req, res, next) {
  try {
    const it = await Exercise.findById(req.params.id).lean();
    if (!it) return res.status(404).json({ message: "Not found" });
    return res.json(it);
  } catch (err) {
    return next(err);
  }
}

// POST /api/admin/exercises  (ảnh gửi field "image"; KHÔNG nhận video ở đây)
export async function createExercise(req, res, next) {
  try {
    const imgFile = (req.files?.image && req.files.image[0]) || req.file || null;
    const b = normalizeBody(req.body);

    if (!b.type) b.type = "Strength";
    if (req.admin?._id) b.createdByAdmin = req.admin._id;
    b.status = b.status || "active";

    if (imgFile?.buffer && !b.imageUrl) {
      const filename = await saveImageFromBuffer(imgFile);
      if (filename) b.imageUrl = `/uploads/exercises/${filename}`;
    }

    const doc = await Exercise.create(b);
    return res.status(201).json(doc);
  } catch (err) {
    if (err?.name === "ValidationError") {
      return res.status(422).json({ success: false, message: err.message, errors: err.errors });
    }
    return next(err);
  }
}

// PATCH /api/admin/exercises/:id
export async function updateExercise(req, res, next) {
  try {
    const { id } = req.params;

    // --- Nhánh gỡ video: bỏ qua mọi validator khác ---
    const isRemoveVideo =
      req.body?.__removeVideo === true || req.body?.__removeVideo === "true";
    if (isRemoveVideo) {
      const it = await Exercise.findByIdAndUpdate(
        id,
        { $unset: { videoUrl: 1 } },
        {
          new: true,
          runValidators: false,     // << quan trọng: không validate primaryMuscles...
        }
      ).lean();

      if (!it) return res.status(404).json({ message: "Not found" });
      return res.json({ ok: true, videoUrl: it.videoUrl || "" });
    }

    // --- Nhánh update thông thường (ảnh/link/thông tin) ---
    const imgFile = (req.files?.image && req.files.image[0]) || req.file || null;
    const upd = normalizeBody(req.body);

    if (imgFile?.buffer && !upd.imageUrl) {
      const filename = await saveImageFromBuffer(imgFile);
      if (filename) upd.imageUrl = `/uploads/exercises/${filename}`;
    }

    const it = await Exercise.findByIdAndUpdate(id, upd, {
      new: true,
      runValidators: true,
      context: "query",
      // validateModifiedOnly không tác dụng đáng kể trên update validators,
      // nhưng cứ để đây cho path khác:
      // validateModifiedOnly: true,
    }).lean();

    if (!it) return res.status(404).json({ message: "Not found" });
    return res.json(it);
  } catch (err) {
    if (err?.name === "ValidationError") {
      return res.status(422).json({
        success: false,
        message: err.message,
        errors: err.errors
      });
    }
    return next(err);
  }
}

// POST /api/admin/exercises/:id/video
export async function uploadExerciseVideo(req, res, next) {
  try {
    const { id } = req.params;
    const vidFile = (req.files?.video && req.files.video[0]) || req.file || null;
    if (!vidFile?.buffer) return res.status(400).json({ message: "Không có file video" });

    const vname = await saveVideoFromBuffer(vidFile);
    const videoUrl = `/uploads/exercises_videos/${vname}`;

    await Exercise.findByIdAndUpdate(id, { $set: { videoUrl } }, { runValidators: true });
    return res.json({ ok: true, videoUrl });
  } catch (err) {
    return next(err);
  }
}

// DELETE /api/admin/exercises/:id
export async function deleteExercise(req, res, next) {
  try {
    const { id } = req.params;
    await Exercise.findByIdAndDelete(id);
    return res.json(responseOk());
  } catch (err) {
    return next(err);
  }
}

// GET /api/admin/exercises/meta
export function meta(_req, res) {
  return res.json({ EXERCISE_TYPES, MUSCLE_GROUPS, EQUIPMENTS, LEVELS });
}
export const getExerciseMeta = meta;
