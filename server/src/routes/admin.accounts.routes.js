import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  listAdminAccounts,
  createAdminAccount,
  updateAdminAccount,
  deleteAdminAccount,
  blockAdminAccount,
  unblockAdminAccount,
} from "../controllers/admin.accounts.controller.js";

const r = Router();

// chỉ Admin cấp 1
r.use(auth, requireRole("admin_lv1"));

r.get("/", listAdminAccounts);
r.post("/", createAdminAccount);
r.patch("/:id", updateAdminAccount);
r.delete("/:id", deleteAdminAccount);
r.post("/:id/block", blockAdminAccount);
r.post("/:id/unblock", unblockAdminAccount);

export default r;
