import mongoose from "mongoose";

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
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
