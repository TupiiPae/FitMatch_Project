import { Admin } from "../models/Admin.js";
import { generateToken } from "../utils/tokens.js"; // ta sẽ tái dùng, nhưng truyền role chuẩn

export const adminLogin = async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ message:"Thiếu thông tin đăng nhập" });
    }
    const query = identifier.includes("@")
      ? { email: identifier.toLowerCase() }
      : { username: identifier.trim() };

    const admin = await Admin.findOne(query).select("+password");
    if (!admin) return res.status(400).json({ message:"Tài khoản không tồn tại" });
    if (admin.status !== "active") return res.status(403).json({ message:"Tài khoản bị khóa" });

    const ok = await admin.comparePassword(password);
    if (!ok) return res.status(401).json({ message:"Sai mật khẩu" });

    const role = admin.level === 1 ? "admin_lv1" : "admin_lv2";
    const token = generateToken({ id: admin._id, username: admin.username, role });

    return res.json({
      token,
      user: { id: admin._id, username: admin.username, email: admin.email, role },
    });
  } catch (e) {
    console.error("[adminLogin]", e);
    return res.status(500).json({ message:"Lỗi server" });
  }
};
