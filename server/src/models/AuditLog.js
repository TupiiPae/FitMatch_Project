// server/src/models/AuditLog.js
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    // "food" | "suggestMenu" | "exercise" | "suggestPlan"
    resourceType: {
      type: String,
      enum: ["food", "suggestMenu", "exercise", "suggestPlan"],
      required: true,
    },
    // _id của bản ghi (Food / SuggestMenu / Exercise / SuggestPlan)
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    // Nhãn danh mục để hiển thị (Món ăn / Thực đơn gợi ý / ...)
    categoryLabel: {
      type: String,
      required: true,
    },
    // Tên dữ liệu tại thời điểm ghi log (snapshot)
    resourceName: {
      type: String,
      default: "",
    },
    // create | update | delete | approve | reject
    action: {
      type: String,
      enum: ["create", "update", "delete", "approve", "reject"],
      required: true,
    },

    // Thông tin admin
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
    adminUsername: String,
    adminNickname: String,
    adminLevel: Number, // 1 / 2

    // Metadata phụ (vd: exerciseType, lý do reject, v.v.)
    meta: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Các index để query nhanh
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
auditLogSchema.index({ adminId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export default mongoose.model("AuditLog", auditLogSchema);
