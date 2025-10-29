import React, { useState } from 'react';
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
    <div className="fm-profile-page">
      <h1 className="fm-page-title">Thông tin tài khoản</h1>

      {/* Đây là .fm-card mà bạn yêu cầu */}
      <div className="fm-card fm-profile-card">
        <form onSubmit={handleSubmit}>
          
          <div className="fm-form-group">
            <label htmlFor="nickname">Nickname</label>
            <input 
              type="text" 
              id="nickname" 
              className="fm-input" 
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </div>

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

          <div className="fm-form-actions">
            <button type="submit" className="fm-btn-primary">
              Lưu thay đổi
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}