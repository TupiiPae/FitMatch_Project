import React, { useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import { toast } from "react-toastify";
import "./Login.css";

import heroImg from "../../assets/fm-bg-login.png";
import bgImg from "../../assets/landing-bg.png";
import logoFitmatch from "../../assets/fm-logo-name.png";

// Validate giống pagesAdmin
const USERNAME_RE = /^[a-zA-Z0-9]{4,200}$/; // chữ + số, 4..200
const PASSWORD_RE = /^.{6,50}$/;            // mọi ký tự, 6..50

export default function Login() {
  const { login } = useAuth();

  const [username, setUsername]   = useState("");
  const [password, setPassword]   = useState("");
  const [showPass, setShowPass]   = useState(false);

  // lỗi field-level
  const [userErr, setUserErr]     = useState("");
  const [passErr, setPassErr]     = useState("");
  // lỗi chung (server)
  const [err, setErr]             = useState("");

  const [loading, setLoading]     = useState(false);

  const validateUsername = (v) => {
    const val = (v || "").trim();
    if (!val) { setUserErr("Vui lòng nhập tên tài khoản."); return false; }
    if (!USERNAME_RE.test(val)) {
      setUserErr("Username chỉ gồm chữ và số, từ 4–200 ký tự.");
      return false;
    }
    setUserErr(""); return true;
  };

  const validatePassword = (v) => {
    if (!v) { setPassErr("Vui lòng nhập mật khẩu."); return false; }
    if (!PASSWORD_RE.test(v)) {
      setPassErr("Mật khẩu 6–50 ký tự.");
      return false;
    }
    setPassErr(""); return true;
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");

    const okU = validateUsername(username);
    const okP = validatePassword(password);
    if (!okU || !okP) {
      toast.error("Kiểm tra lại các trường thông tin trước khi đăng nhập.");
      return;
    }

    setLoading(true);
    try {
      await login({ username: username.trim(), password });
      // Tránh trùng toast với SidebarLayout: đóng dấu đã hiển thị
      if (!sessionStorage.getItem("fm_toasted_login")) {
        toast.success("Đăng nhập thành công!");
        sessionStorage.setItem("fm_toasted_login", "1");
      }
    } catch (e2) {
      const msg = e2?.response?.data?.message || e2.message || "Đăng nhập thất bại";
      setErr(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
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
        "--panel-w": "minmax(340px, 36%)",
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
            {/* HEADER */}
            <div className="panel-header">
              <img src={logoFitmatch} alt="FitMatch" className="brand-logo-big" />
              <h2 className="sys-title">HỆ THỐNG QUẢN TRỊ DÀNH CHO</h2>
              <h2 className="sys-title">QUẢN TRỊ VIÊN <span>FIT</span>MATCH</h2>
            </div>

            <div className="login-title">
              <span>Đăng nhập</span>
              <p>với tư cách Quản Trị Viên</p>
            </div>

            <form className="login-form" onSubmit={submit} noValidate>
              {/* Username */}
              <div className={`field ${userErr ? "has-error" : ""}`}>
                <i className="ipt-icon fa-regular fa-user" aria-hidden="true"></i>
                <input
                  className={`auth-input with-icon ${userErr ? "input-invalid" : ""}`}
                  type="text"
                  placeholder="Nhập tên tài khoản"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); if (userErr) validateUsername(e.target.value); }}
                  onBlur={(e) => validateUsername(e.target.value)}
                  autoComplete="username"
                  aria-invalid={!!userErr}
                  aria-describedby={userErr ? "err-username" : undefined}
                  required
                />
              </div>
              {userErr && <div id="err-username" className="login-error-item">{userErr}</div>}

              {/* Password */}
              <div className={`field ${passErr ? "has-error" : ""}`}>
                <i className="ipt-icon fa-solid fa-lock" aria-hidden="true"></i>
                <input
                  className={`auth-input with-icon ${passErr ? "input-invalid" : ""}`}
                  type={showPass ? "text" : "password"}
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (passErr) validatePassword(e.target.value); }}
                  onBlur={(e) => validatePassword(e.target.value)}
                  autoComplete="current-password"
                  aria-invalid={!!passErr}
                  aria-describedby={passErr ? "err-password" : undefined}
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
              {passErr && <div id="err-password" className="login-error-item">{passErr}</div>}

              {/* Lỗi server (nếu có) */}
              {err && <div className="login-error-global">{err}</div>}

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
