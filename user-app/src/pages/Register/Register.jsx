import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../Style/AuthLayout";
import "../Style/style.css";
import api from "../../lib/api";
import { validateUsername, validateEmailGmail, validatePassword, validateConfirm } from "../../lib/validators";
import { toast } from "react-toastify";
import { useGoogleLogin } from "@react-oauth/google";

const OTP_TTL_SEC = Number(import.meta.env.VITE_OTP_TTL_SEC || 120);

function fmtMMSS(s) {
  const mm = Math.floor(Math.max(0, s) / 60);
  const ss = Math.max(0, s) % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export default function Register() {
  const nav = useNavigate();

  const [step, setStep] = useState("form");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [otp, setOtp] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [showCfm, setShowCfm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [cooldown, setCooldown] = useState(0);
  const [otpLeft, setOtpLeft] = useState(0);

  const [errs, setErrs] = useState({
    username: "", email: "", password: "", confirm: "", global: ""
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    if (otpLeft <= 0) return;
    const t = setInterval(() => setOtpLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [otpLeft]);

  const runValidateAll = () => {
    const eUser = validateUsername(username);
    const eMail = validateEmailGmail(email);
    const ePass = validatePassword(password);
    const eCfm = validateConfirm(password, confirm);
    const next = { username: eUser, email: eMail, password: ePass, confirm: eCfm, global: "" };
    setErrs(next);
    return !Object.values(next).some(Boolean);
  };

  const sendRegisterOtp = async (isResend = false) => {
    const v = email.trim().toLowerCase();
    if (!v) {
      setErrs((p) => ({ ...p, global: "Vui lòng nhập email." }));
      return;
    }
    try {
      setLoading(true);
      setErrs((p) => ({ ...p, global: "" }));
      const url = isResend ? "/auth/register/otp/resend" : "/auth/register/otp";
      const res = await api.post(url, { email: v });
      setCooldown(60);
      setOtpLeft(OTP_TTL_SEC);
      toast.success(res?.data?.message || "OTP đăng ký đã được gửi.");
      setStep("otp");
    } catch (e) {
      const status = e?.response?.status;
      const m = e?.response?.data?.message || e?.message || "Không thể gửi OTP lúc này.";
      if (status === 409) {
        setErrs((p) => ({ ...p, email: m || "Email đã được sử dụng." }));
      } else {
        setErrs((p) => ({ ...p, global: m }));
      }
    } finally {
      setLoading(false);
    }
  };

  const onSubmitForm = async (ev) => {
    ev.preventDefault();
    if (!runValidateAll()) return;
    await sendRegisterOtp(false);
  };

  const onVerifyAndRegister = async (ev) => {
    ev.preventDefault();
    if (!runValidateAll()) return;

    const vOtp = otp.trim();
    if (!/^\d{4}$/.test(vOtp)) {
      setErrs((p) => ({ ...p, global: "OTP phải gồm 4 chữ số." }));
      return;
    }

    setLoading(true);
    setErrs((p) => ({ ...p, global: "" }));

    try {
      const { data } = await api.post("/auth/register", {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword: confirm,
        otp: vOtp,
      });

      if (data?.token) {
        localStorage.setItem("token", data.token);
        if (data.user?.role) localStorage.setItem("role", data.user.role);
      }

      toast.success("Đăng ký thành công!");
      if (data?.success || data?.token) nav("/login");
      else setErrs((p) => ({ ...p, global: data?.message || "Đăng ký thất bại." }));
    } catch (error) {
      const status = error?.response?.status;
      const data = error?.response?.data || {};
      if (status === 422 && data.errors) {
        const map = data.errors;
        setErrs((prev) => ({
          username: map.username || prev.username,
          email: map.email || prev.email,
          password: map.password || prev.password,
          confirm: map.confirm || prev.confirm,
          global: data.message || prev.global,
        }));
      } else if (status === 409) {
        setErrs((p) => ({ ...p, email: data.message || "Email đã được sử dụng" }));
      } else {
        setErrs((p) => ({ ...p, global: data.message || "Đăng ký thất bại." }));
      }
    } finally {
      setLoading(false);
    }
  };

  const startGoogleLogin = useGoogleLogin({
    flow: "implicit",
    scope: "openid email profile",
    onSuccess: async (resp) => {
      try {
        const { data } = await api.post("/auth/google", {
          access_token: resp?.access_token || null,
          credential: resp?.credential || null,
          code: resp?.code || null,
        });
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.user?.role || "user");
        localStorage.setItem("onboarded", data.user?.onboarded ? "1" : "0");
        toast.success("Đăng ký/Đăng nhập bằng Google thành công!");
        if (data.user?.onboarded) nav("/home"); else nav("/onboarding");
      } catch (e) {
        toast.error(e?.response?.data?.message || "Đăng nhập Google thất bại.");
      }
    },
    onError: () => toast.error("Google Đăng ký/Đăng nhập thất bại"),
  });

  function handleSocialRipple(e) {
    const btn = e.currentTarget;
    const ripple = btn.querySelector(".social-ripple");
    if (!ripple) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    ripple.style.setProperty("--ripple-x", `${x}px`);
    ripple.style.setProperty("--ripple-y", `${y}px`);
    ripple.style.setProperty("--ripple-size", `${size}px`);
    ripple.classList.remove("is-animating");
    void ripple.offsetWidth;
    ripple.classList.add("is-animating");
  }

  function onClickGoogle(e) {
    handleSocialRipple(e);
    startGoogleLogin();
  }

  const renderOtpStep = (
    <form className="auth-form" noValidate onSubmit={onVerifyAndRegister} style={{ width: "100%", maxWidth: 520 }}>
      <div className="login-head">
        <img src="/images/fm-logo-name.png" alt="FitMatch" className="login-logo-rect" />
        <h1>Xác thực email</h1>
      </div>

      <div className="auth-divider"><span>Nhập OTP đã gửi tới</span></div>

      <input
        className={`auth-input ${errs.global ? "input-invalid" : ""}`}
        type="text"
        placeholder="Mã OTP (4 số)"
        inputMode="numeric"
        maxLength={4}
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        onFocus={() => setErrs((p) => ({ ...p, global: "" }))}
        required
      />

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "var(--field-w)", maxWidth: "100%", marginTop: -10,
      }}>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          {otpLeft > 0 ? `Mã hết hạn sau: ${fmtMMSS(otpLeft)}` : "OTP đã hết hạn — vui lòng gửi lại"}
        </div>
        <button
          type="button"
          className="btn btn-text btn-resetpwd"
          onClick={() => sendRegisterOtp(true)}
          disabled={loading || cooldown > 0}
          style={{ fontSize: 12 }}
        >
          {cooldown > 0 ? `Gửi lại OTP (${cooldown}s)` : "Gửi lại OTP"}
        </button>
      </div>

      <div className="error-stack" aria-live="polite">
        {errs.global && <span className="error-item">{errs.global}</span>}
      </div>

      <button type="submit" className={`material-btn ${loading ? "loading" : ""}`} disabled={loading} style={{ marginTop: 6 }}>
        <span className="btn-text">Xác nhận</span>
        <div className="btn-loader"></div>
      </button>

      <div className="forgot-row" style={{ marginTop: 10, justifyContent: "space-between" }}>
        <button type="button" className="btn btn-text" onClick={() => { setStep("form"); setOtp(""); setErrs((p) => ({ ...p, global: "" })); }}>
          Quay lại
        </button>
        <button type="button" className="btn btn-text" onClick={() => nav("/login")}>
          Đăng nhập
        </button>
      </div>
    </form>
  );

  const renderFormStep = (
    <form className="auth-form" noValidate onSubmit={onSubmitForm} style={{ width: "100%", maxWidth: 520 }}>
      <div className="login-head">
        <img src="/images/fm-logo-name.png" alt="FitMatch" className="login-logo-rect" />
        <h1>Đăng ký</h1>
      </div>

      <div className="auth-divider"><span>Nhập thông tin tài khoản</span></div>

      <input
        className={`auth-input ${errs.username ? "input-invalid" : ""}`}
        type="text"
        id="reg-username"
        placeholder="Tên tài khoản"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        onBlur={() => setErrs((p) => ({ ...p, username: validateUsername(username) }))}
        required
        autoComplete="username"
        maxLength={200}
      />
      <div className="error-stack" aria-live="polite">
        {errs.username && <span className="error-item">{errs.username}</span>}
      </div>

      <input
        className={`auth-input ${errs.email ? "input-invalid" : ""}`}
        type="email"
        id="reg-email"
        placeholder="Email (@gmail.com)"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => setErrs((p) => ({ ...p, email: validateEmailGmail(email) }))}
        required
        autoComplete="email"
        maxLength={100}
      />
      <div className="error-stack" aria-live="polite">
        {errs.email && <span className="error-item">{errs.email}</span>}
      </div>

      <div className="field">
        <input
          className={`auth-input ${errs.password ? "input-invalid" : ""}`}
          type={showPass ? "text" : "password"}
          id="reg-password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setErrs((p) => ({ ...p, password: validatePassword(password) }))}
          required
          autoComplete="new-password"
          maxLength={200}
        />
        <button type="button" className="eye-toggle" onClick={() => setShowPass((v) => !v)} aria-label="Hiện/ẩn mật khẩu">
          <i className={`fa-solid ${showPass ? "fa-eye-slash" : "fa-eye"}`}></i>
        </button>
      </div>
      <div className="error-stack" aria-live="polite">
        {errs.password && <span className="error-item">{errs.password}</span>}
      </div>

      <div className="field">
        <input
          className={`auth-input ${errs.confirm ? "input-invalid" : ""}`}
          type={showCfm ? "text" : "password"}
          id="reg-confirm"
          placeholder="Xác nhận mật khẩu"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onBlur={() => setErrs((p) => ({ ...p, confirm: validateConfirm(password, confirm) }))}
          required
          autoComplete="new-password"
          maxLength={200}
        />
        <button type="button" className="eye-toggle" onClick={() => setShowCfm((v) => !v)} aria-label="Hiện/ẩn mật khẩu">
          <i className={`fa-solid ${showCfm ? "fa-eye-slash" : "fa-eye"}`}></i>
        </button>
      </div>
      <div className="error-stack" aria-live="polite">
        {errs.confirm && <span className="error-item">{errs.confirm}</span>}
      </div>

      <div className="error-stack" aria-live="polite">
        {errs.global && <span className="error-item">{errs.global}</span>}
      </div>

      <button type="submit" className={`material-btn ${loading ? "loading" : ""}`} disabled={loading} style={{ marginTop: 6 }}>
        <span className="btn-text">Đăng ký</span>
        <div className="btn-loader"></div>
      </button>

      <div className="auth-divider" style={{ marginTop: 20 }}><span>HOẶC</span></div>

      <div className="social-login">
        <button
          type="button"
          className="social-btn google-material"
          onClick={onClickGoogle}
          aria-label="Tiếp tục với Google"
        >
          <div className="social-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>
          <span>&ensp;Đăng ký với Google</span>
          <span className="social-ripple" aria-hidden="true"></span>
        </button>
      </div>
    </form>
  );

  return <AuthLayout mode="register" renderSignIn={<div />} renderSignUp={step === "otp" ? renderOtpStep : renderFormStep} />;
}
