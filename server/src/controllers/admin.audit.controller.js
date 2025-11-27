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
