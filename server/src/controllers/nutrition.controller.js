import NutritionLog from "../models/NutritionLog.js";
import Food from "../models/Food.js";
import WaterLog from "../models/WaterLog.js";
import dayjs from "dayjs";

// Tính target theo profile: kcal từ calorieTarget||tdee, macro % từ profile (fallback 20/50/30)
function buildTargets(profile){
  const kcal = Math.round(profile?.calorieTarget || profile?.tdee || 2000);
  const pPct = (profile?.macroProtein ?? 20) / 100;
  const cPct = (profile?.macroCarb ?? 50) / 100;
  const fPct = (profile?.macroFat ?? 30) / 100;
  // g = kcal * pct / calPerGram
  const proteinG = Math.round((kcal * pPct) / 4);
  const carbG    = Math.round((kcal * cPct) / 4);
  const fatG     = Math.round((kcal * fPct) / 9);
  // WHO khuyến nghị tham khảo (có thể chỉnh): salt <= 5g; sugar <= 50g; fiber >= 25g
  const saltG = 5, sugarG = 50, fiberG = 25;
  return { kcal, proteinG, carbG, fatG, saltG, sugarG, fiberG };
}

// GET /api/nutrition/logs?date=YYYY-MM-DD
export async function listDayLogs(req,res){
  const userId = req.userId;
  const date = req.query.date || dayjs().format("YYYY-MM-DD");

  const items = await NutritionLog.find({ user: userId, date })
    .sort({ hour: 1, createdAt: 1 })
    .populate("food")
    .lean();

  // Tính totals
  const totals = { kcal:0, proteinG:0, carbG:0, fatG:0, sugarG:0, saltG:0, fiberG:0 };
  for (const it of items) {
    const f = it.food || {};
    const qty = it.quantity || 1;
    const ratio = (it.massG ?? f.massG ?? 0) / (f.massG || 1);
    const mult = (ratio || 1) * qty;
    totals.kcal     += (f.kcal     || 0) * mult;
    totals.proteinG += (f.proteinG || 0) * mult;
    totals.carbG    += (f.carbG    || 0) * mult;
    totals.fatG     += (f.fatG     || 0) * mult;
    totals.saltG    += (f.saltG    || 0) * mult;
    totals.sugarG   += (f.sugarG   || 0) * mult;
    totals.fiberG   += (f.fiberG   || 0) * mult;
  }

  const targets = buildTargets(req.user?.profile || {}); // nếu middleware auth đã attach user
  res.json({ items, totals, targets });
}

// DELETE /api/nutrition/logs/:id  (owner-only)
export async function deleteDayLog(req,res){
  const userId = req.userId;
  const doc = await NutritionLog.findById(req.params.id);
  if (!doc) return res.status(404).json({ message:"Not found" });
  if (String(doc.user) !== String(userId)) return res.status(403).json({ message:"Forbidden" });
  await NutritionLog.deleteOne({ _id: doc._id });
  res.json({ success:true });
}

// GET /api/nutrition/streak  (đếm số ngày liên tục đến hôm nay)
export async function getStreak(req,res){
  const userId = req.userId;
  const today = dayjs().startOf("day");
  let count = 0;
  for (let i=0; i<365; i++){
    const d = today.subtract(i, "day").format("YYYY-MM-DD");
    const has = await NutritionLog.exists({ user: userId, date: d });
    if (has) count++;
    else break;
  }
  res.json({ streak: count });
}

// Nước
// GET /api/nutrition/water?date=YYYY-MM-DD
export async function getWaterDay(req,res){
  const userId = req.userId;
  const date = req.query.date || dayjs().format("YYYY-MM-DD");
  const doc = await WaterLog.findOne({ user: userId, date });
  res.json({ amountMl: doc?.amountMl || 0 });
}

// POST /api/nutrition/water  { date, deltaMl }
export async function incWaterDay(req,res){
  const userId = req.userId;
  const { date, deltaMl=0 } = req.body || {};
  if (!date) return res.status(400).json({ message:"date required" });
  const doc = await WaterLog.findOneAndUpdate(
    { user: userId, date },
    { $inc: { amountMl: deltaMl }, $setOnInsert: { user: userId, date, amountMl: 0 } },
    { new:true, upsert:true }
  );
  // clamp 0..10000
  if (doc.amountMl < 0) { doc.amountMl = 0; await doc.save(); }
  if (doc.amountMl > 10000) { doc.amountMl = 10000; await doc.save(); }
  res.json({ amountMl: doc.amountMl });
}
