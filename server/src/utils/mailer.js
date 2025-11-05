import nodemailer from "nodemailer";

const MODE = (process.env.MAIL_MODE || "smtp").toLowerCase();
const APP_NAME = process.env.APP_NAME || "FitMatch";
const FROM =
  process.env.MAIL_FROM ||
  `${process.env.FROM_NAME || APP_NAME} <${process.env.FROM_EMAIL || process.env.GMAIL_USER || "no-reply@fitmatch.local"}>`;

let transporter;
let modeInfo = "";

async function buildTransport() {
  switch (MODE) {
    case "gmail": {
      const user = process.env.GMAIL_USER;
      const pass = process.env.GMAIL_APP_PASS;
      if (!user || !pass) throw new Error("[mailer] MAIL_MODE=gmail nhưng thiếu GMAIL_USER hoặc GMAIL_APP_PASS");
      transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
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
      if (!host || !port || !user || !pass) throw new Error("[mailer] Missing SMTP_* envs");
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
    await transporter.verify().catch((e) => {
      if (MODE !== "log") throw e;
    });
    console.log(`[mailer] Ready: ${modeInfo}`);
  } catch (err) {
    console.error("[mailer.verify] Failed:", err?.message || err);
    throw err;
  }
}

function renderOtpEmail({ otp, ttlMinutes = 2 }) {
  const year = new Date().getFullYear();
  return `
  <div style="margin:0;padding:0;background:#f3f4f6">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f6ea;padding:24px 0">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:600px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
            <tr>
              <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:560px;background:#ffffff;border-radius:8px;border:1px solid #78BCC4;box-shadow:0 2px 10px rgba(15,23,42,0.08);overflow:hidden">
                  <tr>
                    <td height="64" style="height:64px;background:#f4f6ea;text-align:center;vertical-align:middle">
                      <div style="display:inline-block;font-size:18px;line-height:24px;font-weight:700;letter-spacing:0.2px;color:#002C3E">
                        Mã OTP Đặt Lại Mật Khẩu
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:24px 28px">
                      <div style="font-size:14px;line-height:1.6;margin:0 0 8px 0;color:#0f172a">Chào bạn,</div>
                      <div style="font-size:14px;line-height:1.6;margin:0 0 16px 0;color:#0f172a">
                        Sử dụng mã OTP bên dưới để tiến hành đặt lại mật khẩu cho tài khoản của bạn:
                      </div>
                      <div style="background:#f1f5f9;border-radius:8px;padding:14px 18px;text-align:center;margin:6px 0 18px 0">
                        <div style="font-size:34px;font-weight:800;letter-spacing:4px;color:#008080;line-height:1">${otp}</div>
                      </div>
                      <div style="font-size:14px;line-height:1.6;color:#334155;margin:0 0 12px 0">
                        Mã có hiệu lực trong <b>${ttlMinutes} phút</b>. Vui lòng không chia sẻ mã này với bất kỳ ai.
                      </div>
                      <div style="font-size:12px;line-height:1.6;color:#64748b;margin-top:6px">
                        Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email.
                      </div>
                      <div style="font-size:12px;line-height:1.6;color:#64748b;margin-top:6px">
                        Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td height="48" style="height:48px;background:#f8fafc;border-top:1px solid #eef2f7;padding:0 20px;text-align:center">
                      <div style="font-size:12px;color:#94a3b8;line-height:48px">
                        © ${year} ${APP_NAME}. All rights reserved.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

export async function sendOtpEmail({ to, otp }) {
  if (!transporter) await buildTransport();
  const ttl = Number(process.env.OTP_TTL_MINUTES || 2);
  const html = renderOtpEmail({ otp, ttlMinutes: ttl });
  const info = await transporter.sendMail({
    from: FROM,
    to,
    subject: `[${APP_NAME}] Mã OTP xác minh`,
    html,
  });
  if (MODE === "ethereal" && nodemailer.getTestMessageUrl) {
    console.log("[mailer][ethereal] Preview:", nodemailer.getTestMessageUrl(info));
  }
  return info;
}
