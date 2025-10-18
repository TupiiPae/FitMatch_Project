import nodemailer from "nodemailer";

const MODE = (process.env.MAIL_MODE || "smtp").toLowerCase();
const APP_NAME = process.env.APP_NAME || "FitMatch";

// Ưu tiên MAIL_FROM nếu có, nodemailer chấp nhận string "Name <email@...>"
const FROM = process.env.MAIL_FROM
  || `${process.env.FROM_NAME || APP_NAME} <${process.env.FROM_EMAIL || process.env.GMAIL_USER || "no-reply@fitmatch.local"}>`;

let transporter;
let modeInfo = "";

async function buildTransport() {
  switch (MODE) {
    case "gmail": {
      const user = process.env.GMAIL_USER;
      const pass = process.env.GMAIL_APP_PASS;
      if (!user || !pass) {
        throw new Error("[mailer] MAIL_MODE=gmail nhưng thiếu GMAIL_USER hoặc GMAIL_APP_PASS");
      }
      transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,            // Gmail SSL
        auth: { user, pass },
      });
      modeInfo = `GMAIL smtp.gmail.com:465 (user=${user})`;
      break;
    }

    case "smtp": {
      const host = process.env.SMTP_HOST;
      const port = Number(process.env.SMTP_PORT || 0);
      const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      if (!host || !port || !user || !pass) {
        throw new Error("[mailer] Missing SMTP_* envs");
      }
      transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
      modeInfo = `SMTP ${host}:${port} secure=${secure}`;
      break;
    }

    case "mailtrap": {
      transporter = nodemailer.createTransport({
        host: process.env.MAILTRAP_HOST,
        port: Number(process.env.MAILTRAP_PORT || 587),
        secure: false,
        auth: { user: process.env.MAILTRAP_USER, pass: process.env.MAILTRAP_PASS },
      });
      modeInfo = "MAILTRAP";
      break;
    }

    case "ethereal": {
      const acc = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: { user: acc.user, pass: acc.pass },
      });
      modeInfo = `ETHEREAL user=${acc.user}`;
      break;
    }

    case "log": {
      transporter = nodemailer.createTransport({ jsonTransport: true });
      modeInfo = "LOG (jsonTransport)";
      break;
    }

    default:
      throw new Error(`[mailer] Unsupported MAIL_MODE=${MODE}`);
  }
}

export async function verifyMailer() {
  if (!transporter) await buildTransport();
  try {
    // jsonTransport/ethereal verify có thể throw — cho qua log mode
    await transporter.verify().catch((e) => {
      if (MODE !== "log") throw e;
    });
    console.log(`[mailer] Ready: ${modeInfo}`);
  } catch (err) {
    console.error("[mailer.verify] Failed:", err?.message || err);
    throw err;
  }
}

export async function sendOtpEmail({ to, otp }) {
  if (!transporter) await buildTransport();

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 8px 0">${APP_NAME} - Mã OTP đổi mật khẩu</h2>
      <p>Tài khoản: <b>${to}</b></p>
      <p>Mã OTP (hết hạn sau 15 phút):</p>
      <div style="font-size:24px;font-weight:800;letter-spacing:4px;margin:12px 0">${otp}</div>
      <hr/>
      <p style="font-size:12px;color:#64748b">Hỗ trợ: ${process.env.SUPPORT_EMAIL || to}</p>
    </div>
  `;

  const info = await transporter.sendMail({
    from: FROM,         // ví dụ: "FitMatch <fitmatchservice@gmail.com>"
    to,
    subject: `[${APP_NAME}] Mã OTP đổi mật khẩu`,
    html,
  });

  if (MODE === "ethereal" && nodemailer.getTestMessageUrl) {
    console.log("[mailer][ethereal] Preview:", nodemailer.getTestMessageUrl(info));
  }
  return info;
}
