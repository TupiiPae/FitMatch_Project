import React from "react";
import { useNavigate } from "react-router-dom";
import "./style.css";

/**
 * mode: "login" | "register" | "reset"
 * renderSignIn: JSX (form đăng nhập)
 * renderSignUp: JSX (form đăng ký / reset)
 */
export default function AuthLayout({ mode = "login", renderSignIn, renderSignUp }) {
  const nav = useNavigate();
  const isActive = mode !== "login";

  const goLogin = () => nav("/login");
  const goRegister = () => nav("/register");

  // Panel phải: hiển thị text khác khi ở chế độ reset
  const rightTitle = mode === "reset" ? "Đặt lại mật khẩu" : "Xin chào!";
  const rightDesc  = mode === "reset"
    ? "Nhập email để nhận OTP và đặt lại mật khẩu."
    : "Đăng ký bằng thông tin cá nhân để dùng đầy đủ tính năng.";

  return (
    <div className="auth-root">
      <div className={`auth-container ${isActive ? "auth-active" : ""} auth-xslow`}>

        {/* Cột trái: Đăng nhập */}
        <div className="auth-form-container auth-signin">
          <div className="auth-form">
            {renderSignIn}
          </div>
        </div>

        {/* Cột phải: Đăng ký / Reset */}
        <div className="auth-form-container auth-signup">
          <div className="auth-form">
            {renderSignUp}
          </div>
        </div>

        {/* Panel tím */}
        <div className="auth-toggle-wrap">
          <div className="auth-toggle">
            <div className="auth-toggle-panel auth-toggle-left">
              <h1>Chào mừng trở lại!</h1>
              <p>Nhập thông tin cá nhân của bạn để sử dụng đầy đủ các tính năng.</p>
              <button className="auth-ghost" onClick={goLogin}>Đăng nhập</button>
            </div>
            <div className="auth-toggle-panel auth-toggle-right">
              <h1>{rightTitle}</h1>
              <p>{rightDesc}</p>
              <button className="auth-ghost" onClick={goRegister}>Đăng ký</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
