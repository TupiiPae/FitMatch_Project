// server/src/models/MatchRoom.js
import mongoose from "mongoose";
const { Schema } = mongoose;

const AGE_RANGE_ENUM = ["all", "18-21", "22-27", "28-35", "36-45", "45+"];
const GENDER_ENUM = ["all", "male", "female"];
const FREQ_ENUM = ["1-2", "2-3", "3-5", "5+"]; // map ra label ở FE/BE tuỳ bạn
const JOIN_POLICY_ENUM = ["request", "open"]; // request = cần gửi lời mời, open = vào thẳng

const MatchRoomMemberSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "member"], default: "member" },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const MatchRoomSchema = new Schema(
  {
    type: { type: String, enum: ["duo", "group"], required: true },

    // ===== Group fields =====
    name: {
      type: String,
      trim: true,
      maxlength: 50,
      required: function () { return this.type === "group"; },
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
      required: function () { return this.type === "group"; },
    },
    coverImageUrl: {
      type: String,
      trim: true,
      required: function () { return this.type === "group"; },
    },

    // dùng làm filter hiển thị nhóm
    ageRange: {
      type: String,
      enum: AGE_RANGE_ENUM,
      required: function () { return this.type === "group"; },
    },
    gender: {
      type: String,
      enum: GENDER_ENUM,
      required: function () { return this.type === "group"; },
    },
    trainingFrequency: {
      type: String,
      enum: FREQ_ENUM,
      required: function () { return this.type === "group"; },
    },

    // toggle: request/open
    joinPolicy: {
      type: String,
      enum: JOIN_POLICY_ENUM,
      default: "request",
      required: function () { return this.type === "group"; },
    },

    // hiển thị vị trí nhóm (lấy từ user tạo nhóm)
    locationLabel: {
      type: String,
      trim: true,
      required: function () { return this.type === "group"; },
    },

    // mục tiêu nhóm (lấy từ user tạo nhóm)
    goalKey: { type: String, trim: true },
    goalLabel: { type: String, trim: true },

    members: { type: [MatchRoomMemberSchema], default: [] },

    maxMembers: {
      type: Number,
      default: function () { return this.type === "duo" ? 2 : 5; },
      enum: [2, 3, 4, 5],
    },

    status: { type: String, enum: ["active", "full", "closed"], default: "active" },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    closedAt: { type: Date },
  },
  { timestamps: true }
);

MatchRoomSchema.index({ "members.user": 1, status: 1 });
MatchRoomSchema.index({ type: 1, status: 1 });

const MatchRoom = mongoose.model("MatchRoom", MatchRoomSchema);
export default MatchRoom;
