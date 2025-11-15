// server/src/models/SuggestPlan.js
import mongoose from "mongoose";

const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

const SuggestPlanExerciseSchema = new Schema(
  {
    exercise: { type: ObjectId, ref: "Exercise", required: true },
    reps: { type: String, required: true, trim: true, maxlength: 100 },
  },
  { _id: false }
);

const SuggestPlanSessionSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },
    exercises: {
      type: [SuggestPlanExerciseSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "Mỗi buổi tập cần ít nhất 1 bài tập",
      },
    },
  },
  { _id: true }
);

const SuggestPlanSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    descriptionHtml: { type: String, required: true },
    imageUrl: { type: String, required: true },
    sessions: {
      type: [SuggestPlanSessionSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "Lịch tập phải có ít nhất 1 buổi tập",
      },
    },
    createdByAdmin: { type: ObjectId, ref: "Admin" },
  },
  { timestamps: true }
);

SuggestPlanSchema.virtual("sessionsCount").get(function () {
  return Array.isArray(this.sessions) ? this.sessions.length : 0;
});

SuggestPlanSchema.virtual("exercisesCount").get(function () {
  return (this.sessions || []).reduce(
    (acc, s) => acc + ((s.exercises || []).length || 0),
    0
  );
});

export const SuggestPlan =
  mongoose.models.SuggestPlan || mongoose.model("SuggestPlan", SuggestPlanSchema);

export default SuggestPlan;
