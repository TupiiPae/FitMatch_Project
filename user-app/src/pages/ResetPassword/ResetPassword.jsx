import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../lib/api";
import "./ResetPassword.css";

export default function ResetPassword() {
  const nav = useNavigate();

  // steps: email | otp | reset | done
  const [step, setStep] = useState("email");

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

  /* ---------------- Handlers ---------------- */
  const handleSendOtp = async (e) => {
    e.preventDefault();
    clearMsg();
    const v = email.trim().toLowerCase();
    if (!v) {
      setMsg({ type: "error", text: "Vui lòng nhập email." });
      return;
    }
    try {
      setLoading(true);
      const res = await api.post("/auth/password/forgot", { email: v });
      setMsg({
        type: "success",
        text: res?.data?.message || "Nếu email hợp lệ, OTP đã được gửi.",
      });
      setCooldown(60);
      setStep("otp");
    } catch (err) {
      const m = err?.response?.data?.message || err?.message || "Không thể gửi OTP. Vui lòng thử lại.";
      setMsg({ type: "error", text: m });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    clearMsg();
    const v = email.trim().toLowerCase();
    if (!v) {
      setMsg({ type: "error", text: "Vui lòng nhập email trước khi gửi lại OTP." });
      return;
    }
    if (cooldown > 0) return;
    try {
      setLoading(true);
      const res = await api.post("/auth/password/resend", { email: v });
      setMsg({
        type: "success",
        text: res?.data?.message || "OTP đã được gửi (nếu email hợp lệ).",
      });
      setCooldown(60);
    } catch (err) {
      const m = err?.response?.data?.message || err?.message || "Không thể gửi lại OTP lúc này.";
      setMsg({ type: "error", text: m });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    clearMsg();
    const vEmail = email.trim().toLowerCase();
    const vOtp = otp.trim();
    if (!vOtp) {
      setMsg({ type: "error", text: "Vui lòng nhập mã OTP." });
      return;
    }
    try {
      setLoading(true);
      const res = await api.post("/auth/password/verify", { email: vEmail, otp: vOtp });
      const token = res?.data?.resetToken;
      if (!token) throw new Error("Không nhận được resetToken.");
      setResetToken(token);
      setMsg({ type: "success", text: "Xác minh OTP thành công." });
      setStep("reset");
    } catch (err) {
      const m = err?.response?.data?.message || err?.message || "OTP không hợp lệ. Vui lòng thử lại.";
      setMsg({ type: "error", text: m });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    clearMsg();
    if (!newPassword || !confirmPassword) {
      setMsg({ type: "error", text: "Vui lòng nhập đủ mật khẩu mới và xác nhận." });
      return;
    }
    if (newPassword.length < 6) {
      setMsg({ type: "error", text: "Mật khẩu mới phải từ 6 ký tự." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMsg({ type: "error", text: "Xác nhận mật khẩu mới không khớp." });
      return;
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
      const m = err?.response?.data?.message || err?.message || "Không thể đặt lại mật khẩu.";
      setMsg({ type: "error", text: m });
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- UI ---------------- */
  const Alert = ({ type, children }) =>
    children ? <div className={`rp-alert ${type === "success" ? "rp-ok" : "rp-err"}`}>{children}</div> : null;

  const renderEmail = () => (
    <form className="rp-form" onSubmit={handleSendOtp}>
      <Alert type={msg.type}>{msg.text}</Alert>
      <div className="rp-group">
        <div className="rp-input-wrap">
          <input
            type="email"
            id="rp_email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={clearMsg}
            autoComplete="email"
          />
          <label htmlFor="rp_email">Email</label>
          <div className="rp-line"></div>
        </div>
      </div>
      <button className={`rp-btn ${loading ? "loading" : ""}`} type="submit" disabled={loading}>
        <span className="btn-text">Gửi OTP</span>
        <div className="btn-loader">
          <svg className="loader-circle" viewBox="0 0 50 50">
            <circle className="loader-path" cx="25" cy="25" r="12" fill="none" stroke="currentColor" strokeWidth="3" />
          </svg>
        </div>
      </button>
    </form>
  );

  const renderOtp = () => (
    <form className="rp-form" onSubmit={handleVerifyOtp}>
      <Alert type={msg.type}>{msg.text}</Alert>
      <div className="rp-group">
        <div className="rp-input-wrap">
          <input
            type="text"
            id="rp_otp"
            inputMode="numeric"
            maxLength={6}
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            onFocus={clearMsg}
          />
          <label htmlFor="rp_otp">Mã OTP (6 số)</label>
          <div className="rp-line"></div>
        </div>
      </div>

      <button className={`rp-btn ${loading ? "loading" : ""}`} type="submit" disabled={loading}>
        <span className="btn-text">Xác minh OTP</span>
        <div className="btn-loader">
          <svg className="loader-circle" viewBox="0 0 50 50">
            <circle className="loader-path" cx="25" cy="25" r="12" fill="none" stroke="currentColor" strokeWidth="3" />
          </svg>
        </div>
      </button>

      <div className="rp-actions">
        <button
          type="button"
          className="rp-link"
          onClick={handleResendOtp}
          disabled={loading || cooldown > 0}
        >
          {cooldown > 0 ? `Gửi lại OTP (${cooldown}s)` : "Gửi lại OTP"}
        </button>
      </div>
    </form>
  );

  const renderReset = () => (
    <form className="rp-form" onSubmit={handleResetPassword}>
      <Alert type={msg.type}>{msg.text}</Alert>

      <div className="rp-group">
        <div className="rp-input-wrap">
          <input
            type="password"
            id="rp_new"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            onFocus={clearMsg}
            autoComplete="new-password"
          />
          <label htmlFor="rp_new">Mật khẩu mới (≥ 6 ký tự)</label>
          <div className="rp-line"></div>
        </div>
      </div>

      <div className="rp-group">
        <div className="rp-input-wrap">
          <input
            type="password"
            id="rp_confirm"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onFocus={clearMsg}
            autoComplete="new-password"
          />
          <label htmlFor="rp_confirm">Xác nhận mật khẩu mới</label>
          <div className="rp-line"></div>
        </div>
      </div>

      <button className={`rp-btn ${loading ? "loading" : ""}`} type="submit" disabled={loading}>
        <span className="btn-text">Đặt mật khẩu mới</span>
        <div className="btn-loader">
          <svg className="loader-circle" viewBox="0 0 50 50">
            <circle className="loader-path" cx="25" cy="25" r="12" fill="none" stroke="currentColor" strokeWidth="3" />
          </svg>
        </div>
      </button>
    </form>
  );

  const renderDone = () => (
    <div className="rp-form">
      <Alert type={msg.type}>{msg.text}</Alert>
      <p className="rp-desc">
        Bạn đã đặt lại mật khẩu thành công cho email <b>{email}</b>. Hãy dùng mật khẩu mới để đăng nhập.
      </p>
    </div>
  );

  return (
    <div className="rp-container">
      <div className="rp-card">
        <button className="back-btn" onClick={() => nav(-1)} aria-label="Quay lại">
          <svg viewBox="0 0 24 24" className="back-icon">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor" />
          </svg>
        </button>

        <div className="rp-header">
          <div className="rp-logo">
            <div className="logo-layers">
              <div className="layer layer-1"></div>
              <div className="layer layer-2"></div>
              <div className="layer layer-3"></div>
            </div>
          </div>
          <h1>Cập nhật mật khẩu</h1>
          <p>Vui lòng nhập email của bạn. Chúng tôi sẽ gửi mã OTP để bạn đặt lại mật khẩu</p>
        </div>

        {step === "email" && renderEmail()}
        {step === "otp" && renderOtp()}
        {step === "reset" && renderReset()}
        {step === "done" && renderDone()}
      </div>
    </div>
  );
}
