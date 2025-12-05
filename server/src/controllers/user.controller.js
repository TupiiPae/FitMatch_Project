// server/src/controllers/user.controller.js
import path from "path";
import fs from "fs";
import sharp from "sharp";
import mongoose from "mongoose"; // << thêm
import { fileURLToPath } from "url";
import { User } from "../models/User.js";
import { OnboardingProfile } from "../models/OnboardingProfile.js";
import NutritionLog from "../models/NutritionLog.js"; // << thêm
import WaterLog from "../models/WaterLog.js";         // << thêm
import Food from "../models/Food.js";                 // << thêm
import { tinhBmi, tinhBmr, tinhTdee, tinhCalorieTarget as _tinhCalorieTarget } from "../utils/health.js";
import { AVATAR_DIR, FOOD_DIR } from "../middleware/upload.js"; // << thêm FOOD_DIR
import { uploadImageWithResize, deleteFile, extractPublicId } from "../utils/cloudinary.js";

const tinhCalorieTarget = _tinhCalorieTarget;

// ---- helper: gom lỗi validate thành map { path: message } ----
function toValidationMap(err) {
  if (!err || err.name !== "ValidationError") return null;
  const out = {};
  for (const k of Object.keys(err.errors || {})) {
    const e = err.errors[k];
    const path = (e && e.path) || k;
    out[path] = e.message || "Dữ liệu không hợp lệ";
  }
  return out;
}

function computeDerived(profile){
  if(!profile) return {};
  const { weightKg, heightCm, sex, dob, trainingIntensity } = profile;
  const out = {};
  if(typeof weightKg==="number" && typeof heightCm==="number") out.bmi = tinhBmi(weightKg,heightCm);
  if(typeof weightKg==="number" && typeof heightCm==="number" && sex && dob){
    const bmr = tinhBmr({ gioiTinh:sex, canNangKg:weightKg, chieuCaoCm:heightCm, ngaySinh:dob });
    out.bmr = bmr; out.tdee = tinhTdee(bmr, trainingIntensity || "level_1");
  }
  return out;
}

/** GET /api/user/me */
export const getMe = async (req,res)=>{
  const me = await User.findById(req.userId).select("_id username email phone role onboarded blocked blockedReason profile createdAt").lean();
  if(!me) return res.status(404).json({ message:"Không tìm thấy người dùng" });
  const needBackfill = !!me.profile && (me.profile?.bmi==null || me.profile?.bmr==null || me.profile?.tdee==null);
  if(needBackfill){
    try{
      const derived = computeDerived(me.profile);
      if(Object.keys(derived).length){
        await User.findByIdAndUpdate(me._id, {$set:{
          ...(derived.bmi!=null?{"profile.bmi":derived.bmi}:{}),
          ...(derived.bmr!=null?{"profile.bmr":derived.bmr}:{}),
          ...(derived.tdee!=null?{"profile.tdee":derived.tdee}:{}),
        }},{ runValidators:true });
        me.profile = { ...me.profile, ...derived };
      }
    }catch(e){ console.error("Backfill BMI/BMR/TDEE lỗi:", e?.message||e); }
  }
  res.json({ user:{ id:me._id, ...me } });
};

