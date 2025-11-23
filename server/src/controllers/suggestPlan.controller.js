// server/src/controllers/suggestPlan.controller.js
import mongoose from "mongoose";
import SuggestPlan, {
  SUGGEST_PLAN_CATEGORIES,
  SUGGEST_PLAN_LEVELS,
  SUGGEST_PLAN_GOALS,
} from "../models/SuggestPlan.js";
import { uploadImageWithResize, deleteFile } from "../utils/cloudinary.js";
import { responseOk } from "../utils/response.js";
import { User } from "../models/User.js";

const nameRegex = /^[\p{L}\p{M}\s0-9'’\-.,()\/]+$/u;

// ----- Cửa sổ "user còn hoạt động" (7 ngày) -----
const ACTIVE_WINDOW_DAYS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
function getActiveSinceDate() {
  return new Date(Date.now() - ACTIVE_WINDOW_DAYS * MS_PER_DAY);
}

// DÙNG CHUNG FOLDER VỚI EXERCISES (giống controllers/exercise.controller.js)
const CLOUDINARY_EXERCISE_FOLDER =
  process.env.CLOUDINARY_EXERCISE_FOLDER || "asset/folder/exercises";

/* -------- Helper: parse sessions từ body (JSON hoặc multipart) -------- */
function parseSessions(raw) {
  let arr = raw;
  if (typeof raw === "string") {
    try {
      arr = JSON.parse(raw);
    } catch {
      arr = [];
    }
  }
  if (!Array.isArray(arr)) return [];

  return arr
    .map((s) => {
      const title = String(s.title || "").trim();
      const description = String(s.description || "").trim();

      const exercisesRaw = Array.isArray(s.exercises) ? s.exercises : [];
      const exercises = exercisesRaw
        .map((it) => {
          const exerciseId =
            it.exerciseId || it.exercise || it.exercise_id || it.exerciseIdStr;
          const reps = String(it.reps || it.repsText || "").trim();
          if (!exerciseId || !reps) return null;
          return {
            exercise: new mongoose.Types.ObjectId(exerciseId),
            reps,
          };
        })
        .filter(Boolean);

      if (!title || !exercises.length) return null;
      return { title, description, exercises };
    })
    .filter(Boolean);
}

/* -------- Helper: validate top-level fields (giống FE) -------- */
function validatePayload({
  name,
  descriptionHtml,
  sessions,
  category,
  level,
  goal,
}) {
  const errs = {};

  const nameTrim = String(name || "").trim();
  if (!nameTrim) {
    errs.name = "Vui lòng nhập tên lịch tập gợi ý";
  } else if (nameTrim.length > 200) {
    errs.name = "Tên lịch tối đa 200 ký tự";
  } else if (!nameRegex.test(nameTrim)) {
    errs.name =
      "Tên chỉ gồm chữ, số, khoảng trắng và ' - . , ( ) / (không dùng ký tự đặc biệt khác)";
  }

  const descHtml = String(descriptionHtml || "");
  const plainDesc = descHtml.replace(/<[^>]*>/g, "").trim();
  if (!plainDesc) {
    errs.descriptionHtml = "Vui lòng nhập mô tả lịch tập";
  }

  if (!Array.isArray(sessions) || sessions.length === 0) {
    errs.sessions = "Cần ít nhất 1 buổi tập trong lịch";
  }

  // ===== validate 3 field mới =====
  const cat = String(category || "").trim();
  if (!cat || !SUGGEST_PLAN_CATEGORIES.includes(cat)) {
    errs.category = "Vui lòng chọn Phân loại lịch tập";
  }

  const lvl = String(level || "").trim();
  if (!lvl || !SUGGEST_PLAN_LEVELS.includes(lvl)) {
    errs.level = "Vui lòng chọn Mức độ lịch tập";
  }

  const gl = String(goal || "").trim();
  if (!gl || !SUGGEST_PLAN_GOALS.includes(gl)) {
    errs.goal = "Vui lòng chọn Mục tiêu luyện tập";
  }

  return errs;
}

/* ===================== LIST ===================== */
// GET /api/admin/suggest-plans
export async function listSuggestPlans(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = Number(req.query.skip) || 0;
    const q = String(req.query.q || "").trim();

    const filter = {};
    if (q) {
      filter.name = new RegExp(
        q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
    }

    const total = await SuggestPlan.countDocuments(filter);
    const docs = await SuggestPlan.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const items = docs.map((d) => ({
      ...d,
      sessionsCount: (d.sessions || []).length,
      exercisesCount: (d.sessions || []).reduce(
        (acc, s) => acc + ((s.exercises || []).length || 0),
        0
      ),
    }));

    return res.json(responseOk({ items, total, limit, skip }));
  } catch (err) {
    next(err);
  }
}

/* ===================== GET 1 ===================== */
// GET /api/admin/suggest-plans/:id
export async function getSuggestPlan(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await SuggestPlan.findById(id)
      .populate({
        path: "sessions.exercises.exercise",
        select: "name imageUrl type",
      })
      .lean();
    if (!doc) {
      return res
        .status(404)
        .json({ ok: false, message: "Không tìm thấy lịch tập gợi ý" });
    }

    return res.json(responseOk(doc));
  } catch (err) {
    next(err);
  }
}

