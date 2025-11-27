// server/src/utils/auditLog.js
import AuditLog from "../models/AuditLog.js";
import { Admin } from "../models/Admin.js";

const TYPE_LABEL_MAP = {
  food: "Món ăn",
  suggestMenu: "Thực đơn gợi ý",
  exercise: "Bài tập",
  suggestPlan: "Lịch tập gợi ý",
};

const ADMIN_CTX_SYMBOL = Symbol("auditAdminCtx");

/**
 * Lấy thông tin admin từ req (tương thích cả adminAuth & auth + requireAtLeast)
 */
async function getAdminContext(req) {
  if (req[ADMIN_CTX_SYMBOL]) return req[ADMIN_CTX_SYMBOL];

  const id = req.adminId || req.userId || null;
  if (!id) {
    req[ADMIN_CTX_SYMBOL] = {};
    return req[ADMIN_CTX_SYMBOL];
  }

  try {
    const ad = await Admin.findById(id)
      .select("username nickname level")
      .lean();

    if (!ad) {
      req[ADMIN_CTX_SYMBOL] = { adminId: id };
    } else {
      req[ADMIN_CTX_SYMBOL] = {
        adminId: ad._id,
        adminUsername: ad.username,
        adminNickname: ad.nickname,
        adminLevel: ad.level,
      };
    }
  } catch (e) {
    console.error("[auditLog.getAdminContext]", e?.message || e);
    req[ADMIN_CTX_SYMBOL] = { adminId: id };
  }

  return req[ADMIN_CTX_SYMBOL];
}

/**
 * Ghi 1 bản ghi audit log
 *
 * @param {Request} req - Express request (đã qua auth admin)
 * @param {Object} payload
 *   - resourceType: "food" | "suggestMenu" | "exercise" | "suggestPlan"
 *   - resourceId: ObjectId | string
 *   - resourceName: string
 *   - action: "create" | "update" | "delete" | "approve" | "reject"
 *   - meta?: object
 */
export async function logAdminAction(req, payload) {
  try {
    if (!payload || !payload.resourceType || !payload.resourceId || !payload.action) {
      return;
    }

    const { resourceType, resourceId, resourceName, action, meta } = payload;

    const adminCtx = await getAdminContext(req);
    const categoryLabel = TYPE_LABEL_MAP[resourceType] || resourceType;

    await AuditLog.create({
      resourceType,
      resourceId,
      categoryLabel,
      resourceName: resourceName || "",
      action,
      adminId: adminCtx.adminId,
      adminUsername: adminCtx.adminUsername,
      adminNickname: adminCtx.adminNickname,
      adminLevel: adminCtx.adminLevel,
      meta: meta || {},
    });
  } catch (err) {
    // Không để lỗi log ảnh hưởng request chính
    console.error("[AuditLog.write]", err?.message || err);
  }
}
