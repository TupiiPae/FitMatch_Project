import mongoose from "mongoose";
const { Schema } = mongoose;

/**
 * Tên món cho phép:
 * - Chữ (kể cả tiếng Việt có dấu tổ hợp \p{M})
 * - Khoảng trắng
 * - Các ký tự thông dụng: ( ) - , . & /
 * - Dấu nháy thẳng ' và nháy cong ’
 */
const NAME_REGEX = /^[\p{L}\p{M}\s'’\-.,&()\/]+$/u;

const FoodSchema = new Schema(
  {
    /* Thông tin món */
    name: {
      type: String,
      required: [true, "Vui lòng nhập tên món"],
      trim: true,
      maxlength: [50, "Tên món tối đa 50 ký tự"],
      validate: {
        validator: (v) => NAME_REGEX.test(v),
        message: "Tên món chỉ gồm chữ, dấu tiếng Việt và các ký tự: ( ) - , . & /",
      },
    },
    imageUrl: { type: String, trim: true },
    portionName: { type: String, trim: true }, // “1 chén”, “1 miếng”, ...
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Mô tả tối đa 1000 ký tự"],
    },

    // massG: required, [0..10000]
    massG: {
      type: Number,
      required: [true, "Vui lòng nhập khối lượng (g)"],
      min: [0, "Khối lượng không được âm"],
      max: [10000, "Khối lượng tối đa 10000"],
    },
    unit: { type: String, enum: ["g", "ml"], default: "g" },

    /* Dinh dưỡng (nullable → hiển thị “-”) */
    // kcal: required, [0..10000]
    kcal: {
      type: Number,
      required: [true, "Vui lòng nhập kcal"],
      min: [0, "Kcal không được âm"],
      max: [10000, "Kcal tối đa 10000"],
    },
    // các trường còn lại: optional, [0..10000]
    proteinG: { type: Number, min: [0, "Không được âm"], max: [10000, "Tối đa 10000"] },
    carbG: { type: Number, min: [0, "Không được âm"], max: [10000, "Tối đa 10000"] },
    fatG: { type: Number, min: [0, "Không được âm"], max: [10000, "Tối đa 10000"] },
    saltG: { type: Number, min: [0, "Không được âm"], max: [10000, "Tối đa 10000"] },
    sugarG: { type: Number, min: [0, "Không được âm"], max: [10000, "Tối đa 10000"] },
    fiberG: { type: Number, min: [0, "Không được âm"], max: [10000, "Tối đa 10000"] },

    /* Meta người tạo */
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
      enum: ["fresh", "packaged", "cooked", "user_submitted", "admin_created", "other"],
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
