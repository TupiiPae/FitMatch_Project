import mongoose from "mongoose";

// ====== Schema con: lưu thông tin cá nhân và mục tiêu của người dùng ======
const profileSchema = new mongoose.Schema(
  {
    // từ Onboarding.tenGoi
    nickname: {
      type: String,
      trim: true,
      maxlength: [30, "Nickname không được vượt quá 30 ký tự"],
    },

    // từ Onboarding.mucTieu
    goal: {
      type: String,
      enum: ["giam_can", "duy_tri", "tang_can", "giam_mo", "tang_co"],
      default: "",
    },

    // từ Onboarding.chieuCao
    heightCm: {
      type: Number,
      min: [100, "Chiều cao tối thiểu là 100 cm"],
      max: [220, "Chiều cao tối đa là 220 cm"],
    },

    // từ Onboarding.canNangHienTai
    weightKg: {
      type: Number,
      min: [20, "Cân nặng tối thiểu là 20 kg"],
      max: [300, "Cân nặng tối đa là 300 kg"],
    },

    // từ Onboarding.canNangMongMuon
    targetWeightKg: {
      type: Number,
      min: [20, "Cân nặng mục tiêu tối thiểu là 20 kg"],
      max: [300, "Cân nặng mục tiêu tối đa là 300 kg"],
    },

    // từ Onboarding.mucTieuTuan (âm: giảm, dương: tăng)
    weeklyChangeKg: {
      type: Number,
      default: 0,
    },

    // từ Onboarding.cuongDoLuyenTap (giữ linh hoạt chuỗi)
    // (Nếu muốn chặt chẽ hơn: enum: ["level_1","level_2","level_3","level_4"])
    trainingIntensity: {
      type: String,
      trim: true,
      default: "",
    },

    // ====== BỔ SUNG từ Onboarding để đủ hồ sơ sức khoẻ ======

    // từ Onboarding.gioiTinh
    sex: {
      type: String,
      enum: ["male", "female"],
      default: undefined, // để biết đã/ chưa điền
    },

    // từ Onboarding.ngaySinh (YYYY-MM-DD)
    dob: {
      type: String,
      validate: {
        validator: (v) =>
          typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v),
        message: "Ngày sinh phải theo định dạng YYYY-MM-DD",
      },
    },

    // từ hệ thống tính trong Onboarding
    bmi: {
      type: Number, // (kg / m^2)
      min: [5, "BMI không hợp lệ"],
      max: [80, "BMI không hợp lệ"],
    },

    // từ hệ thống tính trong Onboarding
    bmr: {
      type: Number, // kcal/ngày
      min: [500, "BMR không hợp lệ"],
      max: [5000, "BMR không hợp lệ"],
    },
  },
  { _id: false }
);

// ====== Schema chính ======
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
    password: {
      type: String,
      required: [true, "Mật khẩu là bắt buộc"],
      minlength: [6, "Mật khẩu phải có ít nhất 6 ký tự"],
      select: false,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    onboarded: {
      type: Boolean,
      default: false,
    },
    profile: profileSchema, // gắn thông tin mục tiêu & sức khoẻ đã tổng hợp
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
