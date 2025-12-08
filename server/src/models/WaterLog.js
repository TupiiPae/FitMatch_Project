import mongoose from "mongoose";
const { Schema } = mongoose;

const WaterLogSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref:"User", required:true },
  date: { type:String, required:true }, // YYYY-MM-DD
  amountMl: { type:Number, default: 0, min: 0, max: 10000 }
}, { timestamps:true });

WaterLogSchema.index({ user:1, date:1 }, { unique:true });

export default mongoose.models.WaterLog || mongoose.model("WaterLog", WaterLogSchema);
