// src/models/Admin.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const USERNAME_REGEX = /^[a-zA-Z0-9]{4,200}$/;      // chỉ chữ & số, 4..200
const NICKNAME_PLAIN_REGEX = /^[\p{L}\d\s]{1,30}$/u; // không ký tự đặc biệt

const adminSchema = new mongoose.Schema({
  username: {
    type:String,
    required:[true,"Vui lòng nhập username"],
    unique:true,
    trim:true,
    minlength:[4,"Username tối thiểu 4 ký tự"],
    maxlength:[200,"Username tối đa 200 ký tự"],
    validate:{
      validator:(v)=>USERNAME_REGEX.test(v),
      message:"Username chỉ gồm chữ và số"
    }
  },
  // BỔ SUNG: nickname (bắt buộc, <=30, KHÔNG ký tự đặc biệt)
  nickname: {
    type:String,
    required:[true,"Vui lòng nhập Nickname"],
    trim:true,
    maxlength:[30,"Nickname tối đa 30 ký tự"],
    validate:{
      validator:(v)=>NICKNAME_PLAIN_REGEX.test(v),
      message:"Nickname không được chứa ký tự đặc biệt"
    }
  },
  // BỎ email
  password: {
    type:String,
    required:[true,"Vui lòng nhập mật khẩu"],
    select:false,
    minlength:[6,"Mật khẩu tối thiểu 6 ký tự"],
    maxlength:[200,"Mật khẩu tối đa 200 ký tự"]
  },
  level:    { type:Number, enum:[1,2], default:2 }, // 1 = Cấp 1 (duy nhất)
  status:   { type:String, enum:["active","blocked"], default:"active" },
}, { timestamps:true });

// Chỉ DUY NHẤT 1 tài khoản level=1
adminSchema.index({ level: 1 }, { unique: true, partialFilterExpression: { level: 1 } });

adminSchema.pre("save", async function(next){
  if(!this.isModified("password")) return next();
  if(typeof this.password==="string" && /^\$2[aby]\$/.test(this.password)) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

adminSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

export const Admin = mongoose.model("Admin", adminSchema);
