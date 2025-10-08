import mongoose from "mongoose";

const OnboardingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },

    tenGoi: { type: String, trim: true, maxlength: 30 },
    mucTieu: { type: String, enum: ["giam_can", "duy_tri", "tang_can", "giam_mo", "tang_co"], required: true },
    chieuCao: { type: Number, min: 100, max: 220, required: true },

    // cập nhật: 30..200
    canNangHienTai: { type: Number, min: 30, max: 200, required: true },

    canNangMongMuon: { type: Number, min: 20, max: 300, required: true },

    // cập nhật: dương 0.1..1
    mucTieuTuan: { type: Number, min: 0.1, max: 1, required: true },

    // giữ linh hoạt/hoặc enum level_1..4 nếu bạn đã chuyển
    cuongDoLuyenTap: { type: String, trim: true, default: "" },

    gioiTinh: { type: String, enum: ["male", "female"], required: true },
    ngaySinh: { type: String, required: true }, // YYYY-MM-DD

    bmi: { type: Number },
    bmr: { type: Number },
    tdee: { type: Number },

    hoanTatOnboarding: { type: Boolean, default: true },
    phienBan: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const Onboarding = mongoose.model("Onboarding", OnboardingSchema);
