import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../Style/AuthLayout";
import "../Style/style.css";
import api from "../../lib/api";

export default function Login() {
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const [usernameErr, setUsernameErr] = useState("");
  const [passwordErr, setPasswordErr] = useState("");

  const validateUsername = () => {
    const v = username.trim();
    if (!v) { setUsernameErr("Vui lòng nhập tên tài khoản"); return false; }
    setUsernameErr(""); return true;
  };
  const validatePassword = () => {
    if (!password) { setPasswordErr("Vui lòng nhập mật khẩu"); return false; }
    if (password.length < 6) { setPasswordErr("Mật khẩu phải có ít nhất 6 ký tự"); return false; }
    setPasswordErr(""); return true;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!validateUsername() || !validatePassword()) return;
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", {
        identifier: username.trim(),
        password,
        remember: false, // bỏ "ghi nhớ" theo yêu cầu
      });
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.user?.role || "user");
      localStorage.setItem("onboarded", data.user?.onboarded ? "1" : "0");
      if (data.user?.onboarded) nav("/home"); else nav("/onboarding");
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message ||
        (status === 401 ? "Sai mật khẩu." :
         status === 400 ? "Tài khoản không tồn tại hoặc thông tin không hợp lệ." :
         "Đăng nhập thất bại. Vui lòng thử lại.");
      setPasswordErr(msg);
    } finally { setLoading(false); }
  };

  const renderSignIn = (
    <form className="auth-form" onSubmit={onSubmit} noValidate style={{ width: "100%", maxWidth: 520 }}>
      <h1>Đăng nhập</h1>

      <div className="auth-social">
        <a href="#" className="icon" aria-label="Google"><i className="fa-brands fa-google"></i></a>
        <a href="#" className="icon" aria-label="Facebook"><i className="fa-brands fa-facebook-f"></i></a>
      </div>

      <span>hoặc đăng nhập bằng tài khoản của bạn</span>

      <input
        className="auth-input"
        type="text"
        id="username"
        name="username"
        placeholder="Tên tài khoản"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        onBlur={validateUsername}
        autoComplete="username"
        required
      />

      <div className="field">
        <input
          className="auth-input"
          type={showPass ? "text" : "password"}
          id="password"
          name="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={validatePassword}
          autoComplete="current-password"
          required
        />
        <button type="button" className="eye-toggle" onClick={() => setShowPass(v => !v)} aria-label="Hiện/ẩn mật khẩu">
          <i className={`fa-solid ${showPass ? "fa-eye-slash" : "fa-eye"}`}></i>
        </button>
      </div>
    <div className="error-stack" aria-live="polite">
      {[passwordErr, usernameErr].filter(Boolean).map((msg, i) => (
        <span key={i} className="error-item">{msg}</span>
      ))}
    </div>

      <div className="forgot-row">
        <button type="button" className="btn-resetpwd" onClick={() => nav("/reset-password")}>
          Quên mật khẩu?
        </button>
      </div>

      <button type="submit" className="material-btn" disabled={loading}>
        <span className="btn-text">Đăng nhập</span>
        <div className="btn-loader">
        </div>
      </button>
      {/* Không cần link "Chưa có tài khoản?" vì đã có panel bên phải */}
    </form>
  );

  const renderSignUp = <div />;

  return <AuthLayout mode="login" renderSignIn={renderSignIn} renderSignUp={renderSignUp} />;
}
