// src/controllers/admin.auth.controller.js
import { Admin } from "../models/Admin.js";
import { generateToken } from "../utils/tokens.js";
import bcrypt from "bcryptjs";

const NICKNAME_PLAIN_REGEX = /^[\p{L}\d\s]{1,30}$/u;

const toValidationMap = (err) => {
  if (!err || err.name !== "ValidationError") return null;
  const out = {};
  for (const k of Object.keys(err.errors || {})) {
    const e = err.errors[k];
    out[(e && e.path) || k] = e.message || "Dữ liệu không hợp lệ";
  }
  return out;
};

export const adminLogin = async (req, res) => {
  try {
    const identifier = req.body?.identifier ?? req.body?.username;
    const password = req.body?.password;
    if (!identifier || !password) {
      return res.status(400).json({ message: "Thiếu thông tin đăng nhập" });
    }

    const username = String(identifier).trim();
    const admin = await Admin.findOne({ username }).select("+password");
    if (!admin) return res.status(400).json({ message: "Tài khoản không tồn tại" });
    if (admin.status !== "active") return res.status(403).json({ message: "Tài khoản bị khóa" });

    const ok = await admin.comparePassword(password);
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
        nickname: admin.nickname,
        role: "admin",
        level: admin.level,
        status: admin.status,
      },
    });
  } catch (e) {
    const map = toValidationMap(e);
    if (map) return res.status(422).json({ message: "Dữ liệu không hợp lệ", errors: map });
    console.error("[adminLogin]", e);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

// (Tùy bạn: nếu đã có /api/admin/auth/me GET ở router khác thì có thể bỏ qua)
export const adminMe = async (req, res) => {
  // req.adminId, req.adminLevel được set bởi adminAuth middleware
  const admin = await Admin.findById(req.adminId).select("-password").lean();
  if (!admin) return res.status(404).json({ message: "Không tìm thấy" });
  return res.json({
    id: admin._id,
    username: admin.username,
    nickname: admin.nickname,
    role: "admin",
    level: admin.level,
    status: admin.status,
  });
};

// PATCH /api/admin/auth/me  -> chỉ cấp 2 được đổi nickname của chính mình
export const updateAdminMe = async (req, res) => {
  if (Number(req.adminLevel) !== 2) {
    return res.status(403).json({ message: "Chỉ Admin cấp 2 mới được phép cập nhật" });
  }

  const { nickname } = req.body || {};
  const nick = (nickname ?? "").trim();

  if (!nick || !NICKNAME_PLAIN_REGEX.test(nick)) {
    return res.status(400).json({
      message: "Nickname tối đa 30 ký tự, chỉ gồm chữ (có dấu), số, khoảng trắng",
    });
  }

  const doc = await Admin.findByIdAndUpdate(
    req.adminId,
    { $set: { nickname: nick } },
    { new: true, runValidators: true, select: "-password" }
  );

  if (!doc) return res.status(404).json({ message: "Không tìm thấy" });

  return res.json({
    id: doc._id,
    username: doc.username,
    nickname: doc.nickname,
    role: "admin",
    level: doc.level,
    status: doc.status,
  });
};

// POST /api/admin/auth/change-password  -> chỉ cấp 2; cần currentPassword
export const changeAdminPassword = async (req, res) => {
  if (Number(req.adminLevel) !== 2) {
    return res.status(403).json({ message: "Chỉ Admin cấp 2 mới được phép cập nhật" });
  }

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "Thiếu mật khẩu hiện tại hoặc mật khẩu mới" });
  }
  if (typeof newPassword !== "string" || /\s/.test(newPassword) || newPassword.length < 6 || newPassword.length > 30) {
    return res.status(400).json({ message: "Mật khẩu mới 6–30 ký tự và không chứa khoảng trắng" });
  }

  const admin = await Admin.findById(req.adminId).select("+password");
  if (!admin) return res.status(404).json({ message: "Không tìm thấy" });

  const ok = await bcrypt.compare(currentPassword, admin.password);
  if (!ok) return res.status(401).json({ message: "Mật khẩu hiện tại không đúng" });

  admin.password = newPassword; // pre('save') sẽ hash
  await admin.save();

  return res.json({ success: true });
};