/** PATCH /api/user/onboarding */
export const patchOnboarding = async (req,res)=>{
  try{
    const allowed = ["profile.nickname","profile.goal","profile.heightCm","profile.weightKg","profile.targetWeightKg","profile.weeklyChangeKg","profile.trainingIntensity","profile.sex","profile.dob","profile.bodyFat"];
    const forbidden = ["profile.bmi","profile.bmr","profile.tdee","profile.calorieTarget"];
    const $set = {};
    for(const [k,v] of Object.entries(req.body||{})){ if(forbidden.includes(k)) continue; if(allowed.includes(k)) $set[k]=v; }
    if(!Object.keys($set).length) return res.status(400).json({ message:"Không có trường hợp hợp lệ" });

    if($set["profile.weeklyChangeKg"]!=null){
      const w=Number($set["profile.weeklyChangeKg"]);
      if(Number.isFinite(w)) $set["profile.weeklyChangeKg"]=Math.abs(w); else return res.status(400).json({ message:"weeklyChangeKg phải là số" });
    }
    if($set["profile.bodyFat"]!=null){
      const bf=Number($set["profile.bodyFat"]);
      if(!Number.isFinite(bf)||bf<0||bf>70) return res.status(400).json({ message:"bodyFat phải trong khoảng 0–70 (%)" });
    }

    const current = await User.findById(req.userId).select("_id profile").lean();
    if(!current) return res.status(404).json({ message:"Không tìm thấy người dùng" });

    const mergedProfile = { ...(current.profile||{}), ...Object.keys($set).reduce((acc,k)=>{ acc[k.replace(/^profile\./,"")]=$set[k]; return acc; },{}) };

    let derived={}; try{ derived=computeDerived(mergedProfile);}catch(e){ return res.status(400).json({ message:e?.message||"Dữ liệu không hợp lệ" }); }

    let calorieTarget;
    try{
      const baseTdee = typeof derived.tdee==="number" ? derived.tdee : mergedProfile.tdee;
      const baseBmr  = typeof derived.bmr==="number" ? derived.bmr  : mergedProfile.bmr;
      if(typeof tinhCalorieTarget==="function" && typeof baseTdee==="number" && baseTdee>0){
        calorieTarget = tinhCalorieTarget({ tdee:baseTdee, mucTieu:mergedProfile.goal, mucTieuTuan:mergedProfile.weeklyChangeKg, bmr:baseBmr });
      }
    }catch{}

    const finalSet = { ...$set,
      ...(derived.bmi!=null?{"profile.bmi":derived.bmi}:{}),
      ...(derived.bmr!=null?{"profile.bmr":derived.bmr}:{}),
      ...(derived.tdee!=null?{"profile.tdee":derived.tdee}:{}),
      ...(calorieTarget!=null?{"profile.calorieTarget":calorieTarget}:{}),
    };

    const updated = await User.findByIdAndUpdate(
      req.userId,
      { $set:finalSet },
      { new:true, runValidators:true }
    ).select("_id onboarded profile");

    return res.json({ success:true, user:updated });
  }catch(err){
    const map = toValidationMap(err);
    if (map) return res.status(422).json({ message:"Dữ liệu không hợp lệ", errors:map });
    console.error("patchOnboarding lỗi:", err?.message||err);
    return res.status(500).json({ message:"Lỗi máy chủ" });
  }
};

/** POST /api/user/onboarding/finalize */
export const finalizeOnboarding = async (_req,res)=>{ await User.findByIdAndUpdate(_req.userId,{$set:{onboarded:true}}); res.json({ success:true }); };

