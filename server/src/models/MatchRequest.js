// server/src/models/MatchRequest.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const MatchRequestSchema = new Schema(
  {
    fromUser: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // Duo: gửi cho 1 user khác
    toUser: { type: Schema.Types.ObjectId, ref: "User" },

    // Group: xin tham gia 1 room group
    toRoom: { type: Schema.Types.ObjectId, ref: "MatchRoom" },

    type: {
      type: String,
      enum: ["duo", "group"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled", "expired"],
      default: "pending",
    },

    // Lời nhắn ngắn kèm request (nếu muốn)
    message: { type: String },

    // Snapshot metadata tại thời điểm gửi (giúp hiển thị nhanh, không cần join quá nhiều)
    meta: {
      fromNickname: String,
      fromGoalKey: String,
      fromGoalLabel: String,
    },

    resolvedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

MatchRequestSchema.index({ toUser: 1, status: 1 });
MatchRequestSchema.index({ fromUser: 1, status: 1 });
MatchRequestSchema.index({ toRoom: 1, status: 1 });

const MatchRequest = mongoose.model("MatchRequest", MatchRequestSchema);
export default MatchRequest;
