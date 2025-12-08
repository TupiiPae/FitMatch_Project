// server/src/models/OnboardingProfile.js
import mongoose from "mongoose";
const { Schema } = mongoose;

/** Khối “base” – snapshot gốc (immutable sau finalize) */
const BaseBlockSchema = new Schema({
  tenGoi: { type: String, trim: true, maxlength: 30 },
  gioiTinh: { type: String, enum: ["male", "female"] },
  ngaySinh: {
    type: String,
    validate: {
      validator: (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
      message: "Ngày sinh phải theo định dạng YYYY-MM-DD",
    },
  },
  chieuCao: { type: Number, min: 100, max: 220 },
  canNangHienTai: { type: Number, min: 30, max: 200 },
  canNangMongMuon: { type: Number, min: 20, max: 300 },
  mucTieuTuan: { type: Number, min: 0.1, max: 1 },
  mucTieu: {
    type: String,
    enum: ["giam_can", "duy_tri", "tang_can", "giam_mo", "tang_co"],
  },
  cuongDoLuyenTap: { type: String, trim: true, default: "" }, // level_1..4
  bodyFat: { type: Number, min: 0, max: 70 },

  // derived
  bmi: Number,
  bmr: Number,
  tdee: Number,
  calorieTarget: Number,

  hoanTatOnboarding: { type: Boolean, default: true },
  finalizedAt: { type: Date },
}, { _id: false });

/** Mỗi lần “Thiết lập mục tiêu mới” */
const GoalSnapshotSchema = new Schema({
  seq: Number,         // 1,2,3...
  label: String,       // "Goal1"
  chieuCao: { type: Number, min: 100, max: 220 },
  canNangHienTai: { type: Number, min: 30, max: 200 },
  canNangMongMuon: { type: Number, min: 20, max: 300 },
  mucTieuTuan: { type: Number, min: 0.1, max: 1 },
  mucTieu: {
    type: String,
    enum: ["giam_can", "duy_tri", "tang_can", "giam_mo", "tang_co"],
  },
  cuongDoLuyenTap: { type: String, trim: true, default: "" }, // level_1..4
  bodyFat: { type: Number, min: 0, max: 70 },

  // derived
  bmi: Number,
  bmr: Number,
  tdee: Number,
  calorieTarget: Number,

  // estimation
  estimatedWeeks: Number,
  startedAt: Date,
  estimatedFinishAt: Date,

  status: { type: String, enum: ["active", "archived"], default: "active" },
}, { _id: false, timestamps: true });

const OnboardingProfileSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
    index: true,
  },

  // Hiển thị ổn định theo yêu cầu
  usernameCache: { type: String },
  userIdCache: { type: String },

  // Snapshot gốc
  base: BaseBlockSchema,

  // Các goal về sau
  goals: [GoalSnapshotSchema],

  // Giữ lại version cũ nếu cần
  phienBan: { type: Number, default: 2 },
}, {
  timestamps: true,
  collection: "onboardings",
});

export const OnboardingProfile = mongoose.model("OnboardingProfile", OnboardingProfileSchema);
