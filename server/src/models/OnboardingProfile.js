import mongoose from "mongoose";

const OnboardingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },

    // dữ liệu người dùng nhập lần đầu
    tenGoi: { type: String, trim: true, maxlength: 30 },
    mucTieu: { type: String, enum: ["giam_can", "duy_tri", "tang_can", "giam_mo", "tang_co"], required: true },
    chieuCao: { type: Number, min: 100, max: 220, required: true },
    canNangHienTai: { type: Number, min: 20, max: 300, required: true },
    canNangMongMuon: { type: Number, min: 20, max: 300, required: true },
    mucTieuTuan: { type: Number, default: 0 }, // âm: giảm, dương: tăng
    cuongDoLuyenTap: { type: String, trim: true, default: "" }, // để linh hoạt 4 mức bạn đang dùng

    // bổ sung để tính BMR
    gioiTinh: { type: String, enum: ["male", "female"], required: true },
    ngaySinh: { type: String, required: true }, // YYYY-MM-DD

    // hệ thống tính
    bmi: { type: Number },
    bmr: { type: Number },

    // cờ trạng thái
    hoanTatOnboarding: { type: Boolean, default: true },
    phienBan: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const Onboarding = mongoose.model("Onboarding", OnboardingSchema);
