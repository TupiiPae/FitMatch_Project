import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../Style/AuthLayout";
import "../Style/style.css";
import api from "../../lib/api";

export default function ResetPassword() {
  const nav = useNavigate();

  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });
  const clearMsg = () => setMsg({ type: "", text: "" });

  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleSendOtp = async (e) => {
    e.preventDefault(); clearMsg();
    const v = email.trim().toLowerCase();
    if (!v) { setMsg({ type: "error", text: "Vui lòng nhập email." }); return; }
    try {
      setLoading(true);
      const res = await api.post("/auth/password/forgot", { email: v });
      setMsg({ type: "success", text: res?.data?.message || "Email hợp lệ, OTP đã được gửi." });
      setCooldown(60); setStep("otp");
    } catch (err) {
      const m = err?.response?.data?.message || err?.message || "Không thể gửi OTP. Vui lòng thử lại.";
      setMsg({ type: "error", text: m });
    } finally { setLoading(false); }
  };

  const handleResendOtp = async () => {
    clearMsg(); const v = email.trim().toLowerCase();
    if (!v) { setMsg({ type: "error", text: "Vui lòng nhập email trước khi gửi lại OTP." }); return; }
    if (cooldown > 0) return;
    try {
      setLoading(true);
      const res = await api.post("/auth/password/resend", { email: v });
      setMsg({ type: "success", text: res?.data?.message || "OTP đã được gửi (nếu email hợp lệ)." });
      setCooldown(60);
    } catch (err) {
      const m = err?.response?.data?.message || err?.message || "Không thể gửi lại OTP lúc này.";
      setMsg({ type: "error", text: m });
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault(); clearMsg();
    const vEmail = email.trim().toLowerCase();
    const vOtp = otp.trim();
    if (!vOtp) { setMsg({ type: "error", text: "Vui lòng nhập mã OTP." }); return; }
    try {
      setLoading(true);
      const res = await api.post("/auth/password/verify", { email: vEmail, otp: vOtp });
      const token = res?.data?.resetToken;
      if (!token) throw new Error("Không nhận được resetToken.");
      setResetToken(token); setMsg({ type: "success", text: "Xác minh OTP thành công." }); setStep("reset");
    } catch (err) {
      const m = err?.response?.data?.message || err?.message || "OTP không hợp lệ. Vui lòng thử lại.";
      setMsg({ type: "error", text: m });
    } finally { setLoading(false); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault(); clearMsg();
    if (!newPassword || !confirmPassword) { setMsg({ type:"error", text:"Vui lòng nhập đủ mật khẩu mới và xác nhận." }); return; }
    if (newPassword.length < 6) { setMsg({ type:"error", text:"Mật khẩu mới phải từ 6 ký tự." }); return; }
    if (newPassword !== confirmPassword) { setMsg({ type:"error", text:"Xác nhận mật khẩu mới không khớp." }); return; }
    try {
      setLoading(true);
      const res = await api.post("/auth/password/reset", { email: email.trim().toLowerCase(), resetToken, newPassword });
      setMsg({ type: "success", text: res?.data?.message || "Đặt lại mật khẩu thành công." });
      setOtp(""); setNewPassword(""); setConfirmPassword(""); setStep("done");
    } catch (err) {
      const m = err?.response?.data?.message || err?.message || "Không thể đặt lại mật khẩu.";
      setMsg({ type: "error", text: m });
    } finally { setLoading(false); }
  };

  const Alert = () =>
    msg.text ? (
      <span className="error-message" style={{ color: msg.type === "success" ? "#166534" : "#dc2626" }}>
        {msg.text}
      </span>
    ) : null;

  const renderEmail = (
    <form className="auth-form" onSubmit={handleSendOtp} style={{ width:"100%", maxWidth:520 }}>
      <h1>Cập nhật mật khẩu</h1>
      <span>Nhập email để nhận mã OTP</span>

      <input className="auth-input" type="email" id="rp_email" placeholder="Email"
             value={email} onChange={(e)=>setEmail(e.target.value)} onFocus={clearMsg}
             required autoComplete="email" />
      <Alert />

      <button className={`material-btn ${loading ? "loading" : ""}`} type="submit" disabled={loading} style={{ marginTop: 6 }}>
        <span className="btn-text">Gửi OTP</span>
        <div className="btn-loader"></div>
      </button>
    </form>
  );

  const renderOtp = (
    <form className="auth-form" onSubmit={handleVerifyOtp} style={{ width:"100%", maxWidth:520 }}>
      <h1>Xác minh OTP</h1>
      <span>Nhập mã OTP đã gửi tới email</span>

      <input className="auth-input" type="text" id="rp_otp" placeholder="Mã OTP (6 số)"
             inputMode="numeric" maxLength={6} value={otp} onChange={(e)=>setOtp(e.target.value)} onFocus={clearMsg} required />
      <Alert />

      <button className={`material-btn ${loading ? "loading" : ""}`} type="submit" disabled={loading} style={{ marginTop: 6 }}>
        <span className="btn-text">Xác minh OTP</span>
        <div className="btn-loader"></div>
      </button>

      <div style={{ display:"flex", gap:16, marginTop: 8 }}>
        <button type="button" className="btn btn-text" onClick={handleResendOtp} disabled={loading || cooldown>0}>
          {cooldown>0 ? `Gửi lại OTP (${cooldown}s)` : "Gửi lại OTP"}
        </button>
        <button type="button" className="btn btn-text" onClick={()=>nav("/login")}>Quay lại Đăng nhập</button>
      </div>
    </form>
  );

  const renderReset = (
    <form className="auth-form" onSubmit={handleResetPassword} style={{ width:"100%", maxWidth:520 }}>
      <h1>Đặt mật khẩu mới</h1>
      <span>Nhập mật khẩu mới cho tài khoản</span>

      <input className="auth-input" type="password" id="rp_new" placeholder="Mật khẩu mới (≥ 6 ký tự)"
             value={newPassword} onChange={(e)=>setNewPassword(e.target.value)} onFocus={clearMsg} required autoComplete="new-password" />
      <input className="auth-input" type="password" id="rp_confirm" placeholder="Xác nhận mật khẩu mới"
             value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} onFocus={clearMsg} required autoComplete="new-password" />
      <Alert />

      <button className={`material-btn ${loading ? "loading" : ""}`} type="submit" disabled={loading} style={{ marginTop: 6 }}>
        <span className="btn-text">Đặt mật khẩu mới</span>
        <div className="btn-loader"></div>
      </button>
    </form>
  );

  const renderDone = (
    <div className="auth-form" style={{ width:"100%", maxWidth:520 }}>
      <h1>Hoàn tất</h1>
      <p style={{ textAlign:"center" }}>
        Bạn đã đặt lại mật khẩu cho <b>{email}</b>. Hãy dùng mật khẩu mới để đăng nhập.
      </p>
      <button type="button" className="material-btn" onClick={()=>nav("/login")} style={{ marginTop: 6 }}>
        <span className="btn-text">Đăng nhập</span>
      </button>
    </div>
  );

  const renderSignIn = <div />;
  const renderSignUp =
    step === "email" ? renderEmail :
    step === "otp"   ? renderOtp   :
    step === "reset" ? renderReset : renderDone;

  return <AuthLayout mode="reset" renderSignIn={renderSignIn} renderSignUp={renderSignUp} />;
}
