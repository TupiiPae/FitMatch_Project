// server/src/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const USERNAME_REGEX = /^[a-zA-Z0-9]{4,200}$/;
const EMAIL_GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
const PHONE_REGEX = /^\d{1,11}$/;

/* ---------- Profile ---------- */
const profileSchema = new mongoose.Schema({
  avatarUrl: { type: String, trim: true, maxlength: 500, default: undefined },
  nickname: {
    type: String,
    required: [true, "Vui lòng nhập biệt danh (nickname)"],
    trim: true,
    maxlength: [30, "Nickname tối đa 30 ký tự"],
  },
  goal: {
    type: String,
    enum: ["giam_can", "duy_tri", "tang_can", "giam_mo", "tang_co"],
    default: undefined, // ❗ KHÔNG để "" để tránh lỗi enum
  },
  heightCm: { type: Number, min: 100, max: 220 },
  weightKg: { type: Number, min: 30, max: 200 },
  targetWeightKg: { type: Number, min: 20, max: 300 },
  weeklyChangeKg: { type: Number, min: 0.1, max: 1 },
  trainingIntensity: { type: String, trim: true, default: "" },
  sex: { type: String, enum: ["male", "female"], default: undefined },
  dob: {
    type: String,
    validate: {
      validator: (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v),
      message: "Ngày sinh phải theo định dạng YYYY-MM-DD",
    },
  },
  bodyFat: { type: Number, min: 0, max: 70 },
  bmi: { type: Number, min: 5, max: 80 },
  bmr: { type: Number, min: 500, max: 5000 },
  tdee: { type: Number, min: 800, max: 8000 },
  calorieTarget: { type: Number, min: 800, max: 8000 },
  macroProtein: { type: Number, min: 0, max: 100 },
  macroCarb: { type: Number, min: 0, max: 100 },
  macroFat: { type: Number, min: 0, max: 100 },

  address: {
    countryCode: { type: String, trim: true, maxlength: 10 },
    country: { type: String, trim: true, maxlength: 100 },
    regionCode: { type: String, trim: true, maxlength: 20 },
    city: { type: String, trim: true, maxlength: 100 },
    districtCode: { type: String, trim: true, maxlength: 40 },
    district: { type: String, trim: true, maxlength: 120 },
    wardCode: { type: String, trim: true, maxlength: 40 },
    ward: { type: String, trim: true, maxlength: 120 },
  },

  // ❗ Không để default:"Point" nữa
  location: {
    type: {
      type: String,
      enum: ["Point"],
    },
    coordinates: {
      type: [Number], // [lng, lat]
      validate: {
        validator: (arr) =>
          !arr ||
          (Array.isArray(arr) &&
            arr.length === 2 &&
            arr.every((n) => typeof n === "number" && Number.isFinite(n))),
        message: "Location phải có dạng [lng, lat]",
      },
    },
  },
}, { _id: false });

/* ---------- User ---------- */
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, "Tên tài khoản là bắt buộc"],
    unique: true,
    trim: true,
    minlength: [4, "Tên tài khoản phải có ít nhất 4 ký tự"],
    maxlength: [200, "Tên tài khoản tối đa 200 ký tự"],
    validate: {
      validator: (v) => USERNAME_REGEX.test(v),
      message: "Username chỉ gồm chữ và số (không chứa ký tự đặc biệt)",
    },
  },
  email: {
    type: String,
    required: [true, "Email là bắt buộc"],
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: [100, "Email tối đa 100 ký tự"],
    validate: {
      validator: (v) => EMAIL_GMAIL_REGEX.test(v),
      message: "Email phải có đuôi @gmail.com",
    },
  },
  phone: {
    type: String,
    trim: true,
    default: "",
    validate: [
      { validator: (v) => !v || PHONE_REGEX.test(v), message: "Số điện thoại chỉ gồm chữ số và tối đa 11 ký tự" },
      { validator: (v) => (!v ? true : Number.isInteger(Number(v)) && Number(v) > 0), message: "Số điện thoại phải là số nguyên dương" },
    ],
  },
  password: {
    type: String,
    required: [true, "Mật khẩu là bắt buộc"],
    minlength: [6, "Mật khẩu phải có ít nhất 6 ký tự"],
    maxlength: [200, "Mật khẩu tối đa 200 ký tự"],
    select: false,
  },
  blocked: { type: Boolean, default: false },
  blockedReason: { type: String, trim: true, maxlength: 500, default: undefined },
  blockedAt: { type: Date, default: undefined },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  onboarded: { type: Boolean, default: false },
  profile: profileSchema,
}, { timestamps: true });

userSchema.index({ "profile.location": "2dsphere" });

// Guard: nếu location tồn tại nhưng không đủ toạ độ -> loại bỏ để tránh lỗi insert
userSchema.pre("save", function (next) {
  const loc = this.profile?.location;
  const ok = loc && Array.isArray(loc.coordinates) && loc.coordinates.length === 2;
  if (!ok && this.profile && this.profile.location) {
    this.profile.location = undefined;
  }
  next();
});

// Hash password nếu thay đổi
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  if (typeof this.password === "string" && /^\$2[aby]\$/.test(this.password) && this.password.length >= 50) {
    return next();
  }
  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (err) {
    next(err);
  }
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.pre("validate", function (next) {
  const loc = this.profile?.location;
  const ok = loc && Array.isArray(loc.coordinates) && loc.coordinates.length === 2
           && loc.coordinates.every((n) => typeof n === "number" && Number.isFinite(n));
  if (!ok && this.profile && this.profile.location) {
    this.profile.location = undefined;
  }
  next();
});

export const User = mongoose.model("User", userSchema);
