import path from "path";
import fs from "fs";
import sharp from "sharp";
import { fileURLToPath } from "url";
import { User } from "../models/User.js";
import { OnboardingProfile } from "../models/OnboardingProfile.js";
import { tinhBmi, tinhBmr, tinhTdee, tinhCalorieTarget as _tinhCalorieTarget } from "../utils/health.js";
import { AVATAR_DIR } from "../middleware/upload.js";

const tinhCalorieTarget = _tinhCalorieTarget;

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
  const me = await User.findById(req.userId).select("_id username email phone role onboarded profile createdAt").lean();
  if(!me) return res.status(404).json({ message:"Không tìm thấy người dùng" });
  const needBackfill = !!me.profile && (me.profile?.bmi==null || me.profile?.bmr==null || me.profile?.tdee==null);
  if(needBackfill){
    try{
      const derived = computeDerived(me.profile);
      if(Object.keys(derived).length){
        await User.findByIdAndUpdate(me._id, {$set:{
          ...(derived.bmi!=null?{"profile.bmi":derived.bmi}:{}),
          ...(derived.bmr!=null?{"profile.bmr":derived.bmr}:{}),
          ...(derived.tdee!=null?{"profile.tdee":derived.tdee}:{})
        }},{ runValidators:true });
        me.profile = { ...me.profile, ...derived };
      }
    }catch(e){ console.error("Backfill BMI/BMR/TDEE lỗi:", e?.message||e); }
  }
  res.json({ user:{ id:me._id, ...me } });
};

/** PATCH /api/user/onboarding */
export const patchOnboarding = async (req,res)=>{
  const allowed = ["profile.nickname","profile.goal","profile.heightCm","profile.weightKg","profile.targetWeightKg","profile.weeklyChangeKg","profile.trainingIntensity","profile.sex","profile.dob","profile.bodyFat"];
  const forbidden = ["profile.bmi","profile.bmr","profile.tdee","profile.calorieTarget"];
  const $set = {};
  for(const [k,v] of Object.entries(req.body||{})){ if(forbidden.includes(k)) continue; if(allowed.includes(k)) $set[k]=v; }
  if(!Object.keys($set).length) return res.status(400).json({ message:"Không có trường hợp lệ" });

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
    ...(calorieTarget!=null?{"profile.calorieTarget":calorieTarget}:{})
  };

  const updated = await User.findByIdAndUpdate(req.userId, { $set:finalSet }, { new:true, runValidators:true }).select("_id onboarded profile");
  res.json({ success:true, user:updated });
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
      // CHÚ Ý: KHÔNG cho phép "profile.location.coordinates" trực tiếp để tránh lưu sai; ta normalize bên dưới.
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

    // 3) Chuẩn hoá GeoJSON location: chấp nhận nhiều kiểu input
    let lng=null, lat=null;
    // a) dạng phẳng
    if(Array.isArray(body["profile.location.coordinates"])){
      const [LNG,LAT] = body["profile.location.coordinates"].map(Number);
      if(Number.isFinite(LNG)&&Number.isFinite(LAT)){ lng=LNG; lat=LAT; }
    }
    if(body["profile.location.lng"]!=null && body["profile.location.lat"]!=null){
      const LNG=Number(body["profile.location.lng"]), LAT=Number(body["profile.location.lat"]);
      if(Number.isFinite(LNG)&&Number.isFinite(LAT)){ lng=LNG; lat=LAT; }
    }
    // b) dạng lồng
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
    // c) áp vào $set hoặc $unset
    if(Number.isFinite(lng)&&Number.isFinite(lat)){
      $set["profile.location"] = { type:"Point", coordinates:[lng,lat] };
    }else if("profile.location.coordinates" in body || (body.profile && body.profile.location)){
      $unset = $unset || {}; $unset["profile.location"] = "";
    }

    if(!Object.keys($set).length && !$unset) return res.status(400).json({ message:"Không có trường hợp lệ để cập nhật" });

    // ràng buộc số
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
      ...(derived.tdee!=null?{"profile.tdee":derived.tdee}:{})
    };

    const updateDoc = $unset ? { $set:finalSet, $unset } : { $set:finalSet };
    const updated = await User.findByIdAndUpdate(req.userId, updateDoc, { new:true, runValidators:true })
      .select("_id username email phone role onboarded profile createdAt");

    return res.json({ success:true, user:updated });
  }catch(e){
    console.error("updateAccount lỗi:", e?.message||e);
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

/** DELETE /api/user */
export const deleteAccount = async (req,res)=>{
  try{
    await OnboardingProfile.findOneAndDelete({ user:req.userId });
    await User.findByIdAndDelete(req.userId);
    return res.json({ success:true, message:"Tài khoản đã được xoá" });
  }catch(e){
    console.error("deleteAccount lỗi:", e?.message||e);
    return res.status(500).json({ message:"Lỗi máy chủ" });
  }
};

export const uploadAvatar = async (req,res)=>{
  try{
    const file=req.file; if(!file) return res.status(400).json({ success:false, message:"Không có tệp avatar" });
    const baseName=`${req.userId||"guest"}-${Date.now()}`, outPath=path.join(AVATAR_DIR,`${baseName}.webp`);
    await sharp(file.buffer).rotate().resize(512,512,{fit:"cover",position:"center"}).toFormat("webp",{quality:85}).toFile(outPath);
    const avatarUrl=`/uploads/avatars/${baseName}.webp`;
    const updatedUser=await User.findByIdAndUpdate(req.userId,{$set:{"profile.avatarUrl":avatarUrl}},{new:true,runValidators:true})
      .select("_id username email role onboarded profile createdAt");
    if(!updatedUser) return res.status(404).json({ success:false, message:"Không tìm thấy người dùng" });
    return res.json({ success:true, avatarUrl, user:updatedUser });
  }catch(e){
    console.error("uploadAvatar lỗi:", e?.message||e);
    return res.status(500).json({ success:false, message:"Lỗi máy chủ" });
  }
};
