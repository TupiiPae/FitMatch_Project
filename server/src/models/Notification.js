import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    type: { type: String, required: true, index: true }, // ex: "match_request", "match_accepted", "message", ...
    title: { type: String, default: "" },
    body: { type: String, default: "" },

    // payload để FE biết điều hướng tới đâu
    data: { type: Object, default: {} },

    readAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ to: 1, readAt: 1, createdAt: -1 });

export default mongoose.model("Notification", NotificationSchema);
