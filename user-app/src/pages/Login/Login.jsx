import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import { api } from "../../lib/api";

export default function Login() {
  const nav = useNavigate();

  // ====== STATE ======
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ghiNho, setGhiNho] = useState(false);
  const [loading, setLoading] = useState(false);

  const [usernameErr, setUsernameErr] = useState("");
  const [passwordErr, setPasswordErr] = useState("");

  const usernameRippleRef = useRef(null);
  const passRippleRef = useRef(null);
  const passToggleRef = useRef(null);
  const btnRippleRef = useRef(null);
  const toggleIconRef = useRef(null);

  // ====== NÚT QUAY LẠI ======
  const handleBack = () => {
    if (window.history.length > 1) nav(-1);
    else nav("/");
  };

  // ====== KIỂM TRA DỮ LIỆU ======
  const validateUsername = () => {
    const v = username.trim();
    if (!v) {
      setUsernameErr("Vui lòng nhập tên tài khoản");
      return false;
    }
    setUsernameErr("");
    return true;
  };

  const validatePassword = () => {
    if (!password) {
      setPasswordErr("Vui lòng nhập mật khẩu");
      return false;
    }
    if (password.length < 6) {
      setPasswordErr("Mật khẩu phải có ít nhất 6 ký tự");
      return false;
    }
    setPasswordErr("");
    return true;
  };

  // ====== HIỆU ỨNG RIPPLE ======
  const createRipple = (e, container) => {
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    const div = document.createElement("div");
    div.className = "ripple";
    div.style.width = `${size}px`;
    div.style.height = `${size}px`;
    div.style.left = `${x}px`;
    div.style.top = `${y}px`;
    container.appendChild(div);
    setTimeout(() => div.remove(), 600);
  };

  // ====== XỬ LÝ SUBMIT ======
  const onSubmit = async (e) => {
    e.preventDefault();
    const okUser = validateUsername();
    const okPass = validatePassword();
    if (!okUser || !okPass) return;

    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", {
        username,            // hoặc identifier nếu bạn dùng trường này
        password,
        remember: ghiNho,
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.user?.role || "user");
      localStorage.setItem("onboarded", data.user?.onboarded ? "1" : "0");

      if (data.user?.onboarded) nav("/home");   // hoặc "/Home" nếu route của bạn viết hoa
      else nav("/onboarding");
    } catch (err) {
      const msg = err?.response?.data?.message || "Đăng nhập thất bại. Vui lòng thử lại.";
      setPasswordErr(msg);
    } finally {
      setLoading(false);
    }
  };

  // ====== BẬT / TẮT MẬT KHẨU ======
  const onTogglePassword = (e) => {
    createRipple(e, passToggleRef.current?.querySelector(".toggle-ripple"));
    const input = document.getElementById("password");
    if (!input) return;
    const isText = input.type === "text";
    input.type = isText ? "password" : "text";
    toggleIconRef.current?.classList.toggle("show-password", !isText);
  };

  // ====== FOCUS RIPPLE ======
  useEffect(() => {
    const userInput = document.getElementById("username");
    const passInput = document.getElementById("password");
    const focusRipple = (ref) => (e) => createRipple(e, ref?.current);
    userInput?.addEventListener("focus", focusRipple(usernameRippleRef));
    passInput?.addEventListener("focus", focusRipple(passRippleRef));
    return () => {
      userInput?.removeEventListener("focus", focusRipple(usernameRippleRef));
      passInput?.removeEventListener("focus", focusRipple(passRippleRef));
    };
  }, []);

  // ====== RENDER ======
  return (
    <div className="login-container">
      <div className="login-card">
        {/* Nút quay lại */}
        <button className="back-btn" onClick={handleBack} aria-label="Quay lại">
          <svg viewBox="0 0 24 24" className="back-icon">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill="currentColor" />
          </svg>
        </button>

        <div className="login-header">
          <div className="material-logo">
            <div className="logo-layers">
              <div className="layer layer-1"></div>
              <div className="layer layer-2"></div>
              <div className="layer layer-3"></div>
            </div>
          </div>
          <h2>Đăng nhập</h2>
          <p>để tiếp tục vào tài khoản của bạn</p>
        </div>

        {/* FORM */}
        <form className="login-form" id="loginForm" onSubmit={onSubmit} noValidate>
          <div className={`form-group ${usernameErr ? "error" : ""}`}>
            <div className="input-wrapper">
              <input
                type="text"
                id="username"
                name="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={validateUsername}
                autoComplete="username"
              />
              <label htmlFor="username">Tên tài khoản</label>
              <div className="input-line"></div>
              <div className="ripple-container" ref={usernameRippleRef}></div>
            </div>
            <span className={`error-message ${usernameErr ? "show" : ""}`}>{usernameErr}</span>
          </div>

          <div className={`form-group ${passwordErr ? "error" : ""}`}>
            <div className="input-wrapper password-wrapper">
              <input
                type="password"
                id="password"
                name="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={validatePassword}
              />
              <label htmlFor="password">Mật khẩu</label>
              <div className="input-line"></div>
              <button
                type="button"
                className="password-toggle"
                onClick={onTogglePassword}
                ref={passToggleRef}
              >
                <div className="toggle-ripple"></div>
                <span className="toggle-icon" ref={toggleIconRef}></span>
              </button>
              <div className="ripple-container" ref={passRippleRef}></div>
            </div>
            <span className={`error-message ${passwordErr ? "show" : ""}`}>{passwordErr}</span>
          </div>

          <div className="form-options">
            <label className="checkbox-wrapper">
              <input
                type="checkbox"
                checked={ghiNho}
                onChange={(e) => setGhiNho(e.target.checked)}
              />
              <span className="checkbox-label">
                <span className="checkbox-material">
                  <span className="checkbox-ripple"></span>
                  <svg className="checkbox-icon" viewBox="0 0 24 24">
                    <path className="checkbox-path" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </span>
                Ghi nhớ đăng nhập
              </span>
            </label>

            <button type="button" className="forgot-password" onClick={() => nav("/quen-mat-khau")}>
              Quên mật khẩu?
            </button>
          </div>

          <button
            id="loginSubmitBtn"
            type="submit"
            className={`login-btn material-btn ${loading ? "loading" : ""}`}
            onClick={(e) => createRipple(e, btnRippleRef.current)}
            disabled={loading}
          >
            <div className="btn-ripple" ref={btnRippleRef}></div>
            <span className="btn-text">Đăng nhập</span>
            <div className="btn-loader">
              <svg className="loader-circle" viewBox="0 0 50 50">
                <circle className="loader-path" cx="25" cy="25" r="12" fill="none" stroke="currentColor" strokeWidth="3" />
              </svg>
            </div>
          </button>
        </form>

        <div className="divider"><span>hoặc</span></div>

        <div className="social-login">
          <button type="button" className="social-btn google-material">
            <div className="social-icon google-icon">
              <svg viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <span>Tiếp tục với Google</span>
          </button>

          <button type="button" className="social-btn facebook-material">
            <div className="social-icon facebook-icon">
              <svg viewBox="0 0 24 24">
                <path fill="#1877F2" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <span>Tiếp tục với Facebook</span>
          </button>
        </div>

        <div className="signup-link">
          <p>
            Chưa có tài khoản?{" "}
            <button className="create-account" onClick={() => nav("/register")}>
              Tạo tài khoản
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
