import Food from "../models/Food.js";
import NutritionLog from "../models/NutritionLog.js";
import { responseOk } from "../utils/response.js";

// List/Search
export async function listFoods(req,res){
  const userId = req.userId;
  const {
    q, scope="all", onlyMine, favorites, limit=30, skip=0
  } = req.query;

  const $and = [];
  // chỉ show approved trừ khi chính chủ thấy pending của mình
  if (onlyMine) {
    $and.push({ createdBy: userId });
  } else {
    $and.push({ status: "approved" });
  }

  if (favorites && userId){
    $and.push({ likedBy: userId });
  }
  if (q){
    $and.push({ $text: { $search: q } });
  }

  // "recent": ưu tiên theo viewedBy.lastViewedAt của user
  if (scope === "recent") {
    const proj = {
      name:1, imageUrl:1, portionName:1, massG:1, unit:1, kcal:1, proteinG:1, carbG:1, fatG:1, saltG:1, sugarG:1, fiberG:1,
      likedBy:1, viewedBy:1, status:1, createdBy:1
    };
    const docs = await Food.find({ $and })
      .sort({ "viewedBy.lastViewedAt": -1, updatedAt: -1 })
      .limit(Number(limit)+1)
      .skip(Number(skip))
      .select(proj)
      .lean();

    const items = (docs||[]).map(d => ({ ...d, isFavorite: userId ? d.likedBy?.some(x=> String(x)===String(userId)) : false }));
    return res.json({ items: items.slice(0, Number(limit)), hasMore: docs.length > Number(limit) });
  }

  const proj = {
    name:1, imageUrl:1, portionName:1, massG:1, unit:1, kcal:1, proteinG:1, carbG:1, fatG:1, saltG:1, sugarG:1, fiberG:1,
    likedBy:1, status:1, createdBy:1
  };

  const docs = await Food.find({ $and })
    .sort(q ? { score: { $meta: "textScore" } } : { updatedAt: -1 })
    .limit(Number(limit)+1)
    .skip(Number(skip))
    .select(proj)
    .lean();

  const items = (docs||[]).map(d => ({ ...d, isFavorite: userId ? d.likedBy?.some(x=> String(x)===String(userId)) : false }));
  res.json({ items: items.slice(0, Number(limit)), hasMore: docs.length > Number(limit) });
}

// Detail
export async function getFood(req,res){
  const d = await Food.findById(req.params.id).lean();
  if (!d) return res.status(404).json({ message:"Not found" });
  const isFavorite = req.userId ? d.likedBy?.some(x=> String(x)===String(req.userId)) : false;
  res.json({ ...d, isFavorite });
}

// Create (user submitted → pending)
export async function createFood(req,res){
  const userId = req.userId;
  const body = req.body || {};
  if (!body.name || body.massG==null) return res.status(400).json({ message:"name & massG required" });
  const doc = await Food.create({
    name: body.name.trim(),
    imageUrl: body.imageUrl,
    portionName: body.portionName,
    massG: body.massG,
    unit: body.unit || "g",
    kcal: body.kcal ?? null,
    proteinG: body.proteinG ?? null,
    carbG: body.carbG ?? null,
    fatG: body.fatG ?? null,
    saltG: body.saltG ?? null,
    sugarG: body.sugarG ?? null,
    fiberG: body.fiberG ?? null,
    createdBy: userId,
    status: "pending",
    sourceType: body.sourceType || "user_submitted",
  });
  res.status(202).json({ message:"Submitted for approval", id: doc._id });
}

// Update (admin or owner)
export async function updateFood(req,res){
  const userId = req.userId;
  const doc = await Food.findById(req.params.id);
  if (!doc) return res.status(404).json({ message:"Not found" });

  const isOwner = String(doc.createdBy||"") === String(userId);
  const isAdmin = req.userRole === "admin";
  if (!isOwner && !isAdmin) return res.status(403).json({ message:"Forbidden" });

  const body = req.body || {};
  const set = {};
  ["name","imageUrl","portionName","massG","unit","kcal","proteinG","carbG","fatG","saltG","sugarG","fiberG","sourceType"].forEach(k=>{
    if (body[k] !== undefined) set[k] = body[k];
  });
  // admin có thể đổi status
  if (isAdmin && body.status) set.status = body.status;

  await Food.updateOne({ _id: doc._id }, { $set: set });
  res.json(responseOk());
}

// Delete (admin or owner)
export async function deleteFood(req,res){
  const userId = req.userId;
  const doc = await Food.findById(req.params.id);
  if (!doc) return res.status(404).json({ message:"Not found" });
  const isOwner = String(doc.createdBy||"") === String(userId);
  const isAdmin = req.userRole === "admin";
  if (!isOwner && !isAdmin) return res.status(403).json({ message:"Forbidden" });
  await Food.deleteOne({ _id: doc._id });
  res.json(responseOk());
}

// Toggle favorite
export async function toggleFavorite(req,res){
  const userId = req.userId;
  const f = await Food.findById(req.params.id);
  if (!f) return res.status(404).json({ message:"Not found" });
  const has = f.likedBy.some(x=> String(x)===String(userId));
  if (has) f.likedBy = f.likedBy.filter(x=> String(x)!==String(userId));
  else f.likedBy.push(userId);
  await f.save();
  res.json({ isFavorite: !has });
}

// Record view (for “recent”)
export async function recordView(req,res){
  const userId = req.userId;
  const f = await Food.findById(req.params.id);
  if (!f) return res.status(404).json({ message:"Not found" });
  f.views += 1;
  const pos = f.viewedBy.findIndex(v => String(v.user)===String(userId));
  if (pos>=0){ f.viewedBy[pos].lastViewedAt = new Date(); f.viewedBy[pos].count += 1; }
  else { f.viewedBy.push({ user: userId, lastViewedAt: new Date(), count:1 }); }
  await f.save();
  res.json(responseOk());
}

// Add nutrition log
export async function createLog(req,res){
  const userId = req.userId;
  const { foodId, date, hour, quantity=1, massG } = req.body || {};
  if (!foodId || !date || hour==null) return res.status(400).json({ message:"foodId, date, hour required" });
  await NutritionLog.create({ user: userId, food: foodId, date, hour, quantity, massG: massG ?? undefined });
  res.json(responseOk());
}
