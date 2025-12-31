import mongoose from "mongoose";

const { Schema } = mongoose;

const AiMessageSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
      index: true,
    },

    text: { type: String, default: "" },

    imageUrls: { type: [String], default: [] },

    // store extra structured info (suggestions, detected food name, etc.)
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

AiMessageSchema.index({ user: 1, createdAt: -1 });

export default mongoose.models.AiMessage || mongoose.model("AiMessage", AiMessageSchema);
