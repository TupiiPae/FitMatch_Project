import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../Style/AuthLayout";
import "../Style/style.css";
import api from "../../lib/api";
import { toast } from "react-toastify";
import { useGoogleLogin } from "@react-oauth/google";
import BlockedPopup from "../../components/BlockedPopup";

export default function Login() {
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const [usernameErr, setUsernameErr] = useState("");
  const [passwordErr, setPasswordErr] = useState("");

  // popup blocked
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [blockedReason, setBlockedReason] = useState("");

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

  async function onSubmit(e) {
    e.preventDefault();
    setUsernameErr("");
    setPasswordErr("");
    if (!validateUsername() || !validatePassword()) return;

    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", {
        identifier: username.trim(),
        password,
        remember: false,
      });
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.user?.role || "user");
      localStorage.setItem("onboarded", data.user?.onboarded ? "1" : "0");
      toast.success("Đăng nhập thành công!");
      if (data.user?.onboarded) nav("/home");
      else nav("/onboarding");
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data || {};
      // ⚠️ Bắt cả 423 (Locked) và 403 (có trường blocked)
      if (status === 423 || (status === 403 && data?.blocked)) {
        toast.error("Đăng nhập không thành công");
        setBlockedReason(data?.reason || "");
        setBlockedOpen(true);
        setUsernameErr("");
        setPasswordErr("");
      } else {
        const msg =
          data?.message ||
          (status === 401
            ? "Sai mật khẩu."
            : status === 400
            ? "Tài khoản không tồn tại hoặc thông tin không hợp lệ."
            : "Đăng nhập thất bại. Vui lòng thử lại.");
        if (status === 400) setUsernameErr(msg);
        else setPasswordErr(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  // --- GOOGLE LOGIN (custom button) ---
  const startGoogleLogin = useGoogleLogin({
    flow: "implicit",
    scope: "openid email profile",
    onSuccess: async (resp) => {
      try {
        const payload = {
          access_token: resp?.access_token || null,
          credential: resp?.credential || null,
          code: resp?.code || null,
        };
        const { data } = await api.post("/auth/google", payload);
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.user?.role || "user");
        localStorage.setItem("onboarded", data.user?.onboarded ? "1" : "0");
        toast.success("Đăng nhập bằng Google thành công!");
        if (data.user?.onboarded) nav("/home");
        else nav("/onboarding");
      } catch (e) {
        const status = e?.response?.status;
        const d = e?.response?.data || {};
        if (status === 423 || (status === 403 && d?.blocked)) {
          toast.error("Đăng nhập không thành công");
          setBlockedReason(d?.reason || "");
          setBlockedOpen(true);
          setUsernameErr("");
          setPasswordErr("");
        } else {
          toast.error(d?.message || "Đăng nhập Google thất bại.");
        }
      }
    },
    onError: () => toast.error("Google Login thất bại"),
  });

  // Ripple cho nút social
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

  const renderSignIn = (
    <form className="auth-form" onSubmit={onSubmit} noValidate style={{ width: "100%", maxWidth: 520 }}>
      <div className="login-head">
        <img src="/images/logo-fitmatch.png" alt="FitMatch" className="login-logo-rect" />
        <h1>Đăng nhập</h1>
      </div>

      <div className="auth-divider">
        <span>Nhập thông tin tài khoản</span>
      </div>

      {/* Username */}
      <input
        className={`auth-input ${usernameErr ? "input-invalid" : ""}`}
        type="text"
        id="username"
        name="username"
        placeholder="Tên tài khoản"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        onBlur={validateUsername}
        autoComplete="username"
        required
        maxLength={200}
      />
      <div className="error-stack" aria-live="polite">
        {usernameErr && <span className="error-item">{usernameErr}</span>}
      </div>

      {/* Password */}
      <div className="field">
        <input
          className={`auth-input ${passwordErr ? "input-invalid" : ""}`}
          type={showPass ? "text" : "password"}
          id="password"
          name="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={validatePassword}
          autoComplete="current-password"
          required
          maxLength={200}
        />
        <button
          type="button"
          className="eye-toggle"
          onClick={() => setShowPass((v) => !v)}
          aria-label="Hiện/ẩn mật khẩu"
        >
          <i className={`fa-solid ${showPass ? "fa-eye-slash" : "fa-eye"}`} />
        </button>
      </div>
      <div className="error-stack" aria-live="polite">
        {passwordErr && <span className="error-item">{passwordErr}</span>}
      </div>

      <button
        type="submit"
        className={`material-btn ${loading ? "loading" : ""}`}
        disabled={loading}
        style={{ marginTop: 6 }}
      >
        <span className="btn-text">Đăng nhập</span>
      </button>

      <div className="forgot-row under-login">
        <button
          type="button"
          className="btn-resetpwd link-blue"
          onClick={() => nav("/reset-password")}
        >
          Quên mật khẩu
        </button>
      </div>

      <div className="auth-divider">
        <span>HOẶC</span>
      </div>

      {/* SOCIAL */}
      <div className="social-login">
        <button
          type="button"
          className="social-btn google-material"
          onClick={onClickGoogle}
          aria-label="Tiếp tục với Google"
        >
          <div className="social-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          </div>
          <span>&ensp;Đăng nhập với Google</span>
          <span className="social-ripple" aria-hidden="true"></span>
        </button>
      </div>
    </form>
  );

  return (
    <>
      <AuthLayout
        mode="login"
        renderSignIn={renderSignIn}
        renderSignUp={<div />}
        suppressOutsideClose={blockedOpen}
      />
      <BlockedPopup open={blockedOpen} reason={blockedReason} onClose={() => setBlockedOpen(false)} />
    </>
  );
}
