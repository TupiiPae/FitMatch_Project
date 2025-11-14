// server/src/models/SuggestPlan.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const ExerciseInSessionSchema = new Schema(
  {
    exercise: {
      type: Schema.Types.ObjectId,
      ref: "Exercise",
      required: true,
    },
    reps: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100, // vd: "4 hiệp x 12 lần"
    },
  },
  { _id: false }
);

const SessionSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    exercises: {
      type: [ExerciseInSessionSchema],
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: "Mỗi buổi tập cần ít nhất 1 bài tập",
      },
    },
  },
  { _id: false }
);

const SuggestPlanSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    descriptionHtml: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    sessions: {
      type: [SessionSchema],
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: "Lịch tập cần có ít nhất 1 buổi tập",
      },
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    sourceType: {
      type: String,
      enum: ["admin_suggested"],
      default: "admin_suggested",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

SuggestPlanSchema.index({ name: 1 });

export default mongoose.model("SuggestPlan", SuggestPlanSchema);
