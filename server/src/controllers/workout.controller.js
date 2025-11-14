// server/src/controllers/workout.controller.js
import WorkoutPlan from "../models/WorkoutPlan.js";
import Exercise from "../models/Exercise.js";
import { User } from "../models/User.js";
import { responseOk } from "../utils/response.js";
import { calcPlanKcalByMET } from "../utils/health.js";

function ownerFilter(userId) { return { user: userId, status: "active" }; }
function savedFilter(userId) { return { savedBy: userId, status: "active" }; }

// Chuẩn hoá đường dẫn ảnh (luôn trả về chuỗi bắt đầu bằng http(s) hoặc '/')
function normalizeImage(u) {
  if (!u) return "";
  const s = String(u).trim();
  if (!s) return "";
  return (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("/")) ? s : `/${s}`;
}

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
  let plan = await WorkoutPlan.findById(id).lean();
  if (!plan) return res.status(404).json({ message: "Không tìm thấy lịch tập" });

  // Cho xem nếu là chủ hoặc đã lưu (đúng như comment cũ của bạn)
  if (String(plan.user) !== String(req.userId) && !(plan.savedBy || []).map(String).includes(String(req.userId))) {
    // Không chặn đọc: giữ nguyên behavior cho phép xem nếu đã lưu
  }

  // Backfill imageUrl cho các item cũ (nếu thiếu), đồng thời normalize đường dẫn
  if (Array.isArray(plan.items) && plan.items.some(it => !it.imageUrl)) {
    const needIds = plan.items.filter(it => !it.imageUrl).map(it => it.exercise);
    if (needIds.length) {
      const exs = await Exercise.find({ _id: { $in: needIds } }).select("_id imageUrl").lean();
      const map = new Map(exs.map(e => [String(e._id), normalizeImage(e.imageUrl || "")]));
      let changed = false;
      const fixed = plan.items.map(it => {
        if (!it.imageUrl) {
          const img = map.get(String(it.exercise)) || "";
          if (img) { changed = true; return { ...it, imageUrl: img }; }
        }
        return it;
      });
      if (changed) {
        await WorkoutPlan.updateOne({ _id: id }, { $set: { items: fixed } });
        plan = { ...plan, items: fixed };
      }
    }
  }

  return res.json(responseOk(plan));
}

export async function createPlan(req, res) {
  const userId = req.userId;
  const { name, items = [], note = "" } = req.body;

  if (!name || !Array.isArray(items)) return res.status(422).json({ message: "Dữ liệu không hợp lệ" });

  // map exercise info
  const ids = items.map(it => it.exercise);
  const exMap = new Map();
  if (ids.length) {
    const exs = await Exercise.find({ _id: { $in: ids } })
      .select("_id name type caloriePerRep imageUrl")
      .lean();
    exs.forEach(e => exMap.set(String(e._id), e));
  }

  const normalized = items.map(it => {
    const e = exMap.get(String(it.exercise));
    if (!e) throw new Error("Bài tập không tồn tại");
    const sets = Array.isArray(it.sets) && it.sets.length ? it.sets : [{ kg: 0, reps: 0, restSec: 0 }];
    return {
      exercise: e._id,
      exerciseName: e.name,
      type: e.type === "Cardio" ? "Cardio" : (e.type === "Sport" ? "Sport" : "Strength"),
      caloriePerRep: Number(e.caloriePerRep || 0),
      imageUrl: normalizeImage(e.imageUrl),
      sets,
    };
  });

  const plan = new WorkoutPlan({
    user: userId,
    name: String(name).trim(),
    note: String(note || "").trim(),
    items: normalized,
  });
  plan.recalcTotals();

  // cân nặng hiện tại của user
  const user = await User.findById(userId).select("profile.weightKg").lean();
  const weightKg = Number(user?.profile?.weightKg || 60);

  // tính & lưu tổng kcal
  plan.totals.kcal = calcPlanKcalByMET(plan.items, weightKg);

  await plan.save();
  return res.status(201).json(responseOk(plan));
}

export async function updatePlan(req, res) {
  const { id } = req.params;
  const plan = await WorkoutPlan.findById(id);
  if (!plan) return res.status(404).json({ message: "Không tìm thấy lịch tập" });
  if (String(plan.user) !== String(req.userId)) return res.status(403).json({ message: "Không có quyền" });

  // Backfill (một lần) cho dữ liệu cũ đang thiếu imageUrl
  if (Array.isArray(plan.items) && plan.items.some(it => !it.imageUrl)) {
    const needIds = plan.items.filter(it => !it.imageUrl).map(it => it.exercise);
    if (needIds.length) {
      const exs = await Exercise.find({ _id: { $in: needIds } }).select("_id imageUrl").lean();
      const map = new Map(exs.map(e => [String(e._id), normalizeImage(e.imageUrl || "")]));
      plan.items = plan.items.map(it => ({
        ...it,
        imageUrl: normalizeImage(it.imageUrl) || map.get(String(it.exercise)) || ""
      }));
    }
  }

  const { name, items, note } = req.body;
  if (name != null) plan.name = String(name).trim();
  if (note != null) plan.note = String(note).trim();

  if (Array.isArray(items)) {
    const ids = items.map(it => it.exercise);
    const exMap = new Map();
    if (ids.length) {
      const exs = await Exercise.find({ _id: { $in: ids } })
        .select("_id name type caloriePerRep imageUrl")
        .lean();
      exs.forEach(e => exMap.set(String(e._id), e));
    }
    plan.items = items.map(it => {
      const e = exMap.get(String(it.exercise));
      if (!e) throw new Error("Bài tập không tồn tại");
      const sets = Array.isArray(it.sets) && it.sets.length ? it.sets : [{ kg: 0, reps: 0, restSec: 0 }];
      return {
        exercise: e._id,
        exerciseName: e.name,
        type: e.type === "Cardio" ? "Cardio" : (e.type === "Sport" ? "Sport" : "Strength"),
        caloriePerRep: Number(e.caloriePerRep || 0),
        imageUrl: normalizeImage(e.imageUrl),
        sets,
      };
    });
  }

  plan.recalcTotals();

  const user = await User.findById(req.userId).select("profile.weightKg").lean();
  const weightKg = Number(user?.profile?.weightKg || 60);
  plan.totals.kcal = calcPlanKcalByMET(plan.items, weightKg);

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
