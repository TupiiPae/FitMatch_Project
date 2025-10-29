// src/pages/ProfilePage/ProfilePage.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom'; // Thêm import Link
import { toast } from 'react-toastify';
import './ProfilePage.css'; // File CSS riêng cho trang này

export default function ProfilePage() {
  const [nickname, setNickname] = useState("admin_level2"); // Lấy từ auth context
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (password && password !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp!");
      return;
    }

    // Logic gọi API cập nhật profile
    console.log("Đang cập nhật:", { nickname, password });
    
    // Giả lập thành công
    toast.success("Cập nhật thông tin thành công!");
    // Xóa trường password sau khi submit
    setPassword("");
    setConfirmPassword("");
  };

  return (
    // Sử dụng layout giống .foods-page
    <div className="fm-profile-page"> 
      
      {/* ===== 1. Breadcrumb (Giống FoodList) ===== */}
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/">
          <i className="fa-solid fa-house" aria-hidden="true"></i>
          <span>Trang chủ</span>
        </Link>
        <span className="separator">/</span>
        <span className="current-group">
          <i className="fa-solid fa-gear" aria-hidden="true"></i>
          <span>Cài đặt</span>
        </span>
        <span className="separator">/</span>
        <span className="current-page">Thông tin tài khoản</span>
      </nav>

      {/* ===== 2. Card (Giống FoodList) ===== */}
      <div className="card">
        
        {/* ===== 3. Page Head (Giống FoodList) ===== */}
        <div className="page-head">
          <h2>Thông tin tài khoản</h2>
          <div className="head-actions">
            {/* Nút submit được đưa lên đây, sử dụng 'form' attribute */}
            <button 
              type="submit" 
              form="profile-form" 
              className="btn primary"
            >
              Lưu thay đổi
            </button>
          </div>
        </div>

        {/* ===== 4. Nội dung form ===== */}
        {/* Wrapper này để giới hạn chiều rộng form cho đỡ trống */}
        <div className="profile-form-content">
          <form id="profile-form" onSubmit={handleSubmit}>
            
            <div className="fm-form-group">
              {/* Thay đổi label theo yêu cầu */}
              <label htmlFor="nickname">Tên người quản trị</label>
              <input 
                type="text" 
                id="nickname" 
                className="fm-input" 
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>

            {/* Đây là title "Thay đổi Mật khẩu" */}
            <p className="fm-form-divider">Thay đổi mật khẩu</p>
            
            <div className="fm-form-group">
              <label htmlFor="password">Mật khẩu mới</label>
              <input 
                type="password" 
                id="password" 
                className="fm-input"
                placeholder="Bỏ trống nếu không đổi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="fm-form-group">
              <label htmlFor="confirmPassword">Xác nhận mật khẩu mới</label>
              <input 
                type="password" 
                id="confirmPassword" 
                className="fm-input" 
                placeholder="Bỏ trống nếu không đổi"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {/* Đã xóa .fm-form-actions vì nút submit đã ở trên .page-head */}

          </form>
        </div>
      </div>
    </div>
  );
}