import { Admin } from "../models/Admin.js";
import { generateToken } from "../utils/tokens.js";

// Gom lỗi validate (phòng khi sau này có tạo/sửa admin trong file này)
function toValidationMap(err) {
  if (!err || err.name !== "ValidationError") return null;
  const out = {};
  for (const k of Object.keys(err.errors || {})) {
    const e = err.errors[k];
    const path = (e && e.path) || k;
    out[path] = e.message || "Dữ liệu không hợp lệ";
  }
  return out;
}

export const adminLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ message:"Thiếu thông tin đăng nhập" });
    }

    // Admin model KHÔNG còn email -> chỉ cho đăng nhập bằng username
    const username = String(identifier || "").trim();
    const admin = await Admin.findOne({ username }).select("+password");
    if (!admin) return res.status(400).json({ message:"Tài khoản không tồn tại" });
    if (admin.status !== "active") return res.status(403).json({ message:"Tài khoản bị khóa" });

    const ok = await admin.comparePassword(password);
    if (!ok) return res.status(401).json({ message:"Sai mật khẩu" });

    const role = admin.level === 1 ? "admin_lv1" : "admin_lv2";
    const token = generateToken({ id: admin._id, username: admin.username, role });

    return res.json({
      token,
      user: { id: admin._id, username: admin.username, nickname: admin.nickname, role },
    });
  } catch (e) {
    const map = toValidationMap(e);
    if (map) return res.status(422).json({ message:"Dữ liệu không hợp lệ", errors:map });
    console.error("[adminLogin]", e);
    return res.status(500).json({ message:"Lỗi server" });
  }
};
