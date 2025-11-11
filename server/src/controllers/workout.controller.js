// server/src/controllers/workout.controller.js
import WorkoutPlan from "../models/WorkoutPlan.js";
import Exercise from "../models/Exercise.js";
import { responseOk } from "../utils/response.js";

function ownerFilter(userId) { return { user: userId, status: "active" }; }
function savedFilter(userId) { return { savedBy: userId, status: "active" }; }

export async function listPlans(req, res) {
  const { q, scope = "mine", limit = 20, skip = 0 } = req.query;
  const userId = req.userId;

  const base = scope === "saved" ? savedFilter(userId) : ownerFilter(userId);
  const find = { ...base };
  if (q) find.name = { $regex: q.trim(), $options: "i" };

  const [items, total] = await Promise.all([
    WorkoutPlan.find(find).sort({ updatedAt: -1 }).skip(Number(skip)).limit(Number(limit)).lean(),
    WorkoutPlan.countDocuments(find),
  ]);

  return res.json(responseOk({ items, total, hasMore: Number(skip) + items.length < total }));
}

export async function getPlan(req, res) {
  const { id } = req.params;
  const plan = await WorkoutPlan.findById(id).lean();
  if (!plan) return res.status(404).json({ message: "Không tìm thấy lịch tập" });
  if (String(plan.user) !== String(req.userId) && !(plan.savedBy || []).includes(req.userId)) {
    // vẫn cho xem nếu đã lưu
  }
  return res.json(responseOk(plan));
}

export async function createPlan(req, res) {
  const userId = req.userId;
  const { name, items = [] } = req.body;

  if (!name || !Array.isArray(items)) return res.status(422).json({ message: "Dữ liệu không hợp lệ" });

  // build items with snapshot
  const exerciseIds = items.map(it => it.exercise);
  const exMap = new Map();
  if (exerciseIds.length) {
    const exs = await Exercise.find({ _id: { $in: exerciseIds } }).select("_id name type").lean();
    exs.forEach(e => exMap.set(String(e._id), e));
  }

  const normalized = items.map(it => {
    const e = exMap.get(String(it.exercise));
    if (!e) throw new Error("Bài tập không tồn tại");
    const sets = Array.isArray(it.sets) && it.sets.length ? it.sets : [{ kg: 0, reps: 0, restSec: 0 }];
    return {
      exercise: e._id,
      exerciseName: e.name,
      type: e.type === "Cardio" ? "Cardio" : "Strength",
      sets,
    };
  });

  const plan = new WorkoutPlan({ user: userId, name: String(name).trim(), items: normalized });
  plan.recalcTotals();
  await plan.save();

  return res.status(201).json(responseOk(plan));
}

export async function updatePlan(req, res) {
  const { id } = req.params;
  const plan = await WorkoutPlan.findById(id);
  if (!plan) return res.status(404).json({ message: "Không tìm thấy lịch tập" });
  if (String(plan.user) !== String(req.userId)) return res.status(403).json({ message: "Không có quyền" });

  const { name, items } = req.body;
  if (name != null) plan.name = String(name).trim();

  if (Array.isArray(items)) {
    // refresh snapshot for any changed exercise
    const exIds = items.map(it => it.exercise);
    const exMap = new Map();
    if (exIds.length) {
      const exs = await Exercise.find({ _id: { $in: exIds } }).select("_id name type").lean();
      exs.forEach(e => exMap.set(String(e._id), e));
    }
    plan.items = items.map(it => {
      const e = exMap.get(String(it.exercise));
      if (!e) throw new Error("Bài tập không tồn tại");
      const sets = Array.isArray(it.sets) && it.sets.length ? it.sets : [{ kg: 0, reps: 0, restSec: 0 }];
      return {
        exercise: e._id,
        exerciseName: e.name,
        type: e.type === "Cardio" ? "Cardio" : "Strength",
        sets,
      };
    });
  }

  plan.recalcTotals();
  await plan.save();
  return res.json(responseOk(plan));
}

export async function deletePlan(req, res) {
  const { id } = req.params;
  const plan = await WorkoutPlan.findById(id);
  if (!plan) return res.status(404).json({ message: "Không tìm thấy lịch tập" });
  if (String(plan.user) !== String(req.userId)) return res.status(403).json({ message: "Không có quyền" });

  plan.status = "archived";
  await plan.save();
  return res.json(responseOk({ ok: true }));
}

export async function toggleSavePlan(req, res) {
  const { id } = req.params;
  const userId = req.userId;
  const plan = await WorkoutPlan.findById(id);
  if (!plan) return res.status(404).json({ message: "Không tìm thấy lịch tập" });

  const idx = (plan.savedBy || []).findIndex(u => String(u) === String(userId));
  if (idx >= 0) plan.savedBy.splice(idx, 1);
  else plan.savedBy.push(userId);

  await plan.save();
  return res.json(responseOk({ saved: idx < 0 }));
}
