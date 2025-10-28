// src/controllers/auth.controller.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import { User } from "../models/User.js";
import PasswordReset from "../models/PasswordReset.js";
import { sendOtpEmail } from "../utils/mailer.js";

/* --------------------------- Helpers --------------------------- */
const norm = (v) => (typeof v === "string" ? v.trim() : "");
const normLower = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");
const genOTP = () => String(Math.floor(100000 + Math.random() * 900000)); // 6 số

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role || "user" }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

/* =========================== AUTH CORE =========================== */
/**
 * [POST] /api/auth/register
 */
export const register = async (req, res) => {
  try {
    const username = norm(req.body.username);
    const email = normLower(req.body.email);
    const password = norm(req.body.password);
    const confirmPassword = norm(req.body.confirmPassword);

    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ thông tin." });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Mật khẩu xác nhận không khớp." });
    }

    // Kiểm tra trùng username hoặc email
    const exists = await User.findOne({ $or: [{ username }, { email }] }).lean();
    if (exists) {
      return res.status(400).json({ message: "Tên tài khoản hoặc email đã tồn tại." });
    }

    // ❗ Không hash tay; để pre('save') của User.js tự hash và lưu vào field `password`
    const newUser = await User.create({
      username,
      email,
      password, // plain → model hook sẽ hash trước khi ghi DB
    });

    const token = signToken(newUser);

    return res.status(201).json({
      message: "Đăng ký thành công!",
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        onboarded: !!newUser.onboarded,
        profile: newUser.profile || {},
      },
    });
  } catch (error) {
    // Bắt lỗi trùng key đẹp hơn
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "Trường";
      return res.status(400).json({ message: `${field} đã tồn tại.` });
    }
    console.error("[auth.register]", error);
    return res.status(500).json({ message: "Lỗi máy chủ." });
  }
};

/**
 * [POST] /api/auth/login
 * Body có thể là: { identifier, password } hoặc { email, password } hoặc { username, password }
 */
export const login = async (req, res) => {
  try {
    const identifier = norm(req.body.identifier);
    const emailInput = normLower(req.body.email);
    const usernameInput = norm(req.body.username);
    const password = norm(req.body.password);

    const idField = identifier || emailInput || usernameInput;
    if (!idField || !password) {
      return res
        .status(400)
        .json({ message: "Thiếu thông tin đăng nhập (identifier & password)." });
    }

    // Nếu có '@' → coi là email (lowercase), ngược lại → username
    const isEmail = idField.includes("@");
    const query = isEmail ? { email: normLower(idField) } : { username: norm(idField) };

    const user = await User.findOne(query).select("+password");
    if (!user) {
      return res.status(400).json({ message: "Tài khoản không tồn tại." });
    }
    if (!user.password) {
      console.error("[auth.login] user has no password field", user._id);
      return res.status(500).json({ message: "Lỗi dữ liệu người dùng." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Sai mật khẩu." });
    }

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        onboarded: !!user.onboarded,
        profile: user.profile || {},
      },
    });
  } catch (err) {
    console.error("[auth.login]", err);
    return res.status(500).json({ message: "Lỗi server." });
  }
};

/* ===================== FORGOT PASSWORD (OTP) ===================== */
/**
 * [POST] /api/auth/password/forgot
 * Body: { email }
 * Luồng: tạo OTP -> băm -> lưu PasswordReset (TTL 15') -> gửi email
 * Luôn trả thông báo chung để không lộ danh tính email.
 */
export const passwordForgot = async (req, res) => {
  try {
    const email = normLower(req.body.email);
    if (!email) return res.status(400).json({ message: "Email là bắt buộc." });

    const user = await User.findOne({ email }).select("_id");
    // Xóa yêu cầu cũ để tránh spam (tùy chọn)
    await PasswordReset.deleteMany({ email, used: false });

    if (!user) {
      return res.json({ success: true, message: "Nếu email hợp lệ, OTP đã được gửi." });
    }

    const otp = genOTP();
    const otpHash = await bcrypt.hash(otp, 10);

    await PasswordReset.create({
      email,
      otpHash,
      attempts: 0,
      used: false,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 phút
    });

    await sendOtpEmail({ to: email, otp });

    return res.json({ success: true, message: "Nếu email hợp lệ, OTP đã được gửi." });
  } catch (err) {
    console.error("[auth.passwordForgot]", err);
    return res.status(500).json({ message: "Không thể gửi OTP lúc này." });
  }
};

