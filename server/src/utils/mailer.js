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

  const SUPPORT = process.env.SUPPORT_EMAIL || "fitmatchservice@gmail.com";

  const html = `
  <!-- Wrapper nền nhẹ giống ảnh mẫu -->
  <div style="background:#faf5ef;padding:24px 12px;">
    <div style="max-width:620px;margin:0 auto;background:#f4f6ea;border:1px solid #f0d9c8;border-radius:12px;">
      <div style="padding:28px 32px;  font-family: "Roboto", sans-serif;color:#002C3E;">

        <!-- Brand / Tên -->
        <div style="text-align:center;margin-bottom:6px;">
          <div style="font-size:34px;font-weight:900;letter-spacing:.4px;">${APP_NAME}</div>
        </div>

        <!-- Title lớn -->
        <h1 style="margin:8px 0 2px 0;text-align:center;font-size:18px;line-height:1.35;">
          Xác thực mã OTP
        </h1>

        <!-- Mô tả -->
        <p style="margin:0 0 6px 0;text-align:left;color:#002C3E;font-size:14px;line-height:1.6;font-weight:500;">
          Xử dụng mã bên dưới để xác thực OTP, sau đó sẽ tiến hành thay đổi mật khẩu mới cho tài khoản của bạn.
        </p>

        <!-- Nhãn OTP -->
        <p style="margin:0 0 6px 0;font-weight:600;">Mã OTP của bạn:</p>

        <!-- Hộp OTP -->
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 18px;text-align:center;margin-bottom:6px;">
          <div style="font-size:28px;font-weight:800;letter-spacing:12px;">${otp}</div>
        </div>

        <!-- Ghi chú thời hạn -->
        <div style="text-align:center;margin:0 0 20px 0;color:#64748b;font-size:12px;">
          Mã OTP sẽ có hiệu lực trong 60 giây.
        </div>

        <!-- Hỗ trợ -->
        <h3 style="margin:10px 0 6px 0;font-size:16px;line-height:1.4;">
          Nếu bạn có câu hỏi nào hoặc gặp rắc rối trong việc đăng nhập
        </h3>
        <p style="margin:0 0 18px 0;color:#334155;line-height:1.6;">
          Hãy liên hệ với đội ngũ chúng tôi qua địa chỉ
          <a href="mailto:${SUPPORT}" style="color:#0ea5e9;text-decoration:none;">${SUPPORT}</a>
        </p>

        <!-- Footer -->
        <p style="margin:0 0 2px 0;">Chúc bạn sớm đạt được mục tiêu,</p>
        <p style="margin:0;font-weight:700;">Đội ngũ ${APP_NAME}</p>

      </div>
    </div>
  </div>`;

  const info = await transporter.sendMail({
    from: FROM,
    to,
    subject: `[${APP_NAME}] Xác thực mã OTP`, // tiêu đề rõ ràng hơn
    html,
  });

  if (MODE === "ethereal" && nodemailer.getTestMessageUrl) {
    console.log("[mailer][ethereal] Preview:", nodemailer.getTestMessageUrl(info));
  }
  return info;
}