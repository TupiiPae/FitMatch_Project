import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { generateToken } from "../utils/tokens.js";

/**
 * [POST] /api/auth/register
 */
export const register = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin." });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Mật khẩu xác nhận không khớp." });
    }

    // Kiểm tra trùng tài khoản hoặc email
    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) {
      return res.status(400).json({ message: "Tên tài khoản hoặc email đã tồn tại." });
    }

    // Mã hóa mật khẩu
    const hashed = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      email,
      password: hashed,
      // onboarded mặc định false theo schema
    });

    const token = generateToken(newUser); // hàm của bạn

    res.status(201).json({
      message: "Đăng ký thành công!",
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        onboarded: !!newUser.onboarded,     // 👈 thêm cờ này
        profile: newUser.profile || {},      // (tuỳ chọn) gửi kèm profile rỗng
      },
    });
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
};

/**
 * [POST] /api/auth/login
 */
export const login = async (req, res) => {
  try {
    const { email, username, password, identifier } = req.body;

    // Hỗ trợ nhiều tên trường từ client
    const id = identifier || email || username;
    if (!id || !password) {
      return res.status(400).json({ message: "Thiếu thông tin đăng nhập (identifier & password)" });
    }

    // Nếu có '@' → email, ngược lại → username
    const query = id.includes("@") ? { email: id } : { username: id };

    // Lấy user + password (nếu schema có select:false)
    const user = await User.findOne(query).select("+password");
    if (!user) {
      return res.status(400).json({ message: "Tài khoản không tồn tại" });
    }
    if (!user.password) {
      console.error("Login error: user has no password field", user._id);
      return res.status(500).json({ message: "Lỗi dữ liệu người dùng" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Sai mật khẩu" });
    }

    // Tạo JWT
    const token = generateToken({
      id: user._id,
      role: user.role,
      username: user.username,
    });

    // Trả về thông tin người dùng (không kèm password)
    return res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        onboarded: !!user.onboarded,     // 👈 FE dựa vào đây để rẽ nhánh
        profile: user.profile || {},      // (tuỳ chọn) gắn kèm
      },
    });
  } catch (err) {
    console.error("Lỗi đăng nhập:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
};
