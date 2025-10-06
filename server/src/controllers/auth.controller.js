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
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ message: "Vui lòng nhập tên tài khoản và mật khẩu." });

    const user = await User.findOne({ username });
    if (!user)
      return res.status(400).json({ message: "Tài khoản không tồn tại." });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ message: "Mật khẩu không đúng." });

    const token = generateToken(user);

    res.json({
      message: "Đăng nhập thành công!",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        onboarded: user.onboarded,
      },
    });
  } catch (error) {
    console.error("Lỗi đăng nhập:", error);
    res.status(500).json({ message: "Lỗi máy chủ." });
  }
};
