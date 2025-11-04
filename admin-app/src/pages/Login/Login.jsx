// src/pages/Login/Login.jsx
import React, { useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import "./Login.css";

import heroImg from "../../assets/bg-adm-fitmatch.png";
import bgImg from "../../assets/landing-bg.png";
import logoFitmatch from "../../assets/logo-fitmatch.png";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try { await login({ username, password }); }
    catch (e2) { setErr(e2?.response?.data?.message || e2.message || "Đăng nhập thất bại"); }
    finally { setLoading(false); }
  };

  return (
    <div
      className="login-page"
      style={{
        "--login-hero": `url(${heroImg})`,
        "--login-bg": `url(${bgImg})`,
        "--brand": "#008080",
        "--brand-2": "#78BCC4",
        "--radius-card": "24px",
        "--radius-panel": "18px",
        "--panel-w": "minmax(340px, 36%)", // ~1/3 card
      }}
    >
      <div className="login-bg" />

      <div className="login-card">
        {/* HERO LEFT */}
        <div className="hero-left">
          <img src={heroImg} alt="" className="hero-img-el" />
          <div className="hero-content"></div>
        </div>

        {/* PANEL RIGHT */}
        <div className="panel-right">
          <div className="panel-wrap">
            {/* HEADER: Logo + System Title */}
            <div className="panel-header">
              <img src={logoFitmatch} alt="FitMatch" className="brand-logo-big" />
              <h2 className="sys-title">HỆ THỐNG QUẢN TRỊ DÀNH CHO</h2>
              <h2 className="sys-title">QUẢN TRỊ VIÊN FITMATCH</h2>
            </div>

            {/* Login title */}
            <div className="login-title">
              <span>Đăng nhập</span>
              <p>với tư cách Quản Trị Viên</p>
            </div>

            <form className="login-form" onSubmit={submit} noValidate>
              {/* Username */}
              <div className="field">
                <i className="ipt-icon fa-regular fa-user" aria-hidden="true"></i>
                <input
                  className="auth-input with-icon"
                  type="text"
                  placeholder="Nhập tên tài khoản"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              {/* Password */}
              <div className="field">
                <i className="ipt-icon fa-solid fa-lock" aria-hidden="true"></i>
                <input
                  className="auth-input with-icon"
                  type={showPass ? "text" : "password"}
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="eye-toggle"
                  onClick={() => setShowPass(v => !v)}
                  aria-label={showPass ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  <i className={`fa-solid ${showPass ? "fa-eye-slash" : "fa-eye"}`} />
                </button>
              </div>

              {err && <div className="login-error">{err}</div>}

              <button className="login-btn" disabled={loading}>
                {loading ? "Đang đăng nhập..." : "Đăng nhập"}
              </button>
            </form>

            <div className="login-copy">© {new Date().getFullYear()} FitMatch</div>
          </div>
        </div>
      </div>
    </div>
  );
}
