import mongoose from "mongoose";
const { Schema } = mongoose;

const FoodSchema = new Schema(
  {
    /* Thông tin món */
    name: { type: String, required: true, trim: true },
    imageUrl: { type: String, trim: true },
    portionName: { type: String, trim: true }, // “1 chén”, “1 miếng”, ...
    massG: { type: Number, required: true, min: 0 }, // khối lượng chuẩn
    unit: { type: String, enum: ["g", "ml"], default: "g" },

    /* Dinh dưỡng (nullable → hiển thị “-”) */
    kcal: Number,
    proteinG: Number,
    carbG: Number,
    fatG: Number,
    saltG: Number,
    sugarG: Number,
    fiberG: Number,

    /* Meta người tạo
       - createdBy: user gửi lên (app người dùng)
       - createdByAdmin: admin tạo trực tiếp (admin-app)
    */
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdByAdmin: { type: Schema.Types.ObjectId, ref: "Admin" },

    /* Duyệt */
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    approvedAt: { type: Date },
    rejectionReason: { type: String, trim: true, maxlength: 500 },

    /* Nguồn */
    sourceType: {
      type: String,
      enum: ["fresh", "packaged", "cooked", "user_submitted", "other"],
      default: "other",
    },

    /* Yêu thích đơn giản */
    likedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],

    /* Theo dõi xem gần đây cho từng user */
    views: { type: Number, default: 0 },
    viewedBy: [
      {
        user: { type: Schema.Types.ObjectId, ref: "User" },
        lastViewedAt: { type: Date, default: Date.now },
        count: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

/* Text index để tìm theo tên/khẩu phần */
FoodSchema.index({ name: "text", portionName: "text" });

/* Index hỗ trợ các màn admin & truy vấn thường gặp */
FoodSchema.index({ status: 1, updatedAt: -1 });
FoodSchema.index({ "viewedBy.user": 1 });

export default mongoose.model("Food", FoodSchema);
