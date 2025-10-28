// src/controllers/admin.auth.controller.js
import { Admin } from "../models/Admin.js";
import { generateToken } from "../utils/tokens.js";

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
    // CHẤP NHẬN CẢ 2 DẠNG
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

    // LUÔN role="admin" và kèm level để middleware đọc đúng quyền
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
