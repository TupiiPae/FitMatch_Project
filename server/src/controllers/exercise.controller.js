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
import { uploadImageWithResize, uploadVideo, deleteFile } from "../utils/cloudinary.js";
import WorkoutPlan from "../models/WorkoutPlan.js";
import { User } from "../models/User.js";
import SuggestPlan from "../models/SuggestPlan.js"; // 🔴 THÊM: để check bài tập đang dùng trong Lịch tập gợi ý

/* ========= Helpers ========= */
const toNum = (v) => (v === "" || v == null ? null : Number(v));
const isJsonArray = (s) => typeof s === "string" && /^\s*\[/.test(s);
const ensureDir = (d) => { try { fs.mkdirSync(d, { recursive: true }); } catch {} };

// Cửa sổ 7 ngày
const ACTIVE_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
function getActiveSinceDate() {
  return new Date(Date.now() - ACTIVE_WINDOW_DAYS * MS_PER_DAY);
}

/** Upload ảnh từ buffer lên Cloudinary, trả về URL */
async function saveImageFromBuffer(file) {
  if (!file?.buffer) return null;
  try {
    const imageUrl = await uploadImageWithResize(
      file.buffer,
      "asset/folder/exercises",
      { width: 1200, height: 1200, fit: "inside", withoutEnlargement: true },
      { quality: 85 }
    );
    return imageUrl;
  } catch (error) {
    console.error("[saveImageFromBuffer]", error);
    return null;
  }
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

/** Upload video từ buffer lên Cloudinary, trả về URL */
async function saveVideoFromBuffer(file) {
  if (!file?.buffer) return null;
  try {
    const videoUrl = await uploadVideo(
      file.buffer,
      "asset/folder/exercise_videos"
    );
    return videoUrl;
  } catch (error) {
    console.error("[saveVideoFromBuffer]", error);
    return null;
  }
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
const pickSort = (s) => {
  const v = String(s || "").trim().toLowerCase();
  if (v === "name" || v === "name_asc") return { name: 1 };
  if (v === "-name" || v === "name_desc") return { name: -1 };
  return { createdAt: -1 };
};

// GET /api/admin/exercises
export async function listExercises(req, res, next) {
  try {
    const { q, type, equipment, level, primary, secondary, status, limit = 10, skip = 0, sort } = req.query;
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

    const sortObj = pickSort(sort);
    const [total, items] = await Promise.all([
      Exercise.countDocuments(filter),
      Exercise.find(filter).sort(sortObj).skip(skp).limit(lim).lean(),
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

// POST /api/admin/exercises
export async function createExercise(req, res, next) {
  try {
    const imgFile = (req.files?.image && req.files.image[0]) || req.file || null;
    const b = normalizeBody(req.body);

    if (!b.type) b.type = "Strength";
    if (req.admin?._id) b.createdByAdmin = req.admin._id;
    b.status = b.status || "active";

    if (imgFile?.buffer && !b.imageUrl) {
      const imageUrl = await saveImageFromBuffer(imgFile);
      if (imageUrl) b.imageUrl = imageUrl;
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
      const existing = await Exercise.findById(id).lean();
      
      if (existing?.videoUrl && existing.videoUrl.includes("cloudinary.com")) {
        await deleteFile(existing.videoUrl, "video").catch(() => {});
      }
      
      const it = await Exercise.findByIdAndUpdate(
        id,
        { $unset: { videoUrl: 1 } },
        {
          new: true,
          runValidators: false,
        }
      ).lean();

      if (!it) return res.status(404).json({ message: "Not found" });
      return res.json({ ok: true, videoUrl: it.videoUrl || "" });
    }

    // --- Nhánh update thông thường ---
    const imgFile = (req.files?.image && req.files.image[0]) || req.file || null;
    const upd = normalizeBody(req.body);

    if (imgFile?.buffer && !upd.imageUrl) {
      const existing = await Exercise.findById(id).lean();
      if (existing?.imageUrl && existing.imageUrl.includes("cloudinary.com")) {
        await deleteFile(existing.imageUrl, "image").catch(() => {});
      }
      
      const imageUrl = await saveImageFromBuffer(imgFile);
      if (imageUrl) upd.imageUrl = imageUrl;
    }

    const it = await Exercise.findByIdAndUpdate(id, upd, {
      new: true,
      runValidators: true,
      context: "query",
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

    const existing = await Exercise.findById(id).lean();
    if (existing?.videoUrl && existing.videoUrl.includes("cloudinary.com")) {
      await deleteFile(existing.videoUrl, "video").catch(() => {});
    }

    const videoUrl = await saveVideoFromBuffer(vidFile);
    if (!videoUrl) {
      return res.status(500).json({ message: "Lỗi upload video" });
    }

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

    const exercise = await Exercise.findById(id).lean();

    // Nếu không tồn tại: giữ behavior cũ (coi như xoá xong)
    if (!exercise) {
      await Exercise.findByIdAndDelete(id);
      return res.json(responseOk());
    }

    /* --------- 1. RÀNG BUỘC: đang dùng trong Lịch tập gợi ý --------- */
    const usedInSuggestPlan = await SuggestPlan.exists({
      "sessions.exercises.exercise": exercise._id,
    });

    if (usedInSuggestPlan) {
      return res.status(409).json({
        ok: false,
        code: "EXERCISE_IN_USE_SUGGEST_PLAN",
        message:
          "Không thể xoá bài tập này vì đang được sử dụng trong một hoặc nhiều Lịch tập gợi ý. " +
          "Vui lòng chỉnh sửa hoặc xoá các lịch tập gợi ý liên quan trước.",
      });
    }

    /* --------- 2. RÀNG BUỘC: còn user active < 7 ngày dùng trong WorkoutPlan? --------- */
    const activeSince = getActiveSinceDate();

    const userIds = await WorkoutPlan.distinct("user", {
      status: "active",
      "items.exercise": exercise._id,
    });

    if (userIds.length) {
      const activeUsersCount = await User.countDocuments({
        _id: { $in: userIds },
        blocked: { $ne: true },
        $or: [
          { lastLoginAt: { $gte: activeSince } },
          { lastActiveAt: { $gte: activeSince } },
          { updatedAt: { $gte: activeSince } },
        ],
      });

      if (activeUsersCount > 0) {
        return res.status(409).json({
          ok: false,
          code: "EXERCISE_IN_USE_ACTIVE_USERS",
          message:
            "Bài tập này đang được người dùng hoạt động sử dụng trong lịch tập cá nhân 7 ngày gần đây, không thể xoá.",
        });
      }
    }

    /* --------- 3. Không còn ràng buộc -> xoá Cloudinary + document --------- */
    if (exercise.imageUrl && exercise.imageUrl.includes("cloudinary.com")) {
      await deleteFile(exercise.imageUrl, "image").catch(() => {});
    }
    if (exercise.videoUrl && exercise.videoUrl.includes("cloudinary.com")) {
      await deleteFile(exercise.videoUrl, "video").catch(() => {});
    }

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
