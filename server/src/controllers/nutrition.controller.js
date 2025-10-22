// server/src/controllers/nutrition.controller.js
import NutritionLog from "../models/NutritionLog.js";
import Food from "../models/Food.js";
import WaterLog from "../models/WaterLog.js";
import dayjs from "dayjs";
import { User } from "../models/User.js";
import { tinhMacroMucTieuTuProfile } from "../utils/health.js";

/* --------------------------------------------
 * Helpers
 * -------------------------------------------- */

// Lấy targets macro theo profile user (dựa trên công thức đã code trong utils/health.js)
async function getTargetsForUser(userId) {
  const user = await User.findById(userId).lean();
  const p = user?.profile || {};
  return tinhMacroMucTieuTuProfile(p);
}

/* --------------------------------------------
 * Logs theo ngày
 * GET /api/nutrition/logs?date=YYYY-MM-DD
 * -------------------------------------------- */
export async function listDayLogs(req, res) {
  const userId = req.userId;
  const date = req.query.date || dayjs().format("YYYY-MM-DD");

  const items = await NutritionLog.find({ user: userId, date })
    .sort({ hour: 1, createdAt: 1 })
    .populate("food")
    .lean();

  // Tính totals (kcal + macro…) theo từng log
  const totals = {
    kcal: 0, proteinG: 0, carbG: 0, fatG: 0, sugarG: 0, saltG: 0, fiberG: 0,
  };

  for (const it of items) {
    const f = it.food || {};
    const qty = Number(it.quantity || 1);

    const baseMass = Number(f.massG || 0);                 // khối lượng chuẩn của món
    const chosenMass = Number(it.massG ?? baseMass);       // khối lượng log (hoặc dùng chuẩn)
    // ratio: nếu có mass chuẩn thì dùng tỷ lệ; nếu không có thì để 1 (nhân theo qty)
    const ratio = baseMass > 0 ? (chosenMass || baseMass) / baseMass : 1;
    const mult = qty * ratio;

    totals.kcal     += (Number(f.kcal)     || 0) * mult;
    totals.proteinG += (Number(f.proteinG) || 0) * mult;
    totals.carbG    += (Number(f.carbG)    || 0) * mult;
    totals.fatG     += (Number(f.fatG)     || 0) * mult;
    totals.saltG    += (Number(f.saltG)    || 0) * mult;
    totals.sugarG   += (Number(f.sugarG)   || 0) * mult;
    totals.fiberG   += (Number(f.fiberG)   || 0) * mult;
  }

  const targets = await getTargetsForUser(userId);
  res.json({ items, totals, targets });
}

/* --------------------------------------------
 * Xoá log (owner-only)
 * DELETE /api/nutrition/logs/:id
 * -------------------------------------------- */
export async function deleteDayLog(req, res) {
  const userId = req.userId;
  const doc = await NutritionLog.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "Not found" });
  if (String(doc.user) !== String(userId)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  await NutritionLog.deleteOne({ _id: doc._id });
  res.json({ success: true });
}

/* --------------------------------------------
 * Streak
 * GET /api/nutrition/streak
 * -------------------------------------------- */
export async function getStreak(req, res) {
  const userId = req.userId;
  const today = dayjs().startOf("day");
  let count = 0;
  for (let i = 0; i < 365; i++) {
    const d = today.subtract(i, "day").format("YYYY-MM-DD");
    const has = await NutritionLog.exists({ user: userId, date: d });
    if (has) count++;
    else break;
  }
  res.json({ streak: count });
}

/* --------------------------------------------
 * Nước uống
 * GET /api/nutrition/water?date=YYYY-MM-DD
 * POST /api/nutrition/water { date, deltaMl }
 * -------------------------------------------- */
export async function getWaterDay(req, res) {
  const userId = req.userId;
  const date = req.query.date || dayjs().format("YYYY-MM-DD");
  const doc = await WaterLog.findOne({ user: userId, date });
  res.json({ amountMl: doc?.amountMl || 0 });
}

export async function incWaterDay(req, res) {
  const userId = req.userId;
  const { date, deltaMl = 0 } = req.body || {};
  if (!date) return res.status(400).json({ message: "date required" });

  const doc = await WaterLog.findOneAndUpdate(
    { user: userId, date },
    {
      $inc: { amountMl: Number(deltaMl) || 0 },
      $setOnInsert: { user: userId, date, amountMl: 0 },
    },
    { new: true, upsert: true }
  );

  // clamp 0..10000
  let needSave = false;
  if (doc.amountMl < 0) { doc.amountMl = 0; needSave = true; }
  if (doc.amountMl > 10000) { doc.amountMl = 10000; needSave = true; }
  if (needSave) await doc.save();

  res.json({ amountMl: doc.amountMl });
}

/* --------------------------------------------
 * Targets (macro/micro) theo user.profile
 * GET /api/nutrition/targets
 * -------------------------------------------- */
export async function getTargets(req, res) {
  const targets = await getTargetsForUser(req.userId);
  return res.json({ targets });
}
