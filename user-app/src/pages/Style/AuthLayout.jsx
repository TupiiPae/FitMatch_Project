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
  const rightTitle = mode === "reset" ? "Bạn muốn tìm lại mật khẩu?" : "Người dùng mới của FitMatch!";
  const rightDesc  = mode === "reset"
    ? "Nhập email để nhận OTP và đặt lại mật khẩu."
    : "Vui lòng nhập lại email đã đăng ký, chúng tôi sẽ gửi bạn mã OTP để cập nhật mật khẩu.";

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
              <h1>Bạn đã có tài khoản FitMatch!</h1>
              <p>Nếu bạn đã có tài khoản FitMatch, hãy đăng nhập để tiếp tục sử dụng các tính năng của FitMatch.</p>
              <button className="auth-ghost" onClick={goLogin}>Quay lại Đăng nhập</button>
            </div>
            <div className="auth-toggle-panel auth-toggle-right">
              <h1>{rightTitle}</h1>
              <p>{rightDesc}</p>
              <button className="auth-ghost" onClick={goRegister}>Đến Đăng ký</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
