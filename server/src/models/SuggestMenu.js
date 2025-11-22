// server/src/models/SuggestMenu.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const MenuItemSchema = new Schema(
  {
    food: { type: Schema.Types.ObjectId, ref: "Food", required: true },
    foodName: { type: String },
    kcal: { type: Number, default: 0 },
    proteinG: { type: Number, default: 0 },
    carbG: { type: Number, default: 0 },
    fatG: { type: Number, default: 0 },
  },
  { _id: false }
);

const MealSchema = new Schema(
  {
    title: { type: String, default: "" }, // VD: "Bữa 1" (FE tự đặt)
    items: { type: [MenuItemSchema], default: [] },
  },
  { _id: false }
);

const DaySchema = new Schema(
  {
    title: { type: String, default: "" }, // VD: "Ngày 1"
    meals: { type: [MealSchema], default: [] },
  },
  { _id: false }
);

const SuggestMenuSchema = new Schema(
  {
    imageUrl: { type: String, required: true },
    name: { type: String, required: true, maxlength: 100 },
    descriptionHtml: { type: String, default: "" }, // cho phép rich text
    category: {
      type: String,
      enum: ["Cân bằng", "Ít tinh bột - Tăng đạm"],
      required: true,
    },
    numDays: { type: Number, required: true, min: 1, max: 7 },

    days: { type: [DaySchema], default: [] },

    // Tổng macro cho toàn bộ thực đơn
    totalKcal: { type: Number, default: 0 },
    totalProteinG: { type: Number, default: 0 },
    totalCarbG: { type: Number, default: 0 },
    totalFatG: { type: Number, default: 0 },
    savedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

SuggestMenuSchema.index({ name: "text", category: "text" });

const SuggestMenu = mongoose.model("SuggestMenu", SuggestMenuSchema);
export default SuggestMenu;
