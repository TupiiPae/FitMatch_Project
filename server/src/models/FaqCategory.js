// server/src/models/FaqCategory.js
import mongoose from "mongoose";

const FaqCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // (tuỳ chọn) lưu admin tạo / cập nhật
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

// Tìm kiếm text theo tên + mô tả
FaqCategorySchema.index({ name: "text", description: "text" });

export default mongoose.model("FaqCategory", FaqCategorySchema);
