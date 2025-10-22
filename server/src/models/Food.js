import mongoose from "mongoose";
const { Schema } = mongoose;

const FoodSchema = new Schema({
  name: { type:String, required:true, trim:true },
  imageUrl: String,
  portionName: String,           // “1 chén”, “1 miếng”, ...
  massG: { type:Number, required:true, min:0 }, // khối lượng chuẩn
  unit: { type:String, enum:["g","ml"], default:"g" },

  // dinh dưỡng (nullable → hiển thị “-”)
  kcal: Number,
  proteinG: Number,
  carbG: Number,
  fatG: Number,
  saltG: Number,
  sugarG: Number,
  fiberG: Number,

  // meta
  createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  status: { type:String, enum:["pending","approved","rejected"], default:"approved" },
  sourceType: { type:String, enum:["fresh","packaged","cooked","user_submitted","other"], default:"other" },

  likedBy: [{ type: Schema.Types.ObjectId, ref: "User" }], // đơn giản hóa “yêu thích”

  // theo dõi xem gần đây
  views: { type:Number, default:0 },
  viewedBy: [{
    user: { type: Schema.Types.ObjectId, ref:"User" },
    lastViewedAt: { type: Date, default: Date.now },
    count: { type:Number, default:0 }
  }]
}, { timestamps:true });

FoodSchema.index({ name: "text" });

export default mongoose.model("Food", FoodSchema);
