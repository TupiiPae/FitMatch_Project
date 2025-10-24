// src/models/Admin.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const adminSchema = new mongoose.Schema({
  username: { type:String, required:true, unique:true, trim:true, minlength:3 },
  // CHO PHÉP BỎ TRỐNG + INDEX SPARSE
  email:    { type:String, unique:true, sparse:true, trim:true, lowercase:true, default: undefined },
  password: { type:String, required:true, select:false, minlength:6 },
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

adminSchema.methods.comparePassword = function(candidate){
  return bcrypt.compare(candidate, this.password);
};

export const Admin = mongoose.model("Admin", adminSchema);
