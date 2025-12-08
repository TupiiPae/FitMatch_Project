// server/src/models/Exercise.js
import mongoose from "mongoose";

export const EXERCISE_TYPES = ["Strength", "Cardio", "Sport"];
export const MUSCLE_GROUPS = [
  "Ngực","Lưng","Vai","Bụng","Hông","Đùi trước","Đùi sau","Mông",
  "Bắp chân","Tay trước","Tay sau","Cẳng tay","Cổ","Toàn thân","Core"
];
export const EQUIPMENTS = [
  "Không có","Tạ đòn","Tạ đơn","Dây cáp", "Máy","Banh","Dây kháng lực","Kettlebell","BOSU","TRX"
];
export const LEVELS = ["Cơ bản","Trung bình","Nâng cao"];

// Cho phép chữ có dấu, khoảng trắng, số, () - . , & / ’ '
const NAME_REGEX = /^[\p{L}\p{M}\s0-9'’\-.,&()\/]+$/u;

const ExerciseSchema = new mongoose.Schema(
  {
    // Lưu URL ảnh hiển thị (kể cả khi upload file, controller sẽ gán đường dẫn /uploads/exercises/...)
    imageUrl: { type: String, required: [true, "Vui lòng chọn ảnh bài tập"] },
    // Tùy chọn: URL video (cũng có thể là /uploads/exercises_videos/...)
    videoUrl: { type: String, default: "" },

    name: {
      type: String,
      required: [true, "Vui lòng nhập tên bài tập"],
      maxlength: [100, "Tên tối đa 100 ký tự"],
      validate: {
        validator: (v) => NAME_REGEX.test(v || ""),
        message:
          "Tên chỉ cho phép chữ (có dấu), số, khoảng trắng và các ký tự: ( ) - , . & / ’ '",
      },
      trim: true,
    },

    type: {
      type: String,
      enum: EXERCISE_TYPES,
      default: "Strength",
      index: true,
    },

    primaryMuscles: {
      type: [String],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "Vui lòng chọn ít nhất 1 nhóm cơ chính",
      },
    },
    secondaryMuscles: { type: [String], default: [] },

    equipment: { type: String, enum: EQUIPMENTS, required: true, index: true },
    level: { type: String, enum: LEVELS, required: true, index: true },

    caloriePerRep: {
      type: Number,
      min: [0, "Giá trị phải ≥ 0"],
      max: [9999999999, "Quá lớn"],
      required: true,
    },

    // Nội dung rich text/HTML (FE có thể render)
    guideHtml: { type: String, default: "" },
    descriptionHtml: { type: String, default: "" },

    createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    status: { type: String, enum: ["active", "archived"], default: "active", index: true },
  },
  { timestamps: true }
);
ExerciseSchema.index({ name: "text" });

// Tìm kiếm theo tên (đã set index text trên name)
const Exercise = mongoose.model("Exercise", ExerciseSchema);
export default Exercise;
