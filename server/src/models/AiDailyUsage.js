// server/src/models/AiDailyUsage.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const AiDailyUsageSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dateKey: { type: String, required: true, index: true }, // YYYY-MM-DD (VN)
    used: { type: Number, default: 0 },
    startAt: { type: Date, required: true }, // start day in UTC
    endAt: { type: Date, required: true },   // end day in UTC
  },
  { timestamps: true }
);

// 1 user chỉ có 1 record/ngày
AiDailyUsageSchema.index({ user: 1, dateKey: 1 }, { unique: true });

export default mongoose.model("AiDailyUsage", AiDailyUsageSchema);
