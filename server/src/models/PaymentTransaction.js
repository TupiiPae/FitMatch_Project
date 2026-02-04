import mongoose from "mongoose";
const { Schema } = mongoose;

const PaymentTransactionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },

    orderCode: { type: Number, required: true, unique: true, index: true },
    amount: { type: Number, required: true },

    planCode: { type: String, required: true }, // premium_1m | premium_3m | ...
    months: { type: Number, required: true },

    paymentLinkId: { type: String },
    checkoutUrl: { type: String },
    qrCode: { type: String },

    status: {
      type: String,
      enum: ["PENDING", "PAID", "CANCELLED"],
      default: "PENDING",
      index: true,
    },

    paidAt: { type: Date },
    webhookData: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export default mongoose.model("PaymentTransaction", PaymentTransactionSchema);
