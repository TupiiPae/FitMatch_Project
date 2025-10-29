import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth.js";
import {
  adminLogin,
  adminMe,
  updateAdminMe,
  changeAdminPassword,
} from "../controllers/admin.auth.controller.js";

const r = Router();

// Mount ở /api/admin/auth  => path bên trong KHÔNG có tiền tố /auth
r.post("/login", adminLogin);
r.get("/me", adminAuth, adminMe);
r.patch("/me", adminAuth, updateAdminMe);              // đổi nickname (lv2)
r.post("/change-password", adminAuth, changeAdminPassword); // đổi mật khẩu (lv2)

export default r;
