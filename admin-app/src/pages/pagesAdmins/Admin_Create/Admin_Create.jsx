import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createAdminAccount } from "../../../lib/api.js";
import { toast } from "react-toastify";
import "./Admin_Create.css";

const USERNAME_REGEX = /^[a-zA-Z0-9]{4,200}$/;
const NICKNAME_RE = /^(?=.{1,30}$)[\p{L}\p{M}\d ]+$/u;

export default function AdminCreate(){
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [errs, setErrs] = useState({}); // { username, nickname, global }

  const validateUsername = (v) => {
    const u = (v || "").trim();
    if (!u) return "Vui lòng nhập username";
    if (!USERNAME_REGEX.test(u)) return "Username chỉ gồm chữ và số (4–200)";
    return "";
  };
  const validateNickname = (v) => {
    const n = (v || "").trim();
    if (!n) return "Vui lòng nhập nickname";
    if (!NICKNAME_RE.test(n)) return "Chỉ cho phép chữ (có dấu), số, khoảng trắng và tối đa 30 ký tự.";
    return "";
  };
  const validate = () => {
    const e = {
      username: validateUsername(username),
      nickname: validateNickname(nickname),
    };
    Object.keys(e).forEach(k => { if (!e[k]) delete e[k]; });
    setErrs(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setErrs({});
    if (!validate()) { toast.error("Vui lòng sửa lỗi trước khi lưu."); return; }
    setLoading(true);
    try {
      await createAdminAccount({ username: username.trim(), nickname: nickname.trim() });
      // KHÔNG toast ở đây để tránh trùng — để Admin_List hiển thị 1 lần
      nav("/admins", { state: { justCreated: true } });
    } catch (e) {
      setErrs({ global: e?.response?.data?.message || "Tạo tài khoản thất bại" });
    } finally { setLoading(false); }
  };

  return (
    <div className="foods-page admin-create-page">
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/"><i className="fa-solid fa-house"></i><span>Trang chủ</span></Link>
        <span className="separator">/</span>
        <Link to="/admins" className="current-group">
          <i className="fa-solid fa-user-gear"></i><span>Quản lý Admin</span>
        </Link>
        <span className="separator">/</span>
        <span className="current-page">Tạo tài khoản</span>
      </nav>

      <div className="card admin-create-card">
        <div className="page-head">
          <h2>Tạo tài khoản quản trị (cấp 2)</h2>
          <div className="head-actions">
            <Link to="/admins" className="btn ghost">
              <span>Quay lại danh sách</span>
            </Link>
            {/* Nút submit đặt ở header, submit form qua thuộc tính form */}
            <button
              className="btn primary"
              type="submit"
              form="admin-create-form"
              disabled={loading}
            >
              {loading ? "Đang tạo..." : "Tạo tài khoản"}
            </button>
          </div>
        </div>

        <div className="admin-create-grid">
          <form id="admin-create-form" onSubmit={onSubmit} className="admin-create-form">
            <div className={`fc-field ${errs.username ? "has-error" : ""}`}>
              <input
                id="admin-username"
                value={username}
                onChange={(e)=>setUsername(e.target.value)}
                onBlur={()=> setErrs(prev => ({ ...prev, username: validateUsername(username) || undefined }))}
                placeholder=" "
                maxLength={200}
                aria-invalid={!!errs.username}
                required
              />
              <label htmlFor="admin-username">
                Tên đăng nhập (username) <span className="req">*</span>
              </label>
              {errs.username && <div className="error-item">{errs.username}</div>}
            </div>

            <div className={`fc-field ${errs.nickname ? "has-error" : ""}`}>
              <input
                id="admin-nickname"
                value={nickname}
                onChange={(e)=>setNickname(e.target.value)}
                onBlur={()=> setErrs(prev => ({ ...prev, nickname: validateNickname(nickname) || undefined }))}
                placeholder=" "
                maxLength={30}
                aria-invalid={!!errs.nickname}
                required
              />
              <label htmlFor="admin-nickname">
                Tên hiển thị (nickname) <span className="req">*</span>
              </label>
              {errs.nickname && <div className="error-item">{errs.nickname}</div>}
            </div>

            <div className="hint">
              Mật khẩu mặc định: <b>fitmatch@admin2</b> (Admin có thể tự đổi sau khi đăng nhập).
            </div>

            {errs.global && <div className="error-global">{errs.global}</div>}
          </form>

          <div className="admin-create-aside" aria-hidden="true"></div>
        </div>
      </div>
    </div>
  );
}
