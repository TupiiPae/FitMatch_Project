// server/src/models/DailyActivity.js
import mongoose from "mongoose";

const dailyActivitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true }, // "YYYY-MM-DD"
  steps: { type: Number, default: 0 },
  weightKg: { type: Number, default: null },
  workouts: [{
    workout: { type: mongoose.Schema.Types.ObjectId, ref: "WorkoutPlan" },
    name: { type: String, trim: true },
    kcal: { type: Number, default: 0 }
  }]
}, { timestamps: true });

dailyActivitySchema.index({ user: 1, date: 1 }, { unique: true });

const DailyActivity = mongoose.model("DailyActivity", dailyActivitySchema);
export default DailyActivity;
