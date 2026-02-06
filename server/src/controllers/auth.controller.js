// src/controllers/auth.controller.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fetch from "node-fetch"; // nếu đang dùng Node <18, đảm bảo đã cài: npm i node-fetch

import { User } from "../models/User.js";
import PasswordReset from "../models/PasswordReset.js";

import RegisterOtp from "../models/RegisterOtp.js";
import { sendOtpEmail, sendRegisterOtpEmail } from "../utils/mailer.js";

/* --------------------------- Config (có thể chỉnh qua ENV) --------------------------- */
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES || 2); // TTL OTP (phút) – mặc định 2 để đồng bộ UI
const RESEND_COOLDOWN_SEC = Number(process.env.OTP_RESEND_COOLDOWN_SEC || 60); // cooldown gửi lại (giây)
const MAX_OTP_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5); // số lần nhập sai tối đa
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

const REQUIRE_REGISTER_OTP = String(process.env.REQUIRE_REGISTER_OTP || "0") === "1";
const REGISTER_OTP_TTL_MINUTES = Number(process.env.REGISTER_OTP_TTL_MINUTES || OTP_TTL_MINUTES);
const REGISTER_OTP_COOLDOWN_SEC = Number(process.env.REGISTER_OTP_RESEND_COOLDOWN_SEC || RESEND_COOLDOWN_SEC);
const EMAIL_GMAIL_SIMPLE = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

const genOTP4 = () => String(Math.floor(1000 + Math.random() * 9000));

/* --------------------------- Helpers --------------------------- */
const norm = (v) => (typeof v === "string" ? v.trim() : "");
const normLower = (v) => (typeof v === "string" ? v.trim().toLowerCase() : "");
const genOTP = () => String(Math.floor(100000 + Math.random() * 900000)); // 6 số
const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role || "user" }, process.env.JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

const ensureUniqueUsername = async (base) => {
  let slug = String(base || "user").replace(/[^a-zA-Z0-9]/g, "") || "user";
  if (slug.length < 4) slug = slug + Math.floor(1000 + Math.random() * 9000);
  let candidate = slug;
  let i = 0;
  // Thử tối đa 100 lần để chắc chắn duy nhất
  while (i < 100) {
    const existed = await User.findOne({ username: candidate }).select("_id").lean();
    if (!existed) return candidate;
    i += 1;
    candidate = `${slug}${i}`;
  }
  return `${slug}${Date.now()}`;
};

/**
 * Cập nhật timestamp đăng nhập/hoạt động cho user
 * - lastLoginAt: lần đăng nhập gần nhất
 * - lastActiveAt: lần hoạt động gần nhất (ở đây cũng set bằng lúc login)
 */
const touchLoginActivity = async (userId) => {
  if (!userId) return;
  try {
    await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          lastLoginAt: new Date(),
          lastActiveAt: new Date(),
        },
      },
      { new: false }
    );
  } catch (e) {
    console.error("[auth] cập nhật lastLoginAt/lastActiveAt lỗi:", e?.message || e);
  }
};

export const registerOtpRequest = async (req, res) => {
  try {
    const email = normLower(req.body.email);
    if (!email) return res.status(400).json({ success: false, message: "Email là bắt buộc." });
    if (!EMAIL_GMAIL_SIMPLE.test(email)) {
      return res.status(400).json({ success: false, message: "Email phải có đuôi @gmail.com." });
    }

    const user = await User.findOne({ email }).select("_id").lean();
    if (user) return res.status(409).json({ success: false, message: "Email đã được sử dụng." });

    const latest = await RegisterOtp.findOne({ email, used: false }).sort({ createdAt: -1 });
    if (latest && Date.now() - latest.createdAt.getTime() < REGISTER_OTP_COOLDOWN_SEC * 1000) {
      return res
        .status(429)
        .json({ success: false, message: `Vui lòng đợi ${REGISTER_OTP_COOLDOWN_SEC} giây trước khi gửi lại OTP.` });
    }

    await RegisterOtp.deleteMany({ email, used: false });

    const otp = genOTP4();
    const otpHash = await bcrypt.hash(otp, 10);

    await RegisterOtp.create({
      email,
      otpHash,
      attempts: 0,
      used: false,
      expiresAt: new Date(Date.now() + REGISTER_OTP_TTL_MINUTES * 60 * 1000),
    });

    await sendRegisterOtpEmail({ to: email, otp });

    return res.json({ success: true, message: "OTP đăng ký đã được gửi.", ttlSec: REGISTER_OTP_TTL_MINUTES * 60 });
  } catch (err) {
    console.error("[auth.registerOtpRequest]", err);
    return res.status(500).json({ success: false, message: "Không thể gửi OTP lúc này." });
  }
};

