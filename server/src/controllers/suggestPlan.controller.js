// server/src/controllers/suggestPlan.controller.js
import mongoose from "mongoose";
import SuggestPlan from "../models/SuggestPlan.js";
import { uploadImageWithResize, deleteFile } from "../utils/cloudinary.js";
import { responseOk } from "../utils/response.js";

const nameRegex = /^[\p{L}\p{M}\s0-9'’\-.,()\/]+$/u;

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
function validatePayload({ name, descriptionHtml, sessions }) {
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
      filter.name = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
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

    // TRẢ RESPONSE ĐÚNG DẠNG { ok:true, data:{ items,total,limit,skip } }
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

    // validate giống FE
    const errs = validatePayload({ name, descriptionHtml, sessions });
    if (!req.file && !body.imageUrl) {
      errs.imageUrl = "Vui lòng chọn ảnh hoặc dán link hình ảnh";
    }
    if (Object.keys(errs).length) {
      return res
        .status(422)
        .json({ ok: false, message: "Dữ liệu không hợp lệ", errors: errs });
    }

    // upload ảnh: dùng CHUNG folder với exercises
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
      sessions,
      createdByAdmin,
    });

    // 201 + { ok:true, data:doc } -> FE nhận doc (createSuggestPlanApi)
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

    const errs = validatePayload({ name, descriptionHtml, sessions });
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

    // Nếu có file mới -> upload, rồi (tuỳ chọn) xoá ảnh cũ
    if (req.file && req.file.buffer) {
      const newUrl = await uploadImageWithResize(
        req.file.buffer,
        CLOUDINARY_EXERCISE_FOLDER,
        { width: 800, height: 800, fit: "inside" },
        { quality: 85 }
      );
      if (existing.imageUrl && existing.imageUrl.startsWith("http")) {
        // Không bắt buộc, nhưng tốt nếu muốn dọn Cloudinary
        deleteFile(existing.imageUrl, "image").catch(() => {});
      }
      imageUrl = newUrl;
    }

    existing.name = String(name).trim();
    existing.descriptionHtml = descriptionHtml;
    existing.imageUrl = imageUrl;
    existing.sessions = sessions;

    await existing.save();

    // Trả lại doc mới
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

    // Xoá ảnh trên Cloudinary nếu muốn
    if (doc.imageUrl && doc.imageUrl.startsWith("http")) {
      deleteFile(doc.imageUrl, "image").catch(() => {});
    }

    await doc.deleteOne();
    return res.json(responseOk({ success: true }));
  } catch (err) {
    next(err);
  }
}
