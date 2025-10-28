import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./style.css";

/**
 * mode: "login" | "register" | "reset"
 * renderSignIn: JSX (form đăng nhập)
 * renderSignUp: JSX (form đăng ký / reset)
 */
export default function AuthLayout({ mode = "login", renderSignIn, renderSignUp }) {
  const nav = useNavigate();
  const containerRef = useRef(null);
  const isActive = mode !== "login";

  const goLogin = () => nav("/login");
  const goRegister = () => nav("/register");

  const handleOutsideClick = (event) => {
    if (containerRef.current && !containerRef.current.contains(event.target)) {
      nav("/");
    }
  };

  // --- LOGIC MỚI CHO CÁC PANEL ---

  // 1. Panel phải (auth-toggle-right)
  // Panel này chỉ hiển thị khi mode="login", dùng để kêu gọi đăng ký.
  const rightTitle = "Bạn mới biết đến FitMatch?";
  const rightDesc = "Đăng ký ngay để bắt đầu hành trình sức khỏe của bạn với FitMatch.";

  // 2. Panel trái (auth-toggle-left)
  // Panel này hiển thị khi mode="register" HOẶC mode="reset".
  // Ta sẽ tách logic ở đây.
  const leftTitle = "Bạn đã có tài khoản FitMatch!";
  const leftDesc =
    mode === "reset"
      ? "Cập nhật lại mật khẩu nếu bạn lỡ quên mất, hoặc quay lại đăng nhập để thử lại." // Text cho mode "reset"
      : "Nếu bạn đã có tài khoản, hãy đăng nhập để tiếp tục sử dụng các tính năng của FitMatch."; // Text cho mode "register"

  return (
    <div className="auth-root" onClick={handleOutsideClick}>
      <div
        ref={containerRef}
        className={`auth-container ${isActive ? "auth-active" : ""} auth-xslow`}
      >
        {/* Cột trái: Đăng nhập */}
        <div className="auth-form-container auth-signin">
          <div className="auth-form">{renderSignIn}</div>
        </div>

        {/* Cột phải: Đăng ký / Reset */}
        <div className="auth-form-container auth-signup">
          <div className="auth-form">{renderSignUp}</div>
        </div>

        {/* Panel tím */}
        <div className="auth-toggle-wrap">
          <div className="auth-toggle">
            {/* Panel TRÁI: Hiển thị khi mode="register" hoặc mode="reset" */}
            <div className="auth-toggle-panel auth-toggle-left">
              <h1>{leftTitle}</h1>
              <p>{leftDesc}</p>
              <button className="auth-ghost" onClick={goLogin}>
                Quay lại Đăng nhập
              </button>
            </div>

            {/* Panel PHẢI: Hiển thị khi mode="login" */}
            <div className="auth-toggle-panel auth-toggle-right">
              <h1>{rightTitle}</h1>
              <p>{rightDesc}</p>
              <button className="auth-ghost" onClick={goRegister}>
                Đến Đăng ký
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}