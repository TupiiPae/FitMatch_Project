import mongoose from "mongoose";
const { Schema } = mongoose;

const NutritionLogSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref:"User", required:true },
  food: { type: Schema.Types.ObjectId, ref:"Food", required:true },
  date: { type:String, required:true }, // YYYY-MM-DD
  hour: { type:Number, min:0, max:23, required:true },
  quantity: { type:Number, min:0, default:1 },
  massG: { type:Number }, // override khối lượng chuẩn nếu người dùng chỉnh
}, { timestamps:true });

NutritionLogSchema.index({ user:1, date:1 });

export default mongoose.model("NutritionLog", NutritionLogSchema);
