// server/src/models/RegisterOtp.js
import mongoose from "mongoose";

const registerOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      index: true,
      required: true,
      lowercase: true,
      trim: true,
    },
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    used: { type: Boolean, default: false, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

registerOtpSchema.index({ email: 1, used: 1 });
registerOtpSchema.index({ createdAt: -1 });

const RegisterOtp =
  mongoose.models.RegisterOtp || mongoose.model("RegisterOtp", registerOtpSchema);

export { RegisterOtp };
export default RegisterOtp;
