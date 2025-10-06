import mongoose from "mongoose";

// ====== Schema con: lưu thông tin cá nhân và mục tiêu của người dùng ======
const profileSchema = new mongoose.Schema(
  {
    nickname: {
      type: String,
      trim: true,
      maxlength: [30, "Nickname không được vượt quá 30 ký tự"],
    },
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
    weightKg: {
      type: Number,
      min: [20, "Cân nặng tối thiểu là 20 kg"],
      max: [300, "Cân nặng tối đa là 300 kg"],
    },
    targetWeightKg: {
      type: Number,
      min: [20, "Cân nặng mục tiêu tối thiểu là 20 kg"],
      max: [300, "Cân nặng mục tiêu tối đa là 300 kg"],
    },
    weeklyChangeKg: {
      type: Number, // ± giá trị tuỳ theo mục tiêu tăng/giảm
      default: 0,
    },
    trainingIntensity: {
      type: String, // người dùng chọn 1 trong 4 mức
      trim: true,
      default: "",
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
      select: false, // không tự động trả password trong truy vấn
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    onboarded: {
      type: Boolean,
      default: false, // true nếu người dùng đã nhập thông tin ban đầu
    },
    profile: profileSchema, // gắn thông tin mục tiêu, số liệu ở đây
  },
  { timestamps: true }
);

// ====== Model ======
export const User = mongoose.model("User", userSchema);
