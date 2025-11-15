// server/src/controllers/suggestPlan.user.controller.js
import SuggestPlan from "../models/SuggestPlan.js";
import Exercise from "../models/Exercise.js";
import { responseOk } from "../utils/response.js";

function normalizeImage(u) {
  if (!u) return "";
  const s = String(u).trim();
  if (!s) return "";
  return (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/"))
    ? s
    : `/${s}`;
}

// Đếm số buổi & số bài tập
function calcStats(plan) {
  const sessions = Array.isArray(plan.sessions) ? plan.sessions : [];
  const sessionsCount = sessions.length;
  const exercisesCount = sessions.reduce(
    (sum, s) => sum + ((s.exercises || s.items || []).length || 0),
    0
  );
  return { sessionsCount, exercisesCount };
}

/**
 * GET /api/user/suggest-plans
 * query: q, category, level, goal, scope=saved|all, limit, skip
 */
export async function listSuggestPlansUser(req, res) {
  const {
    q,
    category,
    level,
    goal,
    scope = "all",
    limit = 20,
    skip = 0,
  } = req.query;
  const userId = req.userId;

  const find = { status: "active" }; // nếu model bạn chưa có status thì bỏ dòng này

  if (q) {
    find.name = { $regex: String(q).trim(), $options: "i" };
  }
  if (category) find.category = category;
  if (level) find.level = level;
  if (goal) find.goal = goal;

  if (scope === "saved") {
    find.savedBy = userId;
  }

  const [docs, total] = await Promise.all([
    SuggestPlan.find(find)
      .sort({ name: 1, level: 1, createdAt: -1 })
      .skip(Number(skip))
      .limit(Number(limit))
      .lean(),
    SuggestPlan.countDocuments(find),
  ]);

  const items = docs.map((p) => {
    const { sessionsCount, exercisesCount } = calcStats(p);
    const saved = Array.isArray(p.savedBy)
      ? p.savedBy.map(String).includes(String(userId))
      : false;

    return {
      _id: p._id,
      name: p.name,
      descriptionHtml: p.descriptionHtml || "",
      imageUrl: normalizeImage(p.imageUrl || ""),
      category: p.category || "",
      level: p.level || "",
      goal: p.goal || "",
      sessionsCount,
      exercisesCount,
      saved,
    };
  });

  return res.json(
    responseOk({
      items,
      total,
      hasMore: Number(skip) + items.length < total,
    })
  );
}

/**
 * GET /api/user/suggest-plans/:id
 * Trả về chi tiết + danh sách buổi & bài tập (kèm tên + hình ảnh bài tập)
 */
export async function getSuggestPlanUser(req, res) {
  const { id } = req.params;
  const userId = req.userId;

  const doc = await SuggestPlan.findById(id).lean();
  if (!doc || doc.status === "archived") {
    return res.status(404).json({ message: "Không tìm thấy lịch tập gợi ý" });
  }

  // gom id bài tập
  const sessions = Array.isArray(doc.sessions) ? doc.sessions : [];
  const ids = new Set();
  sessions.forEach((s) => {
    (s.exercises || s.items || []).forEach((it) => {
      const exId = it.exerciseId || it.exercise;
      if (exId) ids.add(String(exId));
    });
  });

  let exMap = new Map();
  if (ids.size) {
    const exs = await Exercise.find({ _id: { $in: Array.from(ids) } })
      .select("_id name imageUrl")
      .lean();
    exMap = new Map(
      exs.map((e) => [String(e._id), { name: e.name, imageUrl: normalizeImage(e.imageUrl) }])
    );
  }

  const mappedSessions = sessions.map((s) => ({
    title: s.title || "",
    description: s.description || "",
    exercises: (s.exercises || s.items || []).map((it) => {
      const exId = String(it.exerciseId || it.exercise || "");
      const exSnap = exMap.get(exId) || {};
      return {
        exerciseId: exId,
        name: exSnap.name || it.exerciseName || "Bài tập",
        imageUrl: exSnap.imageUrl || "",
        repsText: it.repsText || it.reps || "",
      };
    }),
  }));

  const { sessionsCount, exercisesCount } = calcStats(doc);
  const saved = Array.isArray(doc.savedBy)
    ? doc.savedBy.map(String).includes(String(userId))
    : false;

  const payload = {
    _id: doc._id,
    name: doc.name,
    descriptionHtml: doc.descriptionHtml || "",
    imageUrl: normalizeImage(doc.imageUrl || ""),
    category: doc.category || "",
    level: doc.level || "",
    goal: doc.goal || "",
    sessions: mappedSessions,
    sessionsCount,
    exercisesCount,
    saved,
  };

  return res.json(responseOk(payload));
}

/**
 * POST /api/user/suggest-plans/:id/save
 * Toggle lưu / bỏ lưu
 */
export async function toggleSaveSuggestPlanUser(req, res) {
  const { id } = req.params;
  const userId = req.userId;

  const doc = await SuggestPlan.findById(id);
  if (!doc || doc.status === "archived") {
    return res.status(404).json({ message: "Không tìm thấy lịch tập gợi ý" });
  }

  if (!Array.isArray(doc.savedBy)) {
    doc.savedBy = [];
  }

  const idx = doc.savedBy.findIndex((u) => String(u) === String(userId));
  let saved;
  if (idx >= 0) {
    doc.savedBy.splice(idx, 1);
    saved = false;
  } else {
    doc.savedBy.push(userId);
    saved = true;
  }
  await doc.save();

  return res.json(responseOk({ saved }));
}
