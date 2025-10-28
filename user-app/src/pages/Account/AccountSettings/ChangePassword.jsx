import React, { useEffect, useState } from "react";
import api from "../../../lib/api"; // đảm bảo đúng path
import "./ChangePassword.css";

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

  // resend cooldown
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const clearMsg = () => setMsg({ type: "", text: "" });

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
    const vEmail = email.trim().toLowerCase();
    const vOtp = otp.trim();
    if (!vOtp) {
      setMsg({ type: "error", text: "Vui lòng nhập mã OTP." });
      return;
    }
    try {
      setLoading(true);
      const res = await api.post("/auth/password/verify", {
        email: vEmail,
        otp: vOtp,
      });
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
      setMsg({
        type: "success",
        text: res?.data?.message || "Đặt lại mật khẩu thành công.",
      });
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
    // Không bọc .acc-page ở đây; scope đã ở layout (.pf-content.acc-page)
    <div className="acc-card card">
      <h2 className="pf-title">Thay đổi mật khẩu</h2>

      <div className="cp-wrap">
        <div className="cp-block">
          <div className="cp-subtitle">Quên mật khẩu</div>
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
                <button className="btn-success cp-send" type="submit" disabled={loading}>
                  {loading ? "Đang xác minh..." : "Xác minh OTP"}
                </button>
              </form>

              <div className="cp-resend-row">
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading || cooldown > 0}
                >
                  {cooldown > 0 ? `Gửi lại OTP (${cooldown}s)` : "Gửi lại OTP"}
                </button>
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
                {loading ? "Đang đặt lại..." : "Đặt mật khẩu mới"}
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
                Bạn đã đặt lại mật khẩu thành công. Vui lòng dùng mật khẩu mới cho lần đăng
                nhập tiếp theo.
              </p>
              <div className="cp-resend-row">
                <button
                  className="btn-success"
                  type="button"
                  onClick={() => {
                    // reset form nếu muốn bắt đầu lại
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
