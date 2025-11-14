import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../Style/AuthLayout";
import "../Style/style.css";
import api from "../../lib/api";
import { validateUsername, validateEmailGmail, validatePassword, validateConfirm } from "../../lib/validators";
import { toast } from "react-toastify";
import { useGoogleLogin } from "@react-oauth/google";

export default function Register() {
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");

  const [showPass, setShowPass] = useState(false);
  const [showCfm,  setShowCfm]  = useState(false);
  const [loading, setLoading]   = useState(false);

  const [errs, setErrs] = useState({
    username: "", email: "", password: "", confirm: "", global: ""
  });

  const runValidateAll = () => {
    const eUser = validateUsername(username);
    const eMail = validateEmailGmail(email);
    const ePass = validatePassword(password);
    const eCfm  = validateConfirm(password, confirm);
    const next  = { username: eUser, email: eMail, password: ePass, confirm: eCfm, global: "" };
    setErrs(next);
    return !Object.values(next).some(Boolean);
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    if (!runValidateAll()) return;
    setLoading(true);
    setErrs(prev => ({ ...prev, global: "" }));
    try {
      const { data } = await api.post("/auth/register", {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
        confirmPassword: confirm
      });

      if (data?.token) {
        localStorage.setItem("token", data.token);
        if (data.user?.role) localStorage.setItem("role", data.user.role);
      }
      toast.success("Đăng ký thành công!");
      if (data?.success || data?.token) {
        nav("/login");
      } else {
        setErrs(prev => ({ ...prev, global: data?.message || "Đăng ký thất bại." }));
      }
    } catch (error) {
      const status = error?.response?.status;
      const data   = error?.response?.data || {};
      if (status === 422 && data.errors) {
        const map = data.errors;
        setErrs(prev => ({
          username: map.username || prev.username,
          email:    map.email    || prev.email,
          password: map.password || prev.password,
          confirm:  map.confirm  || prev.confirm,
          global:   data.message || prev.global
        }));
      } else if (status === 409) {
        setErrs(prev => ({ ...prev, email: data.message || "Email đã được sử dụng" }));
      } else {
        setErrs(prev => ({ ...prev, global: data.message || "Đăng ký thất bại." }));
      }
    } finally {
      setLoading(false);
    }
  };

  // --- GOOGLE LOGIN (custom button) ---
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

  const renderSignIn = <div />;

  const renderSignUp = (
    <form className="auth-form" noValidate onSubmit={onSubmit} style={{ width:"100%", maxWidth: 520 }}>
      <div className="login-head">
        <img src="/images/logo-fitmatch.png" alt="FitMatch" className="login-logo-rect" />
        <h1>Đăng ký</h1>
      </div>

      <div className="auth-divider"><span>Nhập thông tin tài khoản</span></div>

      {/* Username */}
      <input
        className={`auth-input ${errs.username ? "input-invalid" : ""}`}
        type="text"
        id="reg-username"
        placeholder="Tên tài khoản"
        value={username}
        onChange={(e)=>setUsername(e.target.value)}
        onBlur={()=>setErrs(p=>({ ...p, username: validateUsername(username) }))}
        required autoComplete="username"
        maxLength={200}
      />
      <div className="error-stack" aria-live="polite">
        {errs.username && <span className="error-item">{errs.username}</span>}
      </div>

      {/* Email */}
      <input
        className={`auth-input ${errs.email ? "input-invalid" : ""}`}
        type="email"
        id="reg-email"
        placeholder="Email (@gmail.com)"
        value={email}
        onChange={(e)=>setEmail(e.target.value)}
        onBlur={()=>setErrs(p=>({ ...p, email: validateEmailGmail(email) }))}
        required autoComplete="email"
        maxLength={100}
      />
      <div className="error-stack" aria-live="polite">
        {errs.email && <span className="error-item">{errs.email}</span>}
      </div>

      {/* Password + eye */}
      <div className="field">
        <input
          className={`auth-input ${errs.password ? "input-invalid" : ""}`}
          type={showPass ? "text" : "password"}
          id="reg-password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          onBlur={()=>setErrs(p=>({ ...p, password: validatePassword(password) }))}
          required autoComplete="new-password"
          maxLength={200}
        />
        <button type="button" className="eye-toggle" onClick={()=>setShowPass(v=>!v)} aria-label="Hiện/ẩn mật khẩu">
          <i className={`fa-solid ${showPass ? "fa-eye-slash" : "fa-eye"}`}></i>
        </button>
      </div>
      <div className="error-stack" aria-live="polite">
        {errs.password && <span className="error-item">{errs.password}</span>}
      </div>

      {/* Confirm + eye */}
      <div className="field">
        <input
          className={`auth-input ${errs.confirm ? "input-invalid" : ""}`}
          type={showCfm ? "text" : "password"}
          id="reg-confirm"
          placeholder="Xác nhận mật khẩu"
          value={confirm}
          onChange={(e)=>setConfirm(e.target.value)}
          onBlur={()=>setErrs(p=>({ ...p, confirm: validateConfirm(password, confirm) }))}
          required autoComplete="new-password"
          maxLength={200}
        />
        <button type="button" className="eye-toggle" onClick={()=>setShowCfm(v=>!v)} aria-label="Hiện/ẩn mật khẩu">
          <i className={`fa-solid ${showCfm ? "fa-eye-slash" : "fa-eye"}`}></i>
        </button>
      </div>
      <div className="error-stack" aria-live="polite">
        {errs.confirm && <span className="error-item">{errs.confirm}</span>}
      </div>

      {/* Global error (nếu có) */}
      <div className="error-stack" aria-live="polite">
        {errs.global && <span className="error-item">{errs.global}</span>}
      </div>

      <button type="submit" className={`material-btn ${loading ? "loading" : ""}`} disabled={loading} style={{ marginTop: 6 }}>
        <span className="btn-text">Đăng ký</span>
      </button>

      <div className="auth-divider" style={{ marginTop: 20 }}><span>HOẶC</span></div>

      {/* GOOGLE – giữ nguyên UI, chỉ gắn handler */}
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

  return <AuthLayout mode="register" renderSignIn={<div />} renderSignUp={renderSignUp} />;
}