/** PATCH /api/user/account */
export const updateAccount = async (req,res)=>{
  try{
    const body = req.body || {};
    const allowedRoot = ["email","phone"];
    const allowedProfileFlat = [
      "profile.nickname","profile.sex","profile.dob","profile.trainingIntensity",
      "profile.calorieTarget","profile.macroProtein","profile.macroCarb","profile.macroFat",
      "profile.heightCm","profile.weightKg","profile.bodyFat","profile.avatarUrl",
      "profile.address.country","profile.address.countryCode","profile.address.city","profile.address.regionCode",
      "profile.address.district","profile.address.districtCode","profile.address.ward","profile.address.wardCode"
    ];
    const forbidden = ["profile.bmi","profile.bmr","profile.tdee","password","role","username"];

    const $set = {}; let $unset = null;

    // 1) Phẳng
    for(const [k,v] of Object.entries(body)){ if(forbidden.includes(k)) continue; if(allowedRoot.includes(k)||allowedProfileFlat.includes(k)) $set[k]=v; }

    // 2) Lồng
    if(body.profile && typeof body.profile==="object"){
      const prof = body.profile;
      if(prof.address && typeof prof.address==="object"){
        const a = prof.address;
        if(a.country!==undefined)      $set["profile.address.country"]=a.country;
        if(a.countryCode!==undefined)  $set["profile.address.countryCode"]=a.countryCode;
        if(a.city!==undefined)         $set["profile.address.city"]=a.city;
        if(a.regionCode!==undefined)   $set["profile.address.regionCode"]=a.regionCode;
        if(a.district!==undefined)     $set["profile.address.district"]=a.district;
        if(a.districtCode!==undefined) $set["profile.address.districtCode"]=a.districtCode;
        if(a.ward!==undefined)         $set["profile.address.ward"]=a.ward;
        if(a.wardCode!==undefined)     $set["profile.address.wardCode"]=a.wardCode;
      }
    }
    if(body.phone!==undefined) $set.phone = body.phone;
    if(body.email!==undefined) $set.email = body.email;

    // 3) Chuẩn hoá GeoJSON location
    let lng=null, lat=null;
    if(Array.isArray(body["profile.location.coordinates"])){
      const [LNG,LAT] = body["profile.location.coordinates"].map(Number);
      if(Number.isFinite(LNG)&&Number.isFinite(LAT)){ lng=LNG; lat=LAT; }
    }
    if(body["profile.location.lng"]!=null && body["profile.location.lat"]!=null){
      const LNG=Number(body["profile.location.lng"]), LAT=Number(body["profile.location.lat"]);
      if(Number.isFinite(LNG)&&Number.isFinite(LAT)){ lng=LNG; lat=LAT; }
    }
    if(body.profile && body.profile.location){
      const loc = body.profile.location;
      if(Array.isArray(loc.coordinates)){
        const [LNG,LAT] = loc.coordinates.map(Number);
        if(Number.isFinite(LNG)&&Number.isFinite(LAT)){ lng=LNG; lat=LAT; }
      }else if(loc.lng!=null && loc.lat!=null){
        const LNG=Number(loc.lng), LAT=Number(loc.lat);
        if(Number.isFinite(LNG)&&Number.isFinite(LAT)){ lng=LNG; lat=LAT; }
      }
    }
    if(Number.isFinite(lng)&&Number.isFinite(lat)){
      $set["profile.location"] = { type:"Point", coordinates:[lng,lat] };
    }else if("profile.location.coordinates" in body || (body.profile && body.profile.location)){
      $unset = $unset || {}; $unset["profile.location"] = "";
    }

    if(!Object.keys($set).length && !$unset) return res.status(400).json({ message:"Không có trường hợp hợp lệ để cập nhật" });

    // ràng buộc số cơ bản
    if($set["profile.bodyFat"]!=null){
      const bf=Number($set["profile.bodyFat"]);
      if(!Number.isFinite(bf)||bf<0||bf>70) return res.status(400).json({ message:"bodyFat phải trong khoảng 0–70 (%)" });
      $set["profile.bodyFat"]=bf;
    }
    if($set["profile.heightCm"]!=null) $set["profile.heightCm"]=Number($set["profile.heightCm"]);
    if($set["profile.weightKg"]!=null) $set["profile.weightKg"]=Number($set["profile.weightKg"]);

    const current = await User.findById(req.userId).select("_id email phone profile").lean();
    if(!current) return res.status(404).json({ message:"Không tìm thấy người dùng" });

    if($set.email && $set.email!==current.email){
      const existed = await User.findOne({ email:$set.email }).select("_id").lean();
      if(existed) return res.status(409).json({ message:"Email đã được sử dụng" });
    }

    // merge để tính derived
    const mergedProfile = {
      ...(current.profile||{}),
      ...Object.keys($set).reduce((acc,k)=>{
        if(k.startsWith("profile.") && !k.startsWith("profile.location")){
          const key=k.replace(/^profile\./,""); const path=key.split(".");
          if(path.length===1) acc[key]=$set[k];
          else acc[path[0]]={...(acc[path[0]]||{}), [path[1]]:$set[k]};
        }
        return acc;
      },{})
    };

    const derived = computeDerived(mergedProfile);
    const finalSet = { ...$set,
      ...(derived.bmi!=null?{"profile.bmi":derived.bmi}:{}),
      ...(derived.bmr!=null?{"profile.bmr":derived.bmr}:{}),
      ...(derived.tdee!=null?{"profile.tdee":derived.tdee}:{}),
    };

    const updateDoc = $unset ? { $set:finalSet, $unset } : { $set:finalSet };
    const updated = await User.findByIdAndUpdate(
      req.userId,
      updateDoc,
      { new:true, runValidators:true }
    ).select("_id username email phone role onboarded profile createdAt");

    return res.json({ success:true, user:updated });
  }catch(err){
    const map = toValidationMap(err);
    if (map) return res.status(422).json({ message:"Dữ liệu không hợp lệ", errors:map });
    console.error("updateAccount lỗi:", err?.message||err);
    return res.status(500).json({ message:"Lỗi máy chủ" });
  }
};

