// server/src/models/FaqQuestion.js
import mongoose from "mongoose";

const FaqQuestionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    answerHtml: {
      type: String,
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FaqCategory",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
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

// Tìm kiếm text theo tiêu đề + nội dung
FaqQuestionSchema.index({ title: "text", answerHtml: "text" });

export default mongoose.model("FaqQuestion", FaqQuestionSchema);
