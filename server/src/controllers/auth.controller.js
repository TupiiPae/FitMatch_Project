import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { generateToken } from "../utils/tokens.js";

/**
 * [POST] /api/auth/register
 */
export const register = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword)
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin." });

    if (password !== confirmPassword)
      return res.status(400).json({ message: "Mật khẩu xác nhận không khớp." });

    // Kiểm tra trùng tài khoản hoặc email
    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists)
      return res.status(400).json({ message: "Tên tài khoản hoặc email đã tồn tại." });

    // Mã hóa mật khẩu
    const hashed = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      email,
      password: hashed,
    });

    const token = generateToken(newUser);

    res.status(201).json({
      message: "Đăng ký thành công!",
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
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

    // Hỗ trợ nhiều tên trường từ client: email hoặc username hoặc identifier
    const id = identifier || email || username;
    if (!id || !password) {
      return res.status(400).json({ message: "Thiếu thông tin đăng nhập (identifier & password)" });
    }

    // Nếu id chứa '@' thì coi là email, ngược lại là username
    const query = id.includes("@") ? { email: id } : { username: id };

    // Lấy user và đảm bảo lấy cả password (nếu model để select: false)
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

    const userObj = user.toObject();
    delete userObj.password;

    const token = generateToken({
      id: user._id,
      role: user.role,
      username: user.username,
    });

    return res.json({ token, user: userObj });
  } catch (err) {
    console.error("Lỗi đăng nhập:", err);
    return res.status(500).json({ message: "Lỗi server" });
  }
};
