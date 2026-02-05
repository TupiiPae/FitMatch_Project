// server/src/models/PremiumPlan.js
import mongoose from "mongoose";
const { Schema } = mongoose;

export const PREMIUM_ALLOWED_MONTHS = [1, 3, 6, 12];

const PremiumPlanSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, index: true, trim: true }, // premium_1m...
    name: { type: String, required: true, trim: true, maxlength: 120 },
    months: { type: Number, required: true, index: true }, // 1/3/6/12
    price: { type: Number, required: true, min: 0 }, // VND

    currency: { type: String, default: "VND", trim: true, maxlength: 10 },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
    features: { type: [String], default: [] },

    isActive: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },

    updatedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true }
);

PremiumPlanSchema.pre("validate", function (next) {
  const m = Number(this.months);
  if (!PREMIUM_ALLOWED_MONTHS.includes(m)) return next(new Error("months chỉ nhận 1/3/6/12"));

  if (!this.code) this.code = `premium_${m}m`;
  this.code = String(this.code || "").trim();

  if (!this.name) this.name = `Premium ${m} tháng`;
  this.name = String(this.name || "").trim();

  const p = Number(this.price);
  if (!Number.isFinite(p) || p < 0) return next(new Error("price không hợp lệ"));
  this.price = Math.round(p);

  this.currency = String(this.currency || "VND").trim().toUpperCase();
  next();
});

PremiumPlanSchema.statics.ensureDefaults = async function () {
  const Plan = this;
  const existing = await Plan.find({}).select("months code").lean().catch(() => []);
  const monthsSet = new Set((existing || []).map((x) => Number(x.months)));
  const codeSet = new Set((existing || []).map((x) => String(x.code)));

  const defaults = [
    { months: 1, price: 99000, sortOrder: 10 },
    { months: 3, price: 249000, sortOrder: 20 },
    { months: 6, price: 449000, sortOrder: 30 },
    { months: 12, price: 799000, sortOrder: 40 },
  ].map((x) => ({
    code: `premium_${x.months}m`,
    name: `Premium ${x.months} tháng`,
    months: x.months,
    price: x.price,
    currency: "VND",
    description: "",
    features: ["Tăng giới hạn kết nối", "Tăng lượt chat AI", "Ưu tiên hỗ trợ"],
    isActive: true,
    sortOrder: x.sortOrder,
  }));

  const toInsert = defaults.filter((d) => !monthsSet.has(d.months) && !codeSet.has(d.code));
  if (!toInsert.length) return { inserted: 0 };

  await Plan.insertMany(toInsert, { ordered: false }).catch(() => {});
  return { inserted: toInsert.length };
};

export default mongoose.model("PremiumPlan", PremiumPlanSchema);
