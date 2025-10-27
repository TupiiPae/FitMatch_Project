// server/src/routes/admin.routes.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import { Admin } from "../models/Admin.js";
import { User } from "../models/User.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { requireAdminLevel } from "../middleware/requireAdminLevel.js";
import { generateToken } from "../utils/tokens.js";

const router = Router();
const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ======================= AUTH (Admin) ======================= */
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
        nickname: admin.nickname,   // <— thêm
        role: "admin",
        level: admin.level,
        status: admin.status,
      },
    });
  } catch (e) {
    console.error("[admin.auth.login]", e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

router.get("/auth/me", adminAuth, async (req, res) => {
  const admin = await Admin.findById(req.adminId).select("_id username nickname level status");
  if (!admin) return res.status(404).json({ message: "Không tìm thấy admin" });
  res.json({
    id: admin._id,
    username: admin.username,
    nickname: admin.nickname,      // <— thêm
    role: "admin",
    level: admin.level,
    status: admin.status,
  });
});

/* ======================= Stats (mẫu) ======================= */
router.get("/stats", adminAuth, async (_req, res) => {
  res.json({ users: 0, scansToday: 0, mergesToday: 0, nutritionLogUsers: 0 });
});

/* ======================= USERS MANAGEMENT ======================= */
router.get("/users", adminAuth, async (req, res) => {
  try {
    const qRaw = String(req.query?.q ?? "").trim();
    const limit = Math.min(Math.max(Number(req.query?.limit ?? 10) || 10, 1), 100);
    const skip  = Math.max(Number(req.query?.skip ?? 0) || 0, 0);

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

router.post("/users/:id/block", adminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await User.findByIdAndUpdate(id, { $set: { blocked: true } }, { new: true })
      .select("_id blocked");
    if (!doc) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    return res.json({ success: true, blocked: doc.blocked });
  } catch (e) {
    console.error("[admin.users.block]", e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

router.post("/users/:id/unblock", adminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await User.findByIdAndUpdate(id, { $set: { blocked: false } }, { new: true })
      .select("_id blocked");
    if (!doc) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    return res.json({ success: true, blocked: doc.blocked });
  } catch (e) {
    console.error("[admin.users.unblock]", e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

/* ======================= ADMIN ACCOUNTS (chỉ cấp 1 mới quản trị) ======================= */
/**
 * [GET] /api/admin/admin-accounts
 * Query: q, limit, skip
 * Chỉ hiển thị admin cấp 2 để quản trị; admin cấp 1 là duy nhất (không list để tránh xoá nhầm).
 */
router.get("/admin-accounts", adminAuth, requireAdminLevel(1), async (req, res) => {
  try {
    const qRaw = String(req.query?.q ?? "").trim();
    const limit = Math.min(Math.max(Number(req.query?.limit ?? 10) || 10, 1), 100);
    const skip  = Math.max(Number(req.query?.skip ?? 0) || 0, 0);

    const cond = { level: 2 }; // chỉ quản trị tài khoản cấp 2
    if (qRaw) {
      const rx = new RegExp(escapeRegex(qRaw), "i");
      cond.$or = [{ username: rx }, { nickname: rx }, { status: rx }];
    }

    const [items, total] = await Promise.all([
      Admin.find(cond)
        .select("_id username nickname level status createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Admin.countDocuments(cond),
    ]);

    res.json({ items, total, limit, skip });
  } catch (e) {
    console.error("[admin.admin-accounts.list]", e);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

/**
 * [POST] /api/admin/admin-accounts
 * Body: { username, nickname }
 * Tạo admin cấp 2; mật khẩu mặc định: "fitmatch@admin2"
 */
router.post("/admin-accounts", adminAuth, requireAdminLevel(1), async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const nickname = String(req.body?.nickname || "").trim();

    if (!username || !nickname) {
      return res.status(400).json({ message: "Thiếu username hoặc nickname" });
    }

    // Kiểm tra tồn tại
    const existed = await Admin.findOne({ username }).select("_id");
    if (existed) return res.status(409).json({ message: "Username đã tồn tại" });

    const doc = await Admin.create({
      username,
      nickname,
      level: 2,
      password: "fitmatch@admin2",
    });

    res.status(201).json({
      id: doc._id,
      username: doc.username,
      nickname: doc.nickname,
      level: doc.level,
      status: doc.status,
      createdAt: doc.createdAt,
    });
  } catch (e) {
    console.error("[admin.admin-accounts.create]", e?.message || e);
    // Bắt lỗi validate Mongoose
    if (e?.name === "ValidationError") {
      const firstKey = Object.keys(e.errors || {})[0];
      const msg = firstKey ? e.errors[firstKey]?.message : "Dữ liệu không hợp lệ";
      return res.status(422).json({ message: msg });
    }
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

export default router;
