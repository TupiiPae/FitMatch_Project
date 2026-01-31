// AuthLayout.jsx
import React, { useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./style.css";

export default function AuthLayout({
  mode = "login",
  renderSignIn,
  renderSignUp,
  suppressOutsideClose = false,
}) {
  const nav = useNavigate();
  const containerRef = useRef(null);
  const isActive = mode !== "login";

  const goLogin = () => nav("/login");
  const goRegister = () => nav("/register");

  const handleOutsideClick = (event) => {
    if (suppressOutsideClose) return;
    const el = event.target;
    if (el && el.closest && el.closest(".cm-backdrop")) return;
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
        className={`auth-container auth-mode-${mode} ${isActive ? "auth-active" : ""} auth-xslow`}
      >
        <div className="auth-form-container auth-signin">{renderSignIn}</div>

        <div className="auth-form-container auth-signup">{renderSignUp}</div>

        <div className="auth-toggle-wrap">
          <div className="auth-toggle">
            <div className="auth-toggle-panel auth-toggle-left">
              <h1>{leftTitle}</h1>
              <p>{leftDesc}</p>
              <button type="button" className="auth-ghost" onClick={goLogin}>
                Quay lại Đăng nhập
              </button>
            </div>

            <div className="auth-toggle-panel auth-toggle-right">
              <h1>{rightTitle}</h1>
              <p>{rightDesc}</p>
              <button type="button" className="auth-ghost" onClick={goRegister}>
                Đến Đăng ký
              </button>
            </div>
          </div>
        </div>

        {/* Switch link cho mobile (vì mobile sẽ ẩn panel toggle) */}
        <div className="auth-mobile-switch">
          {mode === "login" && (
            <button type="button" className="auth-mobile-link" onClick={goRegister}>
              Bạn chưa có tài khoản? <b>Đăng ký</b>
            </button>
          )}
          {mode === "register" && (
            <button type="button" className="auth-mobile-link" onClick={goLogin}>
              Bạn đã có tài khoản? <b>Đăng nhập</b>
            </button>
          )}
          {mode === "reset" && (
            <button type="button" className="auth-mobile-link" onClick={goLogin}>
              <b>Quay lại Đăng nhập</b>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
