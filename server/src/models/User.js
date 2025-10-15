import mongoose from "mongoose";

const profileSchema = new mongoose.Schema(
  {
    nickname: { type: String, trim: true, maxlength: [30, "Nickname không được vượt quá 30 ký tự"] },
    goal: { type: String, enum: ["giam_can", "duy_tri", "tang_can", "giam_mo", "tang_co"], default: "" },
    heightCm: { type: Number, min: [100, "Chiều cao tối thiểu là 100 cm"], max: [220, "Chiều cao tối đa là 220 cm"] },

    // cập nhật: 30..200
    weightKg: { type: Number, min: [30, "Cân nặng tối thiểu là 30 kg"], max: [200, "Cân nặng tối đa là 200 kg"] },

    targetWeightKg: { type: Number, min: [20, "Cân nặng mục tiêu tối thiểu là 20 kg"], max: [300, "Cân nặng mục tiêu tối đa là 300 kg"] },

    // cập nhật: dương 0.1..1
    weeklyChangeKg: { type: Number, min: [0.1, "Mục tiêu tuần tối thiểu 0.1 kg"], max: [1, "Mục tiêu tuần tối đa 1 kg"] },

    trainingIntensity: { type: String, trim: true, default: "" }, // hoặc enum level_1..4
    sex: { type: String, enum: ["male", "female"], default: undefined },
    dob: {
      type: String,
      validate: {
        validator: (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v),
        message: "Ngày sinh phải theo định dạng YYYY-MM-DD",
      },
    },
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

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: [true, "Tên tài khoản là bắt buộc"], unique: true, trim: true, minlength: [3, "Tên tài khoản phải có ít nhất 3 ký tự"] },
    email: { type: String, required: [true, "Email là bắt buộc"], unique: true, trim: true, lowercase: true },
    password: { type: String, required: [true, "Mật khẩu là bắt buộc"], minlength: [6, "Mật khẩu phải có ít nhất 6 ký tự"], select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    onboarded: { type: Boolean, default: false },
    profile: profileSchema,
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
