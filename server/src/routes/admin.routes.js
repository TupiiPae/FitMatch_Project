import { Router } from "express";
import bcrypt from "bcryptjs";
import { Admin } from "../models/Admin.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { requireAdminLevel } from "../middleware/requireAdminLevel.js";
import { generateToken } from "../utils/tokens.js";

const router = Router();

/* ===== AUTH (Admin) ===== */
/**
 * [POST] /api/admin/auth/login
 * Body: { username, password }
 * Đăng nhập chỉ bằng username + password (không dùng email)
 */
router.post("/auth/login", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (!username || !password) {
      return res.status(400).json({ message: "Thiếu username hoặc password" });
    }

    const admin = await Admin.findOne({ username }).select("+password");
    if (!admin) return res.status(400).json({ message: "Tài khoản không tồn tại" });
    if (admin.status === "blocked") return res.status(403).json({ message: "Tài khoản đã bị chặn" });

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.status(401).json({ message: "Sai mật khẩu" });

    // Token có role='admin' & level để FE phân quyền
    const token = generateToken({
      id: admin._id,
      username: admin.username,
      role: "admin",
      level: admin.level,
    });

    return res.json({
      token,
      user: {
        id: admin._id,
        username: admin.username,
        role: "admin",
        level: admin.level, // 1|2
        status: admin.status,
      },
    });
  } catch (e) {
    console.error("[admin.auth.login]", e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

/**
 * [GET] /api/admin/auth/me
 * → xác thực token; trả info admin hiện tại
 */
router.get("/auth/me", adminAuth, async (req, res) => {
  const admin = await Admin.findById(req.adminId).select("_id username level status");
  if (!admin) return res.status(404).json({ message: "Không tìm thấy admin" });
  res.json({
    id: admin._id,
    username: admin.username,
    role: "admin",
    level: admin.level,
    status: admin.status,
  });
});

/* ===== VÍ DỤ ENDPOINT KHÁC ===== */
router.get("/stats", adminAuth, async (req, res) => {
  // TODO: thay bằng thống kê thật
  res.json({ users: 0, scansToday: 0, mergesToday: 0, nutritionLogUsers: 0 });
});

/** Chỉ ADMIN CẤP 1 thấy menu quản trị admin */
router.get("/admin-accounts", adminAuth, requireAdminLevel(1), async (req, res) => {
  // TODO: liệt kê tài khoản admin
  res.json({ items: [] });
});

export default router;