export const registerOtpResend = async (req, res) => {
  return registerOtpRequest(req, res);
};


/* =========================== AUTH CORE =========================== */
export const register = async (req, res) => {
  try {
    const otp = norm(req.body.otp);
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

    const exists = await User.findOne({ $or: [{ username }, { email }] }).lean();
    if (exists) {
      return res.status(400).json({ message: "Tên tài khoản hoặc email đã tồn tại." });
    }

    if (REQUIRE_REGISTER_OTP) {
      if (!otp) return res.status(400).json({ message: "Vui lòng nhập OTP để xác thực email." });

      const ro = await RegisterOtp.findOne({ email, used: false }).sort({ createdAt: -1 });
      if (!ro) return res.status(400).json({ message: "OTP không hợp lệ hoặc đã hết hạn." });

      if (ro.expiresAt && new Date() > new Date(ro.expiresAt)) {
        await RegisterOtp.deleteMany({ email });
        return res.status(400).json({ message: "OTP đã hết hạn. Vui lòng gửi lại." });
      }

      if (ro.attempts >= MAX_OTP_ATTEMPTS) {
        await RegisterOtp.deleteMany({ email });
        return res.status(429).json({ message: "Bạn đã nhập sai quá số lần cho phép. Vui lòng gửi OTP mới." });
      }

      const ok = await bcrypt.compare(otp, ro.otpHash);
      if (!ok) {
        ro.attempts += 1;
        await ro.save();
        return res.status(400).json({ message: "OTP không đúng." });
      }

      ro.used = true;
      await ro.save();
    }

    const now = new Date();
    const newUser = await User.create({
      username,
      email,
      password,
      // Đăng ký xong là coi như đăng nhập luôn → set luôn 2 field
      lastLoginAt: now,
      lastActiveAt: now,
    });

    const token = signToken(newUser);

    if (REQUIRE_REGISTER_OTP) {
      await RegisterOtp.deleteMany({ email });
    }

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
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "Trường";
      return res.status(400).json({ message: `${field} đã tồn tại.` });
    }
    console.error("[auth.register]", error);
    return res.status(500).json({ message: "Lỗi máy chủ." });
  }
};

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

    const isEmail = idField.includes("@");
    const query = isEmail ? { email: normLower(idField) } : { username: norm(idField) };

    const user = await User.findOne(query).select("+password");
    if (!user) {
      return res.status(400).json({ message: "Tài khoản không tồn tại." });
    }
    if (user.blocked) {
      return res.status(403).json({
        message: "Tài khoản đã bị khóa",
        blocked: true,
        reason: user.blockedReason || "Tài khoản đã bị khóa bởi quản trị viên.",
        /*blockedAt: user.blockedAt || null,*/
      });
    }
    if (!user.password) {
      console.error("[auth.login] user has no password field", user._id);
      return res.status(500).json({ message: "Lỗi dữ liệu người dùng." });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Sai mật khẩu." });
    }

    // ✅ Đánh dấu hoạt động & đăng nhập
    await touchLoginActivity(user._id);

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

/* =========================== GOOGLE LOGIN =========================== */
/**
 * FE gọi: POST /auth/google  với payload:
 *  { access_token?:string, credential?:string, code?:string }
 * Hiện tại dùng @react-oauth/google (implicit) → access_token.
 */
