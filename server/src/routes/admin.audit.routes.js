// server/src/routes/admin.audit.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { requireAtLeast } from "../middleware/requireAdminLevel.js";
import {
  listAuditLogs,
  listAuditLogsForResource,
  deleteAuditLog,
  deleteManyAuditLogs,
} from "../controllers/admin.audit.controller.js";


const r = Router();

// Chỉ Admin LV2 trở lên xem được nhật ký
r.use(auth, requireAtLeast("admin_lv2"));

r.get("/audit-logs", listAuditLogs);
r.get("/audit-logs/resource/:id", listAuditLogsForResource);
r.delete("/audit-logs/:id", deleteAuditLog);      // xóa 1
r.delete("/audit-logs", deleteManyAuditLogs);     // xóa nhiều

export default r;
