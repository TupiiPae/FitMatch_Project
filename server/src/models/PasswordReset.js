// server/src/models/passwordReset.js
import mongoose from "mongoose";

const passwordResetSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      index: true,
      required: true,
      lowercase: true,
      trim: true,
    },
    // bcrypt hash của OTP
    otpHash: { type: String, required: true },

    // đếm số lần nhập sai
    attempts: { type: Number, default: 0 },

    // đã dùng reset token chưa
    used: { type: Boolean, default: false, index: true },

    // token phiên reset sau khi verify OTP
    resetToken: { type: String, index: true },

    // hạn dùng token phiên reset
    resetTokenExp: { type: Date },

    // TTL: tự hủy document khi tới thời điểm này
    // expires: 0 => hết hạn đúng bằng mốc thời gian trong field
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 15 * 60 * 1000), // 15 phút
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

/* --------- Indexes hữu ích --------- */
// Tìm bản ghi đang mở theo email
passwordResetSchema.index({ email: 1, used: 1 });
// Dọn theo thời gian/ưu tiên mới nhất
passwordResetSchema.index({ createdAt: -1 });

/* --------- Helper (tuỳ chọn) --------- */
// Kiểm tra token reset còn hạn
passwordResetSchema.methods.isResetTokenValid = function () {
  if (!this.resetToken || !this.resetTokenExp) return false;
  return this.resetTokenExp > new Date() && this.used === false;
};

const PasswordReset =
  mongoose.models.PasswordReset ||
  mongoose.model("PasswordReset", passwordResetSchema);

export { PasswordReset };      // named export (tùy bạn thích dùng)
export default PasswordReset;  // default export (giữ tương thích)
