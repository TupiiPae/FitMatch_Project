// server/src/models/WorkoutPlan.js
import mongoose from "mongoose";

const SetSchema = new mongoose.Schema({
  kg: { type: Number, min: 0, default: 0 },
  reps: { type: Number, min: 0, default: 0 },
  restSec: { type: Number, min: 0, default: 0 },
}, { _id: false });

const ItemSchema = new mongoose.Schema({
  exercise: { type: mongoose.Schema.Types.ObjectId, ref: "Exercise", required: true },
  // snapshot để tránh tên bài tập thay đổi làm sai plan cũ
  exerciseName: { type: String, required: true },
  type: { type: String, enum: ["Strength","Cardio"], required: true },
  sets: { type: [SetSchema], default: [{ kg: 0, reps: 0, restSec: 0 }] },
}, { _id: false });

const WorkoutPlanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, maxlength: 100, trim: true },

  items: { type: [ItemSchema], default: [] },

  totals: {
    exercises: { type: Number, default: 0 },
    sets: { type: Number, default: 0 },
    reps: { type: Number, default: 0 },
  },

  // “gợi ý đã lưu”
  savedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }],

  status: { type: String, enum: ["active","archived"], default: "active", index: true },
}, { timestamps: true });

WorkoutPlanSchema.methods.recalcTotals = function () {
  const exercises = this.items.length;
  const sets = this.items.reduce((s, it) => s + (it.sets?.length || 0), 0);
  const reps = this.items.reduce((s, it) => s + (it.sets || []).reduce((x, st) => x + (st.reps || 0), 0), 0);
  this.totals = { exercises, sets, reps };
};

export default mongoose.model("WorkoutPlan", WorkoutPlanSchema);
