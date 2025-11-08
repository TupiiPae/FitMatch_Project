// server/src/controllers/auth.google.controller.js
import crypto from "crypto";
import axios from "axios";
import { OAuth2Client } from "google-auth-library";
import { User } from "../models/User.js";
import { generateToken } from "../utils/tokens.js";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Chuẩn hoá username từ email prefix
function toUsername(prefix) {
  return String(prefix || "user").replace(/[^a-zA-Z0-9]/g, "").slice(0, 200) || "user";
}
async function ensureUniqueUsername(base) {
  let u = base;
  for (let i = 0; i < 1000; i++) {
    const existed = await User.findOne({ username: u }).select("_id").lean();
    if (!existed) return u;
    u = `${base}${i + 1}`;
  }
  // fallback siêu hiếm
  return `${base}${crypto.randomInt(1000, 9999)}`;
}

async function getProfileFromAccessToken(access_token) {
  // Google UserInfo endpoint
  const { data } = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
    timeout: 8000,
  });
  // data: { sub, email, email_verified, name, picture, ... }
  return {
    email: data?.email,
    email_verified: data?.email_verified,
    name: data?.name,
    picture: data?.picture,
    sub: data?.sub,
  };
}

async function getProfileFromIdToken(credential) {
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const p = ticket.getPayload();
  return {
    email: p?.email,
    email_verified: p?.email_verified,
    name: p?.name,
    picture: p?.picture,
    sub: p?.sub,
  };
}

export async function googleLogin(req, res) {
  try {
    const { access_token, credential } = req.body || {};
    if (!access_token && !credential) {
      return res.status(400).json({ message: "Thiếu thông tin xác thực từ Google." });
    }

    // Lấy hồ sơ người dùng từ 1 trong 2 nguồn
    let profile;
    if (access_token) profile = await getProfileFromAccessToken(access_token);
    else profile = await getProfileFromIdToken(credential);

    const email = (profile?.email || "").trim().toLowerCase();
    const emailVerified = !!profile?.email_verified;
    const name = (profile?.name || "").trim();
    const picture = profile?.picture || "";
    // const sub = profile?.sub; // nếu muốn lưu providerId

    if (!email || !emailVerified) {
      return res.status(400).json({ message: "Email Google chưa xác minh." });
    }

    // Rule FitMatch: chỉ @gmail.com
    if (!/@gmail\.com$/i.test(email)) {
      return res.status(422).json({ message: "Vui lòng dùng email @gmail.com để đăng nhập." });
    }

    // 1) Nếu đã có tài khoản với email này -> đăng nhập
    let user = await User.findOne({ email }).select("+password");
    if (!user) {
      // 2) Chưa có -> tạo mới (KHÔNG set profile.goal rỗng!)
      const emailPrefix = email.split("@")[0];
      const username = await ensureUniqueUsername(toUsername(emailPrefix));
      const nickname = name || username;
      const randomPass = crypto.randomBytes(18).toString("hex"); // để thỏa schema; sẽ được hash ở pre('save')

      user = await User.create({
        username,
        email,
        password: randomPass,
        role: "user",
        onboarded: false,
        profile: {
          nickname,                // schema yêu cầu nickname
          avatarUrl: picture || undefined,
          // KHÔNG set goal để tránh lỗi enum
        },
      });
    }

    // === CHẶN TÀI KHOẢN BỊ KHÓA (điểm mới) ===
    if (user.blocked) {
      return res.status(403).json({
        message: "Tài khoản đã bị khóa",
        blocked: true,
        reason: user.blockedReason || "Tài khoản đã bị khóa bởi quản trị viên.",
      });
    }

    const token = generateToken({ id: user._id, role: user.role, username: user.username });
    return res.json({
      token,
      user: {
        id: user._id,
        role: user.role,
        username: user.username,
        email: user.email,
        onboarded: !!user.onboarded,
        profile: user.profile || {},
      },
    });
  } catch (e) {
    console.error("[googleLogin]", e?.response?.data || e?.message || e);
    return res.status(500).json({ message: "Xác thực Google thất bại." });
  }
}