/** POST /api/user/change-password */
export const changePassword = async (req,res)=>{
  try{
    const { currentPassword, newPassword } = req.body || {};
    if(!currentPassword||!newPassword) return res.status(400).json({ message:"Thiếu currentPassword hoặc newPassword" });
    if(String(newPassword).length<6) return res.status(400).json({ message:"Mật khẩu mới phải có ít nhất 6 ký tự" });
    const user = await User.findById(req.userId).select("+password");
    if(!user) return res.status(404).json({ message:"Không tìm thấy người dùng" });
    const match = await user.comparePassword(currentPassword);
    if(!match) return res.status(400).json({ message:"Mật khẩu hiện tại không đúng" });
    user.password = String(newPassword); await user.save();
    return res.json({ success:true, message:"Đổi mật khẩu thành công" });
  }catch(e){
    console.error("changePassword lỗi:", e?.message||e);
    return res.status(500).json({ message:"Lỗi máy chủ" });
  }
};

/** DELETE /api/user
 *  - Xoá tất cả dữ liệu (Onboarding, NutritionLog, WaterLog, Food do user tạo)
 *  - Xoá chính tài khoản
 *  - Dọn file ảnh (avatar, ảnh món ăn) trên disk sau khi commit
 */
export const deleteAccount = async (req,res)=>{
  const userId = req.userId;
  if(!userId) return res.status(401).json({ success:false, message:"Unauthorized" });

  const session = await mongoose.startSession();
  session.startTransaction();

  try{
    const uid = new mongoose.Types.ObjectId(userId);

    // Lấy thông tin cần để dọn file sau commit
    const user = await User.findById(uid).select("profile.avatarUrl").session(session);
    const foods = await Food.find({ createdBy: uid }).select("_id imageUrl").session(session);

    // Đếm (tuỳ thích trả về)
    const [nOnb, nNLogs, nWLogs, nFoods] = await Promise.all([
      OnboardingProfile.countDocuments({ user: uid }).session(session),
      NutritionLog.countDocuments({ user: uid }).session(session),
      WaterLog.countDocuments({ user: uid }).session(session),
      Food.countDocuments({ createdBy: uid }).session(session),
    ]);

    // Xoá dữ liệu phụ thuộc
    await Promise.all([
      OnboardingProfile.deleteMany({ user: uid }, { session }),
      NutritionLog.deleteMany({ user: uid }, { session }),
      WaterLog.deleteMany({ user: uid }, { session }),
      Food.deleteMany({ createdBy: uid }, { session }),
    ]);

    // Xoá chính user
    await User.deleteOne({ _id: uid }, { session });

    // Commit DB trước, rồi mới dọn file để không ảnh hưởng transaction
    await session.commitTransaction();
    session.endSession();

    // ====== Cleanup files từ Cloudinary (không chặn response nếu lỗi) ======
    // Avatar
    if (user?.profile?.avatarUrl) {
      try {
        // Kiểm tra nếu là Cloudinary URL
        if (user.profile.avatarUrl.includes("cloudinary.com")) {
          await deleteFile(user.profile.avatarUrl, "image");
        } else if (String(user.profile.avatarUrl).startsWith("/uploads/avatars/")) {
          // Fallback: xóa local nếu còn file cũ
          const filename = path.basename(user.profile.avatarUrl);
          const filePath = path.join(AVATAR_DIR, filename);
          fs.promises.unlink(filePath).catch(()=>{});
        }
      } catch {}
    }

    // Ảnh món ăn
    if (Array.isArray(foods)) {
      for (const f of foods) {
        const u = f?.imageUrl;
        if (u) {
          try {
            // Kiểm tra nếu là Cloudinary URL
            if (u.includes("cloudinary.com")) {
              await deleteFile(u, "image");
            } else if (String(u).startsWith("/uploads/foods/")) {
              // Fallback: xóa local nếu còn file cũ
              const filename = path.basename(u);
              const filePath = path.join(FOOD_DIR, filename);
              fs.promises.unlink(filePath).catch(()=>{});
            }
          } catch {}
        }
      }
    }
    // ==========================================

    return res.json({
      success:true,
      message:"Tài khoản và toàn bộ dữ liệu đã được xoá",
      deleted:{
        onboarding: nOnb,
        nutritionLogs: nNLogs,
        waterLogs: nWLogs,
        foods: nFoods,
        user: 1
      }
    });
  }catch(e){
    try { await session.abortTransaction(); session.endSession(); } catch {}
    console.error("deleteAccount lỗi:", e?.message||e);
    return res.status(500).json({ success:false, message:"Lỗi máy chủ" });
  }
};

