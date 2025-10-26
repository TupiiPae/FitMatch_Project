import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../Style/AuthLayout";
import "../Style/style.css";
import { api } from "../../lib/api";

export default function Register() {
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showCfm,  setShowCfm]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState({}); // { single, global }

  const validate = () => {
    if (!username.trim() || !email.trim() || !password || !confirm) {
      setErr({ single: "Vui lòng nhập đầy đủ các trường" });
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr({ single: "Định dạng email không hợp lệ" });
      return false;
    }
    if (password.length < 6) { setErr({ single: "Mật khẩu phải có ít nhất 6 ký tự" }); return false; }
    if (confirm !== password) { setErr({ single: "Mật khẩu xác nhận không khớp" }); return false; }
    setErr({}); return true;
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", {
        username, email, password, confirmPassword: confirm
      });
      if (data?.token) {
        localStorage.setItem("token", data.token);
        if (data.user?.role) localStorage.setItem("role", data.user.role);
      }
      if (data?.success || data?.token) nav("/login");
      else setErr({ global: data?.message || "Đăng ký thất bại." });
    } catch (error) {
      setErr({ global: error?.response?.data?.message || "Đăng ký thất bại." });
    } finally { setLoading(false); }
  };

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

  const renderSignIn = <div />;

  const renderSignUp = (
    <form className="auth-form" noValidate onSubmit={onSubmit} style={{ width:"100%", maxWidth: 520 }}>
      {/* Logo TRÊN tiêu đề */}
      <div className="login-head">
        <img src="/images/logo-fitmatch.png" alt="FitMatch" className="login-logo-rect" />
        <h1>Đăng ký</h1>
      </div>

      {/* Username */}
      <input
        className="auth-input"
        type="text"
        id="reg-username"
        placeholder="Tên tài khoản"
        value={username}
        onChange={(e)=>setUsername(e.target.value)}
        required autoComplete="username"
      />

      {/* Email */}
      <input
        className="auth-input"
        type="email"
        id="reg-email"
        placeholder="Email"
        value={email}
        onChange={(e)=>setEmail(e.target.value)}
        required autoComplete="email"
      />

      {/* Password + eye */}
      <div className="field">
        <input
          className="auth-input"
          type={showPass ? "text" : "password"}
          id="reg-password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          required autoComplete="new-password"
        />
        <button type="button" className="eye-toggle" onClick={()=>setShowPass(v=>!v)} aria-label="Hiện/ẩn mật khẩu">
          <i className={`fa-solid ${showPass ? "fa-eye-slash" : "fa-eye"}`}></i>
        </button>
      </div>

      {/* Confirm + eye */}
      <div className="field">
        <input
          className="auth-input"
          type={showCfm ? "text" : "password"}
          id="reg-confirm"
          placeholder="Xác nhận mật khẩu"
          value={confirm}
          onChange={(e)=>setConfirm(e.target.value)}
          required autoComplete="new-password"
        />
        <button type="button" className="eye-toggle" onClick={()=>setShowCfm(v=>!v)} aria-label="Hiện/ẩn mật khẩu">
          <i className={`fa-solid ${showCfm ? "fa-eye-slash" : "fa-eye"}`}></i>
        </button>
      </div>

      <div className="error-stack" aria-live="polite">
        {err.single && <span className="error-item">{err.single}</span>}
        {err.global && <span className="error-item">{err.global}</span>}
      </div>

      {/* Nút Đăng ký — rộng bằng ô nhập */}
      <button type="submit" className={`material-btn ${loading ? "loading" : ""}`} disabled={loading} style={{ marginTop: 6 }}>
        <span className="btn-text">Đăng ký</span>
      </button>

      {/* Divider & Social */}
      <div className="auth-divider"><span>HOẶC</span></div>

      <div className="social-login">
        <button type="button" className="social-btn google-material" onClick={handleSocialRipple} aria-label="Tiếp tục với Google">
          <div className="social-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          </div>
          <span>Google</span>
          <span className="social-ripple" aria-hidden="true"></span>
        </button>

        <button type="button" className="social-btn facebook-material" onClick={handleSocialRipple} aria-label="Tiếp tục với Facebook">
          <div className="social-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="12" fill="#1877F2"/>
              <g transform="translate(12 12) scale(1.7) translate(-12 -12)">
                <path fill="#FFF" d="M13.3 19v-5.5h1.86l.28-2.15H13.3V9.84c0-.62.17-1.04 1.06-1.04h1.13V6.86c-.2-.03-.9-.08-1.7-.08-1.68 0-2.83 1.02-2.83 2.9v1.62H8.9v2.15h1.96V19h2.44z"/>
              </g>
            </svg>
          </div>
          <span>Facebook</span>
          <span className="social-ripple" aria-hidden="true"></span>
        </button>
      </div>
    </form>
  );

  return <AuthLayout mode="register" renderSignIn={renderSignIn} renderSignUp={renderSignUp} />;
}