export const google = async (req, res) => {
  try {
    const accessToken = norm(req.body.access_token);
    const credential = norm(req.body.credential); // dự phòng nếu đổi flow
    const code = norm(req.body.code);             // dự phòng nếu đổi flow

    if (!accessToken && !credential && !code) {
      return res.status(400).json({ message: "Thiếu access_token/credential/code." });
    }

    // Ưu tiên access_token (flow hiện tại)
    let googleEmail = null;
    let googleSub = null; // google user id
    let googleName = null;

    if (accessToken) {
      const resp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!resp.ok) {
        return res.status(400).json({ message: "Token Google không hợp lệ." });
      }
      const info = await resp.json();
      googleEmail = normLower(info?.email || "");
      googleSub = norm(info?.sub || "");
      googleName = norm(info?.name || "");
    } else {
      // Nếu sau này bạn dùng ID token (credential) hoặc authorization code,
      // thì bổ sung xử lý tại đây (đổi code -> access_token -> userinfo).
      return res.status(400).json({ message: "Flow Google chưa được hỗ trợ." });
    }

    if (!googleEmail) {
      return res.status(400).json({ message: "Không lấy được email từ Google." });
    }
    // Schema bạn yêu cầu email @gmail.com
    if (!/@gmail\.com$/i.test(googleEmail)) {
      return res.status(400).json({ message: "Email Google phải là @gmail.com." });
    }

    // Tìm theo email
    let user = await User.findOne({ email: googleEmail }).select("+password");
    if (!user) {
      // Tạo mới người dùng (tối thiểu): username suy ra từ email
      const baseUsername = googleEmail.split("@")[0];
      const username = await ensureUniqueUsername(baseUsername);
      // Mật khẩu ngẫu nhiên để pass schema (user đăng nhập lại vẫn dùng Google)
      const randomPass = crypto.randomBytes(12).toString("base64url").slice(0, 12);

      const now = new Date();
      user = await User.create({
        username,
        email: googleEmail,
        password: randomPass,
        profile: {
          nickname: googleName || username, // nickname required trong schema
        },
        // Đăng nhập lần đầu bằng Google
        lastLoginAt: now,
        lastActiveAt: now,
      });
    } else {
      // User cũ đăng nhập lại bằng Google → cập nhật time
      await touchLoginActivity(user._id);
    }

    if (user.blocked) {
      return res.status(403).json({
        message: "Tài khoản đã bị khóa",
        blocked: true,
        reason: user.blockedReason || "Vi phạm qui định.",
      });
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
    console.error("[auth.google]", err);
    return res.status(500).json({ message: "Đăng nhập Google thất bại." });
  }
};

/* ===================== FORGOT PASSWORD (OTP) ===================== */
export const passwordForgot = async (req, res) => {
  try {
    const email = normLower(req.body.email);
    if (!email) return res.status(400).json({ message: "Email là bắt buộc." });

    const user = await User.findOne({ email }).select("_id");
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
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    });

    await sendOtpEmail({ to: email, otp });

    return res.json({ success: true, message: "Nếu email hợp lệ, OTP đã được gửi." });
  } catch (err) {
    console.error("[auth.passwordForgot]", err);
    return res.status(500).json({ message: "Không thể gửi OTP lúc này." });
  }
};

export const passwordVerify = async (req, res) => {
  try {
    const email = normLower(req.body.email);
    const otp = norm(req.body.otp);

    const pr = await PasswordReset.findOne({ email, used: false }).sort({ createdAt: -1 });
    if (!pr) return res.status(400).json({ message: "OTP không hợp lệ hoặc đã hết hạn." });

    // CHẶN HẾT HẠN (bổ sung)
    if (pr.expiresAt && new Date() > new Date(pr.expiresAt)) {
      return res.status(400).json({ message: "OTP đã hết hạn." });
    }

    if (pr.attempts >= MAX_OTP_ATTEMPTS) {
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
    pr.resetTokenExp = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
    await pr.save();

    return res.json({ success: true, resetToken, message: "Xác minh OTP thành công." });
  } catch (err) {
    console.error("[auth.passwordVerify]", err);
    return res.status(500).json({ message: "Lỗi xác minh OTP." });
  }
};

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

    user.password = newPassword;
    user.markModified("password");
    await user.save();

    pr.used = true;
    await pr.save();

    return res.json({ success: true, message: "Đặt lại mật khẩu thành công." });
  } catch (err) {
    console.error("[auth.passwordReset]", err);
    return res.status(500).json({ message: "Không thể đặt lại mật khẩu." });
  }
};

export const passwordResend = async (req, res) => {
  try {
    const email = normLower(req.body.email);
    if (!email) return res.status(400).json({ message: "Email là bắt buộc." });

    const latest = await PasswordReset.findOne({ email, used: false }).sort({ createdAt: -1 });
    if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_SEC * 1000) {
      return res.status(429).json({ message: `Vui lòng đợi ${RESEND_COOLDOWN_SEC} giây trước khi gửi lại OTP.` });
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
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    });

    await sendOtpEmail({ to: email, otp });
    return res.json({ success: true, message: "OTP đã được gửi (nếu email hợp lệ)." });
  } catch (err) {
    console.error("[auth.passwordResend]", err);
    return res.status(500).json({ message: "Không thể gửi lại OTP." });
  }
};
