import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createAdminAccount } from "../../../lib/api.js";
import "./Admin_Create.css"; // Import CSS mới

// Regex khớp backend
const USERNAME_REGEX = /^[a-zA-Z0-9]{4,200}$/;
const NICKNAME_PLAIN_REGEX = /^[a-zA-Z0-9\s]{1,30}$/;

export default function AdminCreate(){
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [errs, setErrs] = useState({}); // { username, nickname, global }

  const validate = () => {
    const e = {};
    const u = username.trim();
    const n = nickname.trim();

    if (!u) e.username = "Vui lòng nhập username";
    else if (!USERNAME_REGEX.test(u)) e.username = "Username chỉ gồm chữ và số (4–200)";

    if (!n) e.nickname = "Vui lòng nhập nickname";
    else if (!NICKNAME_PLAIN_REGEX.test(n)) e.nickname = "Nickname không chứa ký tự đặc biệt (tối đa 30)";

    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setErrs({});
    if (!validate()) return;
    setLoading(true);
    try {
      await createAdminAccount({ username: username.trim(), nickname: nickname.trim() });
      nav("/admins"); // điều hướng về danh sách
    } catch (e) {
      setErrs({ global: e?.response?.data?.message || "Tạo tài khoản thất bại" });
    } finally { setLoading(false); }
  };

  return (
    // Thêm class admin-create-page để CSS riêng nếu cần
    <div className="foods-page admin-create-page"> 
      {/* Breadcrumb */}
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        {/* ... (Giữ nguyên) ... */}
        <Link to="/"><i className="fa-solid fa-house"></i><span>Trang chủ</span></Link>
        <span className="separator">/</span>
        <Link to="/admins" className="current-group"><i className="fa-solid fa-user-gear"></i><span>Quản lý Admin</span></Link>
        <span className="separator">/</span>
        <span className="current-page">Tạo tài khoản</span>
      </nav>

      {/* Card: Căn giữa và giới hạn chiều rộng */}
      <div className="card" style={{ maxWidth: 520, marginInline: "auto" }}>
        {/* Page Head */}
        <div className="page-head">
          <h2>Tạo tài khoản quản trị (cấp 2)</h2>
          {/* Bỏ nút Quay lại ở đây vì đã có nút Hủy dưới form */}
        </div>

        {/* Form: Dùng grid đơn giản */}
        <form onSubmit={onSubmit} className="admin-create-form">
          {/* Trường Username - Dùng Float Label */}
          <div className={`fc-field ${errs.username ? "has-error" : ""}`}>
            <input
              id="admin-username"
              className={` ${errs.username ? "input-invalid" : ""}`} // Giữ lại input-invalid nếu cần style riêng
              value={username}
              onChange={e=>setUsername(e.target.value)}
              placeholder=" " // Quan trọng cho float label
              maxLength={200}
              required
            />
            <label htmlFor="admin-username">
              Tên đăng nhập (username) <span className="req">*</span>
            </label>
            {errs.username && <div className="error-item">{errs.username}</div>}
          </div>

          {/* Trường Nickname - Dùng Float Label */}
          <div className={`fc-field ${errs.nickname ? "has-error" : ""}`}>
            <input
              id="admin-nickname"
              className={` ${errs.nickname ? "input-invalid" : ""}`}
              value={nickname}
              onChange={e=>setNickname(e.target.value)}
              placeholder=" " // Quan trọng cho float label
              maxLength={30}
              required
            />
            <label htmlFor="admin-nickname">
              Tên hiển thị (nickname) <span className="req">*</span>
            </label>
            {errs.nickname && <div className="error-item">{errs.nickname}</div>}
          </div>

          {/* Hint mật khẩu */}
          <div className="hint">
            Mật khẩu mặc định: <b>fitmatch@admin2</b> (Admin có thể tự đổi sau khi đăng nhập).
          </div>

          {/* Lỗi Global */}
          {errs.global && <div className="error-global">{errs.global}</div>}

          {/* Nút bấm */}
          <div className="form-actions">
            <Link to="/admins" className="btn ghost">Hủy</Link>
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? "Đang tạo..." : "Tạo tài khoản"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}