/* ===================== CREATE ===================== */
// POST /api/admin/suggest-plans
export async function createSuggestPlan(req, res, next) {
  try {
    const body = req.body || {};
    const sessions = parseSessions(body.sessions);
    const name = body.name;
    const descriptionHtml = body.descriptionHtml;
    const category = body.category;
    const level = body.level;
    const goal = body.goal;

    // validate giống FE
    const errs = validatePayload({
      name,
      descriptionHtml,
      sessions,
      category,
      level,
      goal,
    });
    if (!req.file && !body.imageUrl) {
      errs.imageUrl = "Vui lòng chọn ảnh hoặc dán link hình ảnh";
    }
    if (Object.keys(errs).length) {
      return res
        .status(422)
        .json({ ok: false, message: "Dữ liệu không hợp lệ", errors: errs });
    }

    // upload ảnh
    let imageUrl = (body.imageUrl || "").trim() || undefined;
    if (req.file && req.file.buffer) {
      imageUrl = await uploadImageWithResize(
        req.file.buffer,
        CLOUDINARY_EXERCISE_FOLDER,
        { width: 800, height: 800, fit: "inside" },
        { quality: 85 }
      );
    }

    const createdByAdmin =
      req.adminId || req.userId || (req.admin && req.admin._id) || undefined;

    const doc = await SuggestPlan.create({
      name: String(name).trim(),
      descriptionHtml,
      imageUrl,
      category: String(category || "").trim(),
      level: String(level || "").trim(),
      goal: String(goal || "").trim(),
      sessions,
      createdByAdmin,
    });

    return res.status(201).json(responseOk(doc));
  } catch (err) {
    next(err);
  }
}

/* ===================== UPDATE ===================== */
// PATCH /api/admin/suggest-plans/:id
export async function updateSuggestPlan(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const existing = await SuggestPlan.findById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ ok: false, message: "Không tìm thấy lịch tập gợi ý" });
    }

    const sessions = parseSessions(body.sessions ?? existing.sessions);
    const name = body.name ?? existing.name;
    const descriptionHtml = body.descriptionHtml ?? existing.descriptionHtml;
    const category = body.category ?? existing.category;
    const level = body.level ?? existing.level;
    const goal = body.goal ?? existing.goal;

    const errs = validatePayload({
      name,
      descriptionHtml,
      sessions,
      category,
      level,
      goal,
    });
    if (!req.file && !(body.imageUrl || existing.imageUrl)) {
      errs.imageUrl = "Vui lòng chọn ảnh hoặc dán link hình ảnh";
    }
    if (Object.keys(errs).length) {
      return res
        .status(422)
        .json({ ok: false, message: "Dữ liệu không hợp lệ", errors: errs });
    }

    let imageUrl =
      (body.imageUrl && String(body.imageUrl).trim()) || existing.imageUrl;

    if (req.file && req.file.buffer) {
      const newUrl = await uploadImageWithResize(
        req.file.buffer,
        CLOUDINARY_EXERCISE_FOLDER,
        { width: 800, height: 800, fit: "inside" },
        { quality: 85 }
      );
      if (existing.imageUrl && existing.imageUrl.startsWith("http")) {
        deleteFile(existing.imageUrl, "image").catch(() => {});
      }
      imageUrl = newUrl;
    }

    existing.name = String(name).trim();
    existing.descriptionHtml = descriptionHtml;
    existing.imageUrl = imageUrl;
    existing.sessions = sessions;
    existing.category = String(category || "").trim();
    existing.level = String(level || "").trim();
    existing.goal = String(goal || "").trim();

    await existing.save();

    return res.json(responseOk(existing));
  } catch (err) {
    next(err);
  }
}

/* ===================== DELETE ===================== */
// DELETE /api/admin/suggest-plans/:id
export async function deleteSuggestPlan(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await SuggestPlan.findById(id);
    if (!doc) {
      return res
        .status(404)
        .json({ ok: false, message: "Không tìm thấy lịch tập gợi ý" });
    }

    // Nếu có user (không bị block) đã lưu → chặn xoá luôn (không còn logic 7 ngày)
    if (Array.isArray(doc.savedBy) && doc.savedBy.length > 0) {
      const activeUsersCount = await User.countDocuments({
        _id: { $in: doc.savedBy },
        blocked: { $ne: true },
      });

      if (activeUsersCount > 0) {
        return res.status(409).json({
          ok: false,
          code: "SUGGEST_PLAN_IN_USE_SAVED_USERS",
          message: `Lịch tập gợi ý "${doc.name}" đang được ${activeUsersCount} người dùng lưu, không thể xoá.`,
          savedCount: activeUsersCount,
        });
      }
    }

    if (doc.imageUrl && doc.imageUrl.startsWith("http")) {
      deleteFile(doc.imageUrl, "image").catch(() => {});
    }

    await doc.deleteOne();
    return res.json(responseOk({ success: true }));
  } catch (err) {
    next(err);
  }
}
