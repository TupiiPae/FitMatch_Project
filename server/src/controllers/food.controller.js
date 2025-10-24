// server/src/controllers/food.controller.js
import path from "path"; import fs from "fs"; import sharp from "sharp";
import Food from "../models/Food.js"; import NutritionLog from "../models/NutritionLog.js";
import { responseOk } from "../utils/response.js"; import { FOOD_DIR } from "../middleware/upload.js";

const isNum = (v)=>Number.isFinite(v); const toNumOrNull=(v)=>v===undefined||v===null||v===""?null:(Number.isFinite(Number(v))?Number(v):null);
const ensureDir=()=>{ try{ fs.mkdirSync(FOOD_DIR,{recursive:true}); }catch(_){} };

export async function listFoods(req,res){
  const userId=req.userId; const {q,scope="all",onlyMine,favorites,limit=30,skip=0}=req.query; const $and=[];
  if(onlyMine){ $and.push({createdBy:userId}); } else { $and.push({status:"approved"}); }
  if(favorites&&userId) $and.push({likedBy:userId}); if(q) $and.push({$text:{ $search:q }});
  const proj={name:1,imageUrl:1,portionName:1,massG:1,unit:1,kcal:1,proteinG:1,carbG:1,fatG:1,saltG:1,sugarG:1,fiberG:1,likedBy:1,status:1,createdBy:1,viewedBy:1};
  if(scope==="recent"){
    const docs=await Food.find({$and}).sort({"viewedBy.lastViewedAt":-1,updatedAt:-1}).limit(Number(limit)+1).skip(Number(skip)).select(proj).lean();
    const items=(docs||[]).map(d=>({...d,isFavorite:userId?d.likedBy?.some(x=>String(x)===String(userId)):false}));
    return res.json({items:items.slice(0,Number(limit)),hasMore:docs.length>Number(limit)});
  }
  const docs=await Food.find({$and}).sort(q?{score:{$meta:"textScore"}}:{updatedAt:-1}).limit(Number(limit)+1).skip(Number(skip)).select(proj).lean();
  const items=(docs||[]).map(d=>({...d,isFavorite:userId?d.likedBy?.some(x=>String(x)===String(userId)):false}));
  res.json({items:items.slice(0,Number(limit)),hasMore:docs.length>Number(limit)});
}

export async function getFood(req,res){
  const d=await Food.findById(req.params.id).lean(); if(!d) return res.status(404).json({message:"Not found"});
  const isFavorite=req.userId?d.likedBy?.some(x=>String(x)===String(req.userId)):false; res.json({...d,isFavorite});
}

export async function createFood(req,res){
  console.log("[createFood] ctype=", req.headers["content-type"]);
  console.log("[createFood] has file?", !!req.file, req.file?.mimetype, "body keys:", Object.keys(req.body || {}));
  const userId=req.userId; const b=req.body||{}; const name=String(b.name||"").trim(); const mass=Number(b.massG);
  if(!name||!isNum(mass)||mass<=0) return res.status(400).json({message:"name & massG required"});
  let imageUrl=b.imageUrl||null; if(req.file){ try{ ensureDir(); const fn=`${userId||"anon"}-${Date.now()}.webp`; const out=path.join(FOOD_DIR,fn);
    await sharp(req.file.buffer).rotate().resize(800,800,{fit:"inside",withoutEnlargement:true}).webp({quality:82}).toFile(out);
    imageUrl=`/uploads/foods/${fn}`; }catch(e){ console.error("[food.upload]",e?.message||e); } }
  const doc=await Food.create({name, imageUrl, portionName:b.portionName||undefined, massG:mass, unit:b.unit==="ml"?"ml":"g",
    kcal:toNumOrNull(b.kcal), proteinG:toNumOrNull(b.proteinG), carbG:toNumOrNull(b.carbG), fatG:toNumOrNull(b.fatG),
    saltG:toNumOrNull(b.saltG), sugarG:toNumOrNull(b.sugarG), fiberG:toNumOrNull(b.fiberG),
    createdBy:userId, status:"pending", sourceType:b.sourceType||"user_submitted"});
  res.status(202).json({message:"Submitted for approval",id:doc._id});
}

export async function updateFood(req,res){
  const userId=req.userId; const doc=await Food.findById(req.params.id); if(!doc) return res.status(404).json({message:"Not found"});
  const isOwner=String(doc.createdBy||"")===String(userId); const isAdmin=req.userRole==="admin"; if(!isOwner&&!isAdmin) return res.status(403).json({message:"Forbidden"});
  const b=req.body||{}; const set={};
  if(b.massG!==undefined){ const m=Number(b.massG); if(!isNum(m)||m<=0) return res.status(400).json({message:"massG must be > 0"}); set.massG=m; }
  if(b.unit!==undefined) set.unit=b.unit==="ml"?"ml":"g";
  ["name","imageUrl","portionName","sourceType"].forEach(k=>{ if(b[k]!==undefined) set[k]=typeof b[k]==="string"?b[k].trim():b[k]; });
  ["kcal","proteinG","carbG","fatG","saltG","sugarG","fiberG"].forEach(k=>{ if(b[k]!==undefined) set[k]=toNumOrNull(b[k]); });
  if(req.file){ try{ ensureDir(); const fn=`${userId||"anon"}-${Date.now()}.webp`; const out=path.join(FOOD_DIR,fn);
    await sharp(req.file.buffer).rotate().resize(800,800,{fit:"inside",withoutEnlargement:true}).webp({quality:82}).toFile(out);
    set.imageUrl=`/uploads/foods/${fn}`; }catch(e){ console.error("[food.upload][update]",e?.message||e); } }
  if(isAdmin&&b.status&&["pending","approved","rejected"].includes(b.status)) set.status=b.status;
  await Food.updateOne({_id:doc._id},{ $set:set }); res.json(responseOk());
}

export async function deleteFood(req,res){
  const userId=req.userId; const doc=await Food.findById(req.params.id); if(!doc) return res.status(404).json({message:"Not found"});
  const isOwner=String(doc.createdBy||"")===String(userId); const isAdmin=req.userRole==="admin"; if(!isOwner&&!isAdmin) return res.status(403).json({message:"Forbidden"});
  await Food.deleteOne({_id:doc._id}); res.json(responseOk());
}

export async function toggleFavorite(req,res){
  const userId=req.userId; const f=await Food.findById(req.params.id); if(!f) return res.status(404).json({message:"Not found"});
  const has=f.likedBy.some(x=>String(x)===String(userId)); f.likedBy=has?f.likedBy.filter(x=>String(x)!==String(userId)):[...f.likedBy,userId];
  await f.save(); res.json({isFavorite:!has});
}

export async function recordView(req,res){
  const userId=req.userId; const f=await Food.findById(req.params.id); if(!f) return res.status(404).json({message:"Not found"});
  f.views+=1; const i=f.viewedBy.findIndex(v=>String(v.user)===String(userId));
  if(i>=0){ f.viewedBy[i].lastViewedAt=new Date(); f.viewedBy[i].count+=1; } else { f.viewedBy.push({user:userId,lastViewedAt:new Date(),count:1}); }
  await f.save(); res.json(responseOk());
}

export async function createLog(req,res){
  const userId=req.userId; const {foodId,date,hour,quantity=1,massG}=req.body||{};
  if(!foodId||!date||hour==null) return res.status(400).json({message:"foodId, date, hour required"});
  await NutritionLog.create({user:userId,food:foodId,date,hour,quantity,massG:massG??undefined}); res.json(responseOk());
}
