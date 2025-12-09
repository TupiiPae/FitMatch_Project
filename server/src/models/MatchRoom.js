// server/src/models/MatchRoom.js 
import mongoose from "mongoose";
const { Schema } = mongoose;

const MatchRoomMemberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["owner", "member"],
      default: "member",
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const MatchRoomSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["duo", "group"],
      required: true,
    },
    name: { type: String },
    description: { type: String },
    coverImageUrl: { type: String },

    goalKey: { type: String },
    trainingTypes: [{ type: String }],

    scheduleText: { type: String },

    locationLabel: { type: String, trim: true }, // 👈 thêm

    members: {
      type: [MatchRoomMemberSchema],
      default: [],
    },

    maxMembers: {
      type: Number,
      default: function () {
        return this.type === "duo" ? 2 : 5;
      },
    },

    status: {
      type: String,
      enum: ["active", "full", "closed"],
      default: "active",
    },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    closedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

MatchRoomSchema.index({ "members.user": 1, status: 1 });

const MatchRoom = mongoose.model("MatchRoom", MatchRoomSchema);
export default MatchRoom;
