import mongoose from "mongoose";
const { Schema } = mongoose;

const ConnectReportSchema = new Schema(
  {
    reporter: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },

    targetType: { type: String, enum: ["user", "group"], required: true, index: true },
    targetUser: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    targetRoom: { type: Schema.Types.ObjectId, ref: "MatchRoom", default: null, index: true },

    reasons: [{ type: String, default: [] }],
    otherReason: { type: String, default: "" },
    note: { type: String, default: "" },

    snapshot: { type: Schema.Types.Mixed, default: null },

    status: { type: String, enum: ["pending", "reviewed", "dismissed"], default: "pending", index: true },
    adminNote: { type: String, default: "" },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ConnectReportSchema.index({ reporter: 1, targetType: 1, targetUser: 1, targetRoom: 1, createdAt: -1 });

export default mongoose.model("ConnectReport", ConnectReportSchema);
