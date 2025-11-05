import React, { useEffect, useState } from "react";
import api from "../../../lib/api";
import "./ChangePassword.css";

const OTP_TTL_SEC = Number(import.meta.env.VITE_OTP_TTL_SEC || 120);

function fmtMMSS(s) {
  const mm = Math.floor(Math.max(0, s) / 60);
  const ss = Math.max(0, s) % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function ChangePassword() {
  const [step, setStep] = useState("email"); // email | otp | reset | done

  // form states
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // ui states
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const clearMsg = () => setMsg({ type: "", text: "" });

  // resend cooldown
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // otp time left (đồng hồ hiệu lực OTP)
  const [otpLeft, setOtpLeft] = useState(0);
  useEffect(() => {
    if (otpLeft <= 0) return;
    const t = setInterval(() => setOtpLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [otpLeft]);

  const Alert = ({ type, children }) =>
    children ? (
      <div className={`cp-alert ${type === "success" ? "cp-ok" : "cp-err"}`}>
        {children}
      </div>
    ) : null;

  /* ---------------- Handlers ---------------- */
  const handleSendOtp = async (e) => {
    e.preventDefault();
    clearMsg();
    const v = email.trim().toLowerCase();
    if (!v) return setMsg({ type: "error", text: "Vui lòng nhập email." });

    try {
      setLoading(true);
      const res = await api.post("/auth/password/forgot", { email: v });
      setMsg({
        type: "success",
        text: res?.data?.message || "Nếu email hợp lệ, OTP đã được gửi.",
      });
      setCooldown(60);
      setOtpLeft(OTP_TTL_SEC);
      setStep("otp");
    } catch (err) {
      const m =
        err?.response?.data?.message ||
        err?.message ||
        "Không thể gửi OTP. Vui lòng thử lại.";
      setMsg({ type: "error", text: m });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    clearMsg();
    const v = email.trim().toLowerCase();
    if (!v) return setMsg({ type: "error", text: "Vui lòng nhập email trước khi gửi lại OTP." });
    if (cooldown > 0) return;

    try {
      setLoading(true);
      const res = await api.post("/auth/password/resend", { email: v });
      setMsg({
        type: "success",
        text: res?.data?.message || "OTP đã được gửi (nếu email hợp lệ).",
      });
      setCooldown(60);
      setOtpLeft(OTP_TTL_SEC); // reset đồng hồ hiệu lực
    } catch (err) {
      const m =
        err?.response?.data?.message ||
        err?.message ||
        "Không thể gửi lại OTP lúc này.";
      setMsg({ type: "error", text: m });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    clearMsg();

    // Chặn xác minh khi OTP đã hết hạn (UI)
    if (otpLeft <= 0) {
      return setMsg({
        type: "error",
        text: "OTP đã hết hạn. Vui lòng bấm 'Gửi lại OTP'.",
      });
    }

    const vEmail = email.trim().toLowerCase();
    const vOtp = otp.trim();
    if (!vOtp) return setMsg({ type: "error", text: "Vui lòng nhập mã OTP." });

    try {
      setLoading(true);
      const res = await api.post("/auth/password/verify", { email: vEmail, otp: vOtp });
      const token = res?.data?.resetToken;
      if (!token) throw new Error("Không nhận được resetToken.");
      setResetToken(token);
      setMsg({ type: "success", text: "Xác minh OTP thành công." });
      setStep("reset");
    } catch (err) {
      const m =
        err?.response?.data?.message ||
        err?.message ||
        "OTP không hợp lệ. Vui lòng thử lại.";
      setMsg({ type: "error", text: m });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    clearMsg();
    if (!newPassword || !confirmPassword) {
      return setMsg({ type: "error", text: "Vui lòng nhập đủ mật khẩu mới và xác nhận." });
    }
    if (newPassword.length < 6) {
      return setMsg({ type: "error", text: "Mật khẩu mới phải từ 6 ký tự." });
    }
    if (newPassword !== confirmPassword) {
      return setMsg({ type: "error", text: "Xác nhận mật khẩu mới không khớp." });
    }

    try {
      setLoading(true);
      const res = await api.post("/auth/password/reset", {
        email: email.trim().toLowerCase(),
        resetToken,
        newPassword,
      });
      setMsg({ type: "success", text: res?.data?.message || "Đặt lại mật khẩu thành công." });
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setStep("done");
    } catch (err) {
      const m =
        err?.response?.data?.message ||
        err?.message ||
        "Không thể đặt lại mật khẩu.";
      setMsg({ type: "error", text: m });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="acc-card card">
      <h2 className="pf-title">Thay đổi mật khẩu</h2>

      <div className="cp-wrap">
        <div className="cp-block">
          <div className="cp-subtitle">Bạn muốn thay đổi mật khẩu?</div>
          <p className="cp-desc">
            Nhập Email để nhận mã OTP, sau đó xác minh OTP và đặt lại mật khẩu.
          </p>

          <Alert type={msg.type}>{msg.text}</Alert>

          {/* STEP 1: EMAIL */}
          {step === "email" && (
            <form className="cp-form" onSubmit={handleSendOtp}>
              <input
                type="email"
                className="cp-input"
                placeholder="Nhập email của bạn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={clearMsg}
                required
              />
              <button className="btn-success cp-send" type="submit" disabled={loading}>
                {loading ? "Đang gửi..." : "Gửi OTP"}
              </button>
            </form>
          )}

          {/* STEP 2: OTP */}
          {step === "otp" && (
            <>
              <form className="cp-form" onSubmit={handleVerifyOtp}>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="cp-input"
                  placeholder="Nhập mã OTP (6 số)"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  onFocus={clearMsg}
                  required
                />
                <button className="btn-success cp-send" type="submit" disabled={loading || otpLeft <= 0}>
                  {loading ? "Đang xác minh..." : otpLeft > 0 ? "Xác minh OTP" : "OTP đã hết hạn"}
                </button>
              </form>

              {/* Hàng meta: trái = đếm ngược, phải = gửi lại OTP */}
              <div className="cp-meta-row">
                <div className={`cp-timer ${otpLeft <= 0 ? "expired" : ""}`}>
                  {otpLeft > 0 ? `Mã hết hạn sau: ${fmtMMSS(otpLeft)}` : "OTP đã hết hạn"}
                </div>
                <button
                  className="btn-ghost cp-resend"
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading || cooldown > 0}
                  title="Gửi lại OTP"
                >
                  {cooldown > 0 ? `Gửi lại OTP (${cooldown}s)` : "Gửi lại OTP"}
                </button>
              </div>

              {/* Link đổi email */}
              <div className="cp-resend-row">
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => {
                    clearMsg();
                    setStep("email");
                  }}
                >
                  Đổi email
                </button>
              </div>
            </>
          )}

          {/* STEP 3: RESET PASSWORD */}
          {step === "reset" && (
            <form className="cp-form" onSubmit={handleResetPassword}>
              <input
                type="password"
                className="cp-input"
                placeholder="Mật khẩu mới (≥ 6 ký tự)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onFocus={clearMsg}
                required
              />
              <input
                type="password"
                className="cp-input"
                placeholder="Xác nhận mật khẩu mới"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onFocus={clearMsg}
                required
              />
              <button className="btn-success cp-send" type="submit" disabled={loading}>
                {loading ? "Đang đặt lại..." : "Đặt mật khẩu"}
              </button>

              <div className="cp-resend-row">
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={() => {
                    clearMsg();
                    setStep("otp");
                  }}
                >
                  Quay lại nhập OTP
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: DONE */}
          {step === "done" && (
            <div className="cp-done">
              <div className="cp-subtitle">Hoàn tất</div>
              <p className="cp-desc">
                Bạn đã đặt lại mật khẩu thành công. Vui lòng dùng mật khẩu mới cho lần đăng nhập tiếp theo.
              </p>
              <div className="cp-resend-row">
                <button
                  className="btn-success"
                  type="button"
                  onClick={() => {
                    setEmail("");
                    setOtp("");
                    setResetToken("");
                    setNewPassword("");
                    setConfirmPassword("");
                    clearMsg();
                    setStep("email");
                  }}
                >
                  Đặt lại khác
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