export const uploadAvatar = async (req,res)=>{
  try{
    const file=req.file; if(!file) return res.status(400).json({ success:false, message:"Không có tệp avatar" });
    
    // Upload lên Cloudinary
    const avatarUrl = await uploadImageWithResize(
      file.buffer,
      "asset/folder/avatars",
      { width: 512, height: 512, fit: "cover" },
      { quality: 85 }
    );
    
    const updatedUser=await User.findByIdAndUpdate(
      req.userId,
      {$set:{"profile.avatarUrl":avatarUrl}},
      {new:true,runValidators:true}
    ).select("_id username email role onboarded profile createdAt");
    if(!updatedUser) return res.status(404).json({ success:false, message:"Không tìm thấy người dùng" });
    return res.json({ success:true, avatarUrl, user:updatedUser });
  }catch(e){
    const map = toValidationMap(e);
    if (map) return res.status(422).json({ success:false, message:"Dữ liệu không hợp lệ", errors:map });
    console.error("uploadAvatar lỗi:", e?.message||e);
    return res.status(500).json({ success:false, message:"Lỗi máy chủ" });
  }
};

/** POST /api/user/progress-photo
 *  - Upload ảnh tiến độ (front/side/back) lên Cloudinary
 *  - Lưu vào profile.progressPhotos
 *  - Dùng chung middleware uploadAvatarSingle (field "avatar")
 */
export const uploadProgressPhoto = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res
        .status(400)
        .json({ success: false, message: "Không có tệp ảnh" });
    }

    const rawType =
      (req.body?.type || req.body?.view || "").toString().trim();
    const allowed = ["front", "side", "back"];
    if (!allowed.includes(rawType)) {
      return res.status(400).json({
        success: false,
        message: "Loại ảnh không hợp lệ (front / side / back)",
      });
    }

    // Ngày chụp (optional)
    let takenAt = undefined;
    const tRaw = req.body?.takenAt;
    if (tRaw) {
      const d = new Date(tRaw);
      if (!Number.isNaN(d.getTime())) takenAt = d;
    }
    if (!takenAt) takenAt = new Date();

    // Upload Cloudinary (cùng 'vị trí' với avatar, chỉ khác folder)
    const photoUrl = await uploadImageWithResize(
      file.buffer,
      "asset/folder/body-progress",
      { width: 1024, height: 1024, fit: "cover" },
      { quality: 85 }
    );

    const doc = {
      view: rawType,
      url: photoUrl,
      takenAt,
      createdAt: new Date(),
    };

    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { $push: { "profile.progressPhotos": doc } },
      { new: true, runValidators: true }
    ).select("_id username email role onboarded profile createdAt");

    if (!updatedUser) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    return res.json({
      success: true,
      photo: doc,
      user: updatedUser,
    });
  } catch (e) {
    const map = toValidationMap(e);
    if (map)
      return res.status(422).json({
        success: false,
        message: "Dữ liệu không hợp lệ",
        errors: map,
      });
    console.error("uploadProgressPhoto lỗi:", e?.message || e);
    return res
      .status(500)
      .json({ success: false, message: "Lỗi máy chủ" });
  }
};