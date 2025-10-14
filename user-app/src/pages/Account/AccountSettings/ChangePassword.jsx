import React, { useState } from "react";
import "./ChangePassword.css";

export default function ChangePassword() {
  const [email, setEmail] = useState("");

  const onSubmit = (e) => {
    e.preventDefault();
    // TODO: gọi API gửi OTP / đổi mật khẩu
  };

  return (
    // Không bọc .acc-page ở đây; scope đã ở layout (.pf-content.acc-page)
    <div className="acc-card card">
      <h2 className="pf-title">Thay đổi mật khẩu</h2>

      <div className="cp-wrap">
        <div className="cp-block">
          <div className="cp-subtitle">Quên mật khẩu</div>
          <p className="cp-desc">
            Chúng tôi sẽ gửi mã OTP đến Email của bạn. Vui lòng nhập email để nhận mã và tiến hành đổi mật khẩu.
          </p>

          <form className="cp-form" onSubmit={onSubmit}>
            <input
              type="email"
              className="cp-input"
              placeholder="Nhập email của bạn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <button className="btn-success cp-send" type="submit">
              Gửi
            </button>
          </form>

          {/* <div className="cp-error">Sai OTP, vui lòng nhập lại</div> */}
        </div>
      </div>
    </div>
  );
}
