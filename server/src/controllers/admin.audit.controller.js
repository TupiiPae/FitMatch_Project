// server/src/controllers/admin.audit.controller.js
import AuditLog from "../models/AuditLog.js";
import { responseOk } from "../utils/response.js";

// GET /api/admin/audit-logs
export async function listAuditLogs(req, res, next) {
  try {
    const {
      resourceType,      // optional: "food" | "suggestMenu" | "exercise" | "suggestPlan"
      action,            // optional: "create" | "update" | ...
      adminUsername,     // optional: search theo username
      limit = 50,
      skip = 0,
    } = req.query;

    const filter = {};
    if (resourceType) filter.resourceType = resourceType;
    if (action) filter.action = action;
    if (adminUsername && String(adminUsername).trim()) {
      filter.adminUsername = new RegExp(
        String(adminUsername).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
    }

    const lim = Math.min(Math.max(Number(limit) || 20, 1), 200);
    const skp = Math.max(Number(skip) || 0, 0);

    const [total, items] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skp)
        .limit(lim)
        .lean(),
    ]);

    return res.json(responseOk({ items, total, limit: lim, skip: skp }));
  } catch (err) {
    return next(err);
  }
}

// GET /api/admin/audit-logs/resource/:id
export async function listAuditLogsForResource(req, res, next) {
  try {
    const { id } = req.params;
    const items = await AuditLog.find({ resourceId: id })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(responseOk({ items }));
  } catch (err) {
    return next(err);
  }
}

// DELETE /api/admin/audit-logs/:id  (xóa 1 bản ghi)
export async function deleteAuditLog(req, res, next) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: "Thiếu ID log" });
    }

    const doc = await AuditLog.findByIdAndDelete(id);
    if (!doc) {
      return res
        .status(404)
        .json(responseOk({ deleted: 0, message: "Không tìm thấy bản ghi" }));
    }

    return res.json(responseOk({ deleted: 1 }));
  } catch (err) {
    return next(err);
  }
}

// DELETE /api/admin/audit-logs  (xóa nhiều)
export async function deleteManyAuditLogs(req, res, next) {
  try {
    const { ids } = req.body || {};
    const arr = Array.isArray(ids) ? ids.filter(Boolean) : [];

    if (!arr.length) {
      return res
        .status(400)
        .json({ success: false, message: "Danh sách ID trống" });
    }

    const r = await AuditLog.deleteMany({ _id: { $in: arr } });
    return res.json(responseOk({ deleted: r.deletedCount || 0 }));
  } catch (err) {
    return next(err);
  }
}
