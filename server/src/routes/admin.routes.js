// server/src/routes/admin.routes.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import { Admin } from "../models/Admin.js";
import { User } from "../models/User.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { requireAdminLevel } from "../middleware/requireAdminLevel.js";
import { generateToken } from "../utils/tokens.js";

const router = Router();

// Helper: escape regex để tránh ReDoS khi search
const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ============================================================================
 * AUTH (Admin)
 * ========================================================================== */
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

/* ============================================================================
 * VÍ DỤ ENDPOINT THỐNG KÊ (mẫu)
 * ========================================================================== */
router.get("/stats", adminAuth, async (_req, res) => {
  // TODO: thay bằng thống kê thật
  res.json({ users: 0, scansToday: 0, mergesToday: 0, nutritionLogUsers: 0 });
});

/* ============================================================================
 * QUẢN TRỊ TÀI KHOẢN ADMIN (chỉ cấp 1)
 * ========================================================================== */
router.get("/admin-accounts", adminAuth, requireAdminLevel(1), async (_req, res) => {
  // TODO: liệt kê tài khoản admin
  res.json({ items: [] });
});

/* ============================================================================
 * USERS MANAGEMENT (Admin)
 * ========================================================================== */
/**
 * [GET] /api/admin/users
 * Query: q (search), limit, skip
 * Yêu cầu: adminAuth (level 1 hoặc 2 đều được)
 * Trả về: { items, total, limit, skip }
 */
router.get("/users", adminAuth, async (req, res) => {
  try {
    const qRaw = String(req.query?.q ?? "").trim();
    const limit = Math.min(Math.max(Number(req.query?.limit ?? 10) || 10, 1), 100);
    const skip  = Math.max(Number(req.query?.skip ?? 0) || 0, 0);

    // Điều kiện lọc
    const cond = {};
    if (qRaw) {
      const rx = new RegExp(escapeRegex(qRaw), "i");
      cond.$or = [
        { username: rx },
        { email: rx },
        { phone: rx },
        { "profile.nickname": rx },
        { "profile.address.city": rx },
        { "profile.address.district": rx },
        { "profile.address.ward": rx },
      ];
    }

    const [items, total] = await Promise.all([
      User.find(cond)
        .select(
          "_id username email phone blocked createdAt " +
          "profile.nickname profile.sex " +
          "profile.address.country profile.address.city " +
          "profile.address.district profile.address.ward"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(cond),
    ]);

    return res.json({ items, total, limit, skip });
  } catch (e) {
    console.error("[admin.users.list]", e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

/**
 * [POST] /api/admin/users/:id/block
 * Set blocked=true
 */
router.post("/users/:id/block", adminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await User.findByIdAndUpdate(
      id,
      { $set: { blocked: true } },
      { new: true }
    ).select("_id blocked");
    if (!doc) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    return res.json({ success: true, blocked: doc.blocked });
  } catch (e) {
    console.error("[admin.users.block]", e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

/**
 * [POST] /api/admin/users/:id/unblock
 * Set blocked=false
 */
router.post("/users/:id/unblock", adminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await User.findByIdAndUpdate(
      id,
      { $set: { blocked: false } },
      { new: true }
    ).select("_id blocked");
    if (!doc) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    return res.json({ success: true, blocked: doc.blocked });
  } catch (e) {
    console.error("[admin.users.unblock]", e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

export default router;
