import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createAdminAccount } from "../../../lib/api.js";


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
    <div className="foods-page">
      {/* Breadcrumb */}
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/"><i className="fa-solid fa-house"></i><span>Trang chủ</span></Link>
        <span className="separator">/</span>
        <Link to="/admins" className="current-group"><i className="fa-solid fa-user-gear"></i><span>Quản lý Admin</span></Link>
        <span className="separator">/</span>
        <span className="current-page">Tạo tài khoản</span>
      </nav>

      <div className="card" style={{ maxWidth: 680, marginInline: "auto" }}>
        <div className="page-head">
          <h2>Tạo tài khoản quản trị (cấp 2)</h2>
          <div className="head-actions">
            <Link to="/admins" className="btn ghost"><span>Quay lại</span></Link>
          </div>
        </div>

        <form onSubmit={onSubmit} className="fc-grid" style={{ display:"grid", gap:12 }}>
          <label>
            <div>Tên đăng nhập (username) <span className="req">*</span></div>
            <input
              className={`ipt ${errs.username ? "input-invalid" : ""}`}
              value={username}
              onChange={e=>setUsername(e.target.value)}
              placeholder="vd: adminviet"
              maxLength={200}
              required
            />
            {errs.username && <div className="error-item" style={{marginTop:6}}>{errs.username}</div>}
          </label>

          <label>
            <div>Tên hiển thị (nickname) <span className="req">*</span></div>
            <input
              className={`ipt ${errs.nickname ? "input-invalid" : ""}`}
              value={nickname}
              onChange={e=>setNickname(e.target.value)}
              placeholder="vd: Việt Admin"
              maxLength={30}
              required
            />
            {errs.nickname && <div className="error-item" style={{marginTop:6}}>{errs.nickname}</div>}
          </label>

          <div className="hint" style={{marginTop:4}}>
            Mật khẩu mặc định: <b>fitmatch@admin2</b> (có thể đổi sau).
          </div>

          {errs.global && <div className="empty" style={{ color:"#b91c1c" }}>{errs.global}</div>}

          <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:8 }}>
            <Link to="/admins" className="btn ghost">Hủy</Link>
            <button className="btn primary" disabled={loading}>{loading ? "Đang tạo..." : "Tạo tài khoản"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