/**
 * [POST] /api/auth/password/verify
 * Body: { email, otp }
 * → Trả resetToken (hạn 15') để dùng ở bước reset password
 */
export const passwordVerify = async (req, res) => {
  try {
    const email = normLower(req.body.email);
    const otp = norm(req.body.otp);

    const pr = await PasswordReset.findOne({ email, used: false }).sort({ createdAt: -1 });
    if (!pr) return res.status(400).json({ message: "OTP không hợp lệ hoặc đã hết hạn." });

    if (pr.attempts >= 5) {
      return res.status(429).json({ message: "Bạn đã nhập sai quá số lần cho phép." });
    }

    const match = await bcrypt.compare(otp, pr.otpHash);
    if (!match) {
      pr.attempts += 1;
      await pr.save();
      return res.status(400).json({ message: "OTP không đúng." });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    pr.resetToken = resetToken;
    pr.resetTokenExp = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
    await pr.save();

    return res.json({ success: true, resetToken, message: "Xác minh OTP thành công." });
  } catch (err) {
    console.error("[auth.passwordVerify]", err);
    return res.status(500).json({ message: "Lỗi xác minh OTP." });
  }
};

/**
 * [POST] /api/auth/password/reset
 * Body: { email, resetToken, newPassword }
 * → Ghi đè password mới (pre('save') sẽ hash); đánh dấu used.
 */
export const passwordReset = async (req, res) => {
  try {
    const email = normLower(req.body.email);
    const resetToken = norm(req.body.resetToken);
    const newPassword = norm(req.body.newPassword);

    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({ message: "Thiếu email, resetToken hoặc mật khẩu mới." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Mật khẩu mới phải từ 6 ký tự." });
    }

    const pr = await PasswordReset.findOne({ email, resetToken, used: false });
    if (!pr || !pr.resetTokenExp || pr.resetTokenExp < new Date()) {
      return res.status(400).json({ message: "Token đặt lại không hợp lệ hoặc đã hết hạn." });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(404).json({ message: "Không tìm thấy user." });

    // ❗ Ghi đè password cũ bằng mật khẩu mới (plain) → model sẽ hash khi save
    user.password = newPassword;
    user.markModified("password");
    await user.save(); // -> lưu thẳng vào collection 'users', field 'password'

    pr.used = true;
    await pr.save();

    return res.json({ success: true, message: "Đặt lại mật khẩu thành công." });
  } catch (err) {
    console.error("[auth.passwordReset]", err);
    return res.status(500).json({ message: "Không thể đặt lại mật khẩu." });
  }
};

/**
 * (Tuỳ chọn) [POST] /api/auth/password/resend
 * Body: { email } – tạo OTP mới (có cooldown 60s)
 */
export const passwordResend = async (req, res) => {
  try {
    const email = normLower(req.body.email);
    if (!email) return res.status(400).json({ message: "Email là bắt buộc." });

    const latest = await PasswordReset.findOne({ email, used: false }).sort({ createdAt: -1 });
    if (latest && Date.now() - latest.createdAt.getTime() < 60 * 1000) {
      return res.status(429).json({ message: "Vui lòng đợi 60 giây trước khi gửi lại OTP." });
    }

    await PasswordReset.deleteMany({ email, used: false });

    const user = await User.findOne({ email }).select("_id");
    if (!user) {
      return res.json({ success: true, message: "OTP đã được gửi (nếu email hợp lệ)." });
    }

    const otp = genOTP();
    const otpHash = await bcrypt.hash(otp, 10);

    await PasswordReset.create({
      email,
      otpHash,
      attempts: 0,
      used: false,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    await sendOtpEmail({ to: email, otp });
    return res.json({ success: true, message: "OTP đã được gửi (nếu email hợp lệ)." });
  } catch (err) {
    console.error("[auth.passwordResend]", err);
    return res.status(500).json({ message: "Không thể gửi lại OTP." });
  }
};
