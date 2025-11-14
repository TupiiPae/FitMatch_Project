// server/src/controllers/suggestPlan.controller.js
import SuggestPlan from "../models/SuggestPlan.js";
import { responseOk } from "../utils/response.js";
import { uploadImageWithResize } from "../utils/cloudinary.js";

/** Tạo slug đơn giản từ name */
function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // bỏ dấu tiếng Việt
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Chuẩn hoá mảng sessions từ body FE */
function normalizeSessions(rawSessions) {
  let sessions = rawSessions;

  if (typeof rawSessions === "string") {
    try {
      sessions = JSON.parse(rawSessions);
    } catch {
      sessions = [];
    }
  }
  if (!Array.isArray(sessions)) sessions = [];

  const result = sessions
    .map((s) => {
      const title = String(s?.title || "").trim();
      const description = String(s?.description || "").trim();
      let exercises = s?.exercises || s?.items || [];

      if (typeof exercises === "string") {
        try {
          exercises = JSON.parse(exercises);
        } catch {
          exercises = [];
        }
      }
      if (!Array.isArray(exercises)) exercises = [];

      const exMapped = exercises
        .map((e) => {
          const id = e?.exerciseId || e?.exercise || e?._id;
          const reps = String(e?.reps || e?.repsText || "").trim();
          if (!id || !reps) return null;
          return {
            exercise: id,
            reps,
          };
        })
        .filter(Boolean);

      if (!title || exMapped.length === 0) return null;

      return {
        title,
        description,
        exercises: exMapped,
      };
    })
    .filter(Boolean);

  return result;
}

/** POST /api/admin/suggest-plans */
export const createSuggestPlanAdmin = async (req, res, next) => {
  try {
    const { name, descriptionHtml } = req.body;

    const cleanName = String(name || "").trim();
    if (!cleanName) {
      return res.status(400).json({ message: "Vui lòng nhập tên lịch tập" });
    }

    const descHtml = String(descriptionHtml || "");
    const plainDesc = descHtml.replace(/<[^>]*>/g, "").trim();
    if (!plainDesc) {
      return res.status(400).json({ message: "Vui lòng nhập mô tả lịch tập" });
    }

    const sessions = normalizeSessions(req.body.sessions);
    if (!sessions.length) {
      return res
        .status(400)
        .json({ message: "Lịch tập cần ít nhất 1 buổi tập hợp lệ" });
    }

    // Ảnh: nếu có file -> upload Cloudinary, nếu không -> dùng imageUrl từ body
    let imageUrl = (req.body.imageUrl || "").trim();

    if (req.file && req.file.buffer) {
      // folder tuỳ bạn, mình gợi ý:
      imageUrl = await uploadImageWithResize(
        req.file.buffer,
        "fitmatch/suggest-plans",
        { width: 800, height: 800, fit: "cover" },
        { quality: 85 }
      );
    }

    if (!imageUrl) {
      return res
        .status(400)
        .json({ message: "Vui lòng tải lên hoặc dán link hình ảnh" });
    }

    const slug = slugify(cleanName);

    const doc = await SuggestPlan.create({
      name: cleanName,
      slug,
      descriptionHtml: descHtml,
      imageUrl,
      sessions,
      createdBy:
        req.admin?._id || req.userId || req.user?._id || undefined,
    });

    return responseOk(res, doc);
  } catch (err) {
    next(err);
  }
};

/** GET /api/admin/suggest-plans */
export const listSuggestPlansAdmin = async (req, res, next) => {
  try {
    const { q, limit = 20, skip = 0, status } = req.query;

    const cond = {};
    if (q) cond.name = { $regex: q, $options: "i" };
    if (status) cond.status = status;

    const lim = Number(limit) || 20;
    const sk = Number(skip) || 0;

    const [items, total] = await Promise.all([
      SuggestPlan.find(cond)
        .sort({ createdAt: -1 })
        .skip(sk)
        .limit(lim),
      SuggestPlan.countDocuments(cond),
    ]);

    return responseOk(res, { items, total, limit: lim, skip: sk });
  } catch (err) {
    next(err);
  }
};
