// AuthLayout.jsx
import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./style.css";

/**
 * mode: "login" | "register" | "reset"
 * renderSignIn: JSX (form đăng nhập)
 * renderSignUp: JSX (form đăng ký / reset)
 * suppressOutsideClose?: boolean  // <<< THÊM
 */
export default function AuthLayout({ mode = "login", renderSignIn, renderSignUp, suppressOutsideClose = false }) {
  const nav = useNavigate();
  const containerRef = useRef(null);
  const isActive = mode !== "login";

  const goLogin = () => nav("/login");
  const goRegister = () => nav("/register");

  const handleOutsideClick = (event) => {
    // 1) Nếu đang mở modal (ví dụ popup khóa tài khoản) thì KHÔNG đóng
    if (suppressOutsideClose) return;

    // 2) Nếu click nằm trong backdrop modal (cm-backdrop) -> bỏ qua
    const el = event.target;
    if (el && (el.closest && el.closest(".cm-backdrop"))) return;

    if (suppressOutsideClose) return; // đang mở popup -> không đóng layout
    if (containerRef.current && !containerRef.current.contains(event.target)) nav("/");
  };


  const rightTitle = "Bạn mới biết đến FitMatch?";
  const rightDesc = "Đăng ký ngay để bắt đầu hành trình sức khỏe của bạn với FitMatch.";

  const leftTitle = "Bạn đã có tài khoản FitMatch!";
  const leftDesc =
    mode === "reset"
      ? "Cập nhật lại mật khẩu nếu bạn lỡ quên mất, hoặc quay lại đăng nhập để thử lại."
      : "Nếu bạn đã có tài khoản, hãy đăng nhập để tiếp tục sử dụng các tính năng của FitMatch.";

  return (
    <div className="auth-root" onClick={handleOutsideClick}>
      <div
        ref={containerRef}
        className={`auth-container ${isActive ? "auth-active" : ""} auth-xslow`}
      >
        <div className="auth-form-container auth-signin">
          <div className="auth-form">{renderSignIn}</div>
        </div>

        <div className="auth-form-container auth-signup">
          <div className="auth-form">{renderSignUp}</div>
        </div>

        <div className="auth-toggle-wrap">
          <div className="auth-toggle">
            <div className="auth-toggle-panel auth-toggle-left">
              <h1>{leftTitle}</h1>
              <p>{leftDesc}</p>
              <button className="auth-ghost" onClick={goLogin}>
                Quay lại Đăng nhập
              </button>
            </div>

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
