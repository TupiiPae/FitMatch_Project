import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/* Profile */
const profileSchema = new mongoose.Schema({
  avatarUrl:{ type:String, trim:true, maxlength:500, default:undefined },
  nickname:{ type:String, trim:true, maxlength:30 },
  goal:{ type:String, enum:["giam_can","duy_tri","tang_can","giam_mo","tang_co"], default:"" },
  heightCm:{ type:Number, min:100, max:220 },
  weightKg:{ type:Number, min:30,  max:200 },
  targetWeightKg:{ type:Number, min:20, max:300 },
  weeklyChangeKg:{ type:Number, min:0.1, max:1 },
  trainingIntensity:{ type:String, trim:true, default:"" },
  sex:{ type:String, enum:["male","female"], default:undefined },
  dob:{ type:String, validate:{ validator:v=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v), message:"Ngày sinh phải theo định dạng YYYY-MM-DD" } },
  bodyFat:{ type:Number, min:0, max:70 },
  bmi:{ type:Number, min:5, max:80 },
  bmr:{ type:Number, min:500, max:5000 },
  tdee:{ type:Number, min:800, max:8000 },
  calorieTarget:{ type:Number, min:800, max:8000 },
  macroProtein:{ type:Number, min:0, max:100 },
  macroCarb:{    type:Number, min:0, max:100 },
  macroFat:{     type:Number, min:0, max:100 },

  // Address (chuẩn hoá để lọc/match)
  address:{
    countryCode:{ type:String, trim:true, maxlength:10 },
    country:{     type:String, trim:true, maxlength:100 },
    regionCode:{  type:String, trim:true, maxlength:20 },  // HN/HCM
    city:{        type:String, trim:true, maxlength:100 },
    districtCode:{type:String, trim:true, maxlength:40 },
    district:{    type:String, trim:true, maxlength:120 },
    // Ward để sau: wardCode, ward
  },

  // GeoJSON Point: [lng, lat]
  location:{
    type:{ type:String, enum:["Point"], default:"Point" },
    coordinates:{ type:[Number], default: undefined } // [lng, lat]
  }
},{ _id:false });

/* User */
const userSchema = new mongoose.Schema({
  username:{ type:String, required:[true,"Tên tài khoản là bắt buộc"], unique:true, trim:true, minlength:[3,"Tên tài khoản phải có ít nhất 3 ký tự"] },
  email:{ type:String, required:[true,"Email là bắt buộc"], unique:true, trim:true, lowercase:true },
  phone:{ type:String, trim:true, maxlength:30, default:"" }, // thêm phone
  password:{ type:String, required:[true,"Mật khẩu là bắt buộc"], minlength:[6,"Mật khẩu phải có ít nhất 6 ký tự"], select:false },
  role:{ type:String, enum:["user","admin"], default:"user" },
  onboarded:{ type:Boolean, default:false },
  profile: profileSchema,
},{ timestamps:true });

userSchema.index({ "profile.location": "2dsphere" }); // để query theo bán kính

userSchema.pre("save", async function(next){
  if (!this.isModified("password")) return next();
  if (typeof this.password==="string" && /^\$2[aby]\$/.test(this.password) && this.password.length>=50) return next();
  try { this.password = await bcrypt.hash(this.password,10); next(); } catch(err){ next(err); }
});

userSchema.methods.comparePassword = function(candidate){ return bcrypt.compare(candidate, this.password); };

export const User = mongoose.model("User", userSchema);
