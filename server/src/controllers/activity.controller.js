// server/src/controllers/activity.controller.js
import dayjs from "dayjs";
import DailyActivity from "../models/DailyActivity.js";
import WorkoutPlan from "../models/WorkoutPlan.js";
import { User } from "../models/User.js";

// helper: lấy hoặc tạo doc
async function ensureDoc(userId, date) {
  const d = date || dayjs().format("YYYY-MM-DD");
  let doc = await DailyActivity.findOne({ user: userId, date: d });
  if (!doc) {
    doc = await DailyActivity.create({
      user: userId,
      date: d,
      steps: 0,
      weightKg: null,
      workouts: [],
    });
  }
  return doc;
}

/** ===== Helper: map WorkoutPlan -> data cho FE (kèm items, sets, totals) ===== */
function planToClient(plan) {
  if (!plan) return null;
  const t = plan.totals || {};
  return {
    _id: String(plan._id),
    name: plan.name || "",
    note: plan.note || "",
    totals: {
      exercises: t.exercises ?? 0,
      sets: t.sets ?? 0,
      reps: t.reps ?? 0,
      kcal: t.kcal ?? 0,
    },
    items: (plan.items || []).map((it) => ({
      exercise: String(it.exercise),
      exerciseName: it.exerciseName,
      type: it.type,
      caloriePerRep: it.caloriePerRep ?? 0,
      imageUrl: it.imageUrl || "",
      sets: (it.sets || []).map((s) => ({
        kg: s.kg ?? 0,
        reps: s.reps ?? 0,
        restSec: s.restSec ?? 0,
      })),
    })),
  };
}

/** Build mảng workouts cho FE: [{ id, name, kcal, plan? }] */
async function buildWorkoutResponse(rawList = []) {
  const ids = rawList
    .map((w) => w.workout || w._id || null)
    .filter(Boolean);
  const uniqueIds = [...new Set(ids.map((id) => String(id)))];

  let planMap = new Map();
  if (uniqueIds.length) {
    const plans = await WorkoutPlan.find({ _id: { $in: uniqueIds } }).lean();
    planMap = new Map(plans.map((p) => [String(p._id), p]));
  }

  return rawList.map((w) => {
    const id = String(w.workout || w._id || "");
    const base = {
      id,
      name: w.name || "",
      kcal: w.kcal || 0,
    };
    const plan = planMap.get(id);
    if (plan) base.plan = planToClient(plan);
    return base;
  });
}

// GET /api/activity/day?date=YYYY-MM-DD
export async function getDayActivity(req, res) {
  const userId = req.userId;
  const date = req.query.date || dayjs().format("YYYY-MM-DD");
  const doc = await DailyActivity.findOne({ user: userId, date });
  if (!doc)
    return res.json({
      date,
      steps: 0,
      weightKg: null,
      workouts: [],
    });

  const workouts = await buildWorkoutResponse(doc.workouts || []);

  res.json({
    date,
    steps: doc.steps || 0,
    weightKg: doc.weightKg ?? null,
    workouts,
  });
}

// POST /api/activity/steps { date, steps }
export async function setStepsDay(req, res) {
  const userId = req.userId;
  const { date, steps } = req.body || {};
  if (!date) return res.status(400).json({ message: "date required" });
  const val = Number(steps) || 0;
  const doc = await DailyActivity.findOneAndUpdate(
    { user: userId, date },
    { $set: { steps: val } },
    { new: true, upsert: true }
  );
  res.json({ steps: doc.steps || 0 });
}

// POST /api/activity/weight { date, weightKg }
export async function setWeightDay(req, res) {
  const userId = req.userId;
  const { date, weightKg } = req.body || {};
  if (!date) return res.status(400).json({ message: "date required" });
  const val = Number(weightKg);
  if (!Number.isFinite(val))
    return res.status(400).json({ message: "weightKg must be number" });

  const doc = await DailyActivity.findOneAndUpdate(
    { user: userId, date },
    { $set: { weightKg: val } },
    { new: true, upsert: true }
  );

  // cập nhật luôn weight hiện tại vào profile user (đơn giản)
  await User.findByIdAndUpdate(userId, {
    $set: { "profile.weightKg": val },
  }).catch(() => {});

  res.json({ weightKg: doc.weightKg });
}

// POST /api/activity/workouts { date, workoutIds: [] }
export async function setWorkoutsDay(req, res) {
  const userId = req.userId;
  const { date, workoutIds } = req.body || {};
  if (!date) return res.status(400).json({ message: "date required" });

  const ids = Array.isArray(workoutIds) ? workoutIds.filter(Boolean) : [];
  const plans = ids.length
    ? await WorkoutPlan.find({ _id: { $in: ids } }).lean()
    : [];

  const map = new Map(plans.map((p) => [String(p._id), p]));
  const workouts = ids.map((id) => {
    const p = map.get(String(id)) || {};
    const t = p.totals || {};
    const kcal = t.kcal ?? t.calories ?? p.totalKcal ?? 0;
    return {
      workout: id,
      name: p.name || "(Không tên)",
      kcal: kcal || 0,
    };
  });

  const doc = await DailyActivity.findOneAndUpdate(
    { user: userId, date },
    { $set: { workouts } },
    { new: true, upsert: true }
  );

  const out = await buildWorkoutResponse(doc.workouts || []);
  res.json({ workouts: out });
}

// POST /api/activity/toggle-workout { date, workoutId }
export async function toggleWorkoutDay(req, res) {
  const userId = req.userId;
  const { date, workoutId } = req.body || {};
  if (!date || !workoutId)
    return res.status(400).json({ message: "date & workoutId required" });

  const doc = await ensureDoc(userId, date);
  const idx = (doc.workouts || []).findIndex(
    (w) => String(w.workout) === String(workoutId)
  );

  let isMarked;
  if (idx >= 0) {
    // bỏ đánh dấu
    doc.workouts.splice(idx, 1);
    isMarked = false;
  } else {
    const p = await WorkoutPlan.findById(workoutId).lean();
    if (!p) return res.status(404).json({ message: "Workout not found" });
    const t = p.totals || {};
    const kcal = t.kcal ?? t.calories ?? p.totalKcal ?? 0;
    doc.workouts.push({
      workout: workoutId,
      name: p.name || "(Không tên)",
      kcal: kcal || 0,
    });
    isMarked = true;
  }
  await doc.save();

  const workouts = await buildWorkoutResponse(doc.workouts || []);

  res.json({ isMarked, workouts });
}

// GET /api/activity/weight-history?limit=10
export async function getWeightHistory(req, res) {
  const userId = req.userId;
  const limit = Math.min(Number(req.query.limit) || 10, 60);
  const docs = await DailyActivity.find({
    user: userId,
    weightKg: { $ne: null },
  })
    .sort({ date: 1 })
    .limit(limit)
    .lean();

  const history = docs.map((d) => ({ date: d.date, weight: d.weightKg }));
  res.json({ history });
}
