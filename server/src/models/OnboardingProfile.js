import mongoose from "mongoose";

const onboardingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    tenGoi: { type: String, trim: true, maxlength: 30 },
    mucTieu: {
      type: String,
      enum: ["giam_can", "duy_tri", "tang_can", "giam_mo", "tang_co"],
      required: true,
    },
    chieuCao: { type: Number, min: 100, max: 220, required: true },

    // cập nhật: 30..200
    canNangHienTai: { type: Number, min: 30, max: 200, required: true },

    canNangMongMuon: { type: Number, min: 20, max: 300, required: true },

    // cập nhật: dương 0.1..1
    mucTieuTuan: { type: Number, min: 0.1, max: 1, required: true },

    // linh hoạt hoặc enum level_1..4
    cuongDoLuyenTap: { type: String, trim: true, default: "" },

    gioiTinh: { type: String, enum: ["male", "female"], required: true },
    ngaySinh: {
      type: String,
      required: true, // YYYY-MM-DD
      validate: {
        validator: (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v),
        message: "Ngày sinh phải theo định dạng YYYY-MM-DD",
      },
    },

    // snapshot các chỉ số tính toán
    bmi: { type: Number },
    bmr: { type: Number },
    tdee: { type: Number },

    hoanTatOnboarding: { type: Boolean, default: true },
    phienBan: { type: Number, default: 1 },
  },
  {
    timestamps: true,
    collection: "onboardings", // quan trọng: đúng tên collection
  }
);

// 👉 Named export đúng với import trong controller
export const OnboardingProfile = mongoose.model("OnboardingProfile", onboardingSchema);
