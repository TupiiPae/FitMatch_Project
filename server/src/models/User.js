// server/src/models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

/* -------- Profile (giữ nguyên như bạn đưa) -------- */
const profileSchema = new mongoose.Schema(
  {
    // Ảnh đại diện (đường dẫn tuyệt đối hoặc tương đối từ BE, vd: /uploads/avatars/xxx.png)
    avatarUrl: {
      type: String,
      trim: true,
      maxlength: [500, "Đường dẫn ảnh quá dài"],
      default: undefined,
    },
    nickname: { type: String, trim: true, maxlength: [30, "Nickname không được vượt quá 30 ký tự"] },
    goal: {
      type: String,
      enum: ["giam_can", "duy_tri", "tang_can", "giam_mo", "tang_co"],
      default: "",
    },
    heightCm: {
      type: Number,
      min: [100, "Chiều cao tối thiểu là 100 cm"],
      max: [220, "Chiều cao tối đa là 220 cm"],
    },
    // cập nhật: 30..200
    weightKg: {
      type: Number,
      min: [30, "Cân nặng tối thiểu là 30 kg"],
      max: [200, "Cân nặng tối đa là 200 kg"],
    },
    targetWeightKg: {
      type: Number,
      min: [20, "Cân nặng mục tiêu tối thiểu là 20 kg"],
      max: [300, "Cân nặng mục tiêu tối đa là 300 kg"],
    },
    // cập nhật: dương 0.1..1
    weeklyChangeKg: {
      type: Number,
      min: [0.1, "Mục tiêu tuần tối thiểu 0.1 kg"],
      max: [1, "Mục tiêu tuần tối đa 1 kg"],
    },
    trainingIntensity: { type: String, trim: true, default: "" }, // hoặc enum level_1..4
    sex: { type: String, enum: ["male", "female"], default: undefined },
    dob: {
      type: String,
      validate: {
        validator: (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v),
        message: "Ngày sinh phải theo định dạng YYYY-MM-DD",
      },
    },

    bodyFat: { type: Number, min: 0, max: 70 },
    bmi: { type: Number, min: [5, "BMI không hợp lệ"], max: [80, "BMI không hợp lệ"] },
    bmr: { type: Number, min: [500, "BMR không hợp lệ"], max: [5000, "BMR không hợp lệ"] },
    tdee: { type: Number, min: [800, "TDEE không hợp lệ"], max: [8000, "TDEE không hợp lệ"] },

    // --- Nutrition targets ---
    calorieTarget: { type: Number, min: [800, "Calo tối thiểu 800"], max: [8000, "Calo tối đa 8000"] },
    macroProtein: { type: Number, min: [0, ">=0"], max: [100, "<=100"] }, // %
    macroCarb:    { type: Number, min: [0, ">=0"], max: [100, "<=100"] }, // %
    macroFat:     { type: Number, min: [0, ">=0"], max: [100, "<=100"] }, // %
  },
  { _id: false }
);

/* ---------------------- User ---------------------- */
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Tên tài khoản là bắt buộc"],
      unique: true,
      trim: true,
      minlength: [3, "Tên tài khoản phải có ít nhất 3 ký tự"],
    },
    email: {
      type: String,
      required: [true, "Email là bắt buộc"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    // CHÚ Ý: select:false → cần .select("+password") khi đăng nhập/đổi mật khẩu
    password: {
      type: String,
      required: [true, "Mật khẩu là bắt buộc"],
      minlength: [6, "Mật khẩu phải có ít nhất 6 ký tự"],
      select: false,
    },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    onboarded: { type: Boolean, default: false },
    profile: profileSchema,
  },
  { timestamps: true }
);

/* ----- Hash password tự động trước khi lưu ----- */
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  // Nếu đã là bcrypt hash (tránh double-hash)
  if (
    typeof this.password === "string" &&
    /^\$2[aby]\$/.test(this.password) &&
    this.password.length >= 50
  ) {
    return next();
  }

  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (err) {
    next(err);
  }
});

/* ----- Convenience method so sánh mật khẩu ----- */
userSchema.methods.comparePassword = function (candidate) {
  // Lưu ý: chỉ dùng được khi đã .select("+password") để có hash
  return bcrypt.compare(candidate, this.password);
};

export const User = mongoose.model("User", userSchema);
