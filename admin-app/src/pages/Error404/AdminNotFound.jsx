// admin-app/src/pages/Error404/AdminNotFound.jsx
import React from "react";
import { Link } from "react-router-dom";
import "./AdminNotFound.css";

export default function AdminNotFound() {
  return (
    <div className="admin404-root">
      <div className="admin404-decorative-lines">
        <div className="admin404-line admin404-line1"></div>
        <div className="admin404-line admin404-line2"></div>
      </div>

      <div className="admin404-container">
        <div className="admin404-dumbbell-icon">🏋️</div>
        <div className="admin404-error-code">404</div>
        <h1 className="admin404-title">Rất tiếc! Không tìm thấy trang</h1>

        <p className="admin404-message">
          Trang bạn đang tìm kiếm có thể đã được di chuyển, xóa hoặc chưa bao giờ tồn tại.
        </p>

        <div className="admin404-motivation">
          "Có vẻ như Dev đang đi tập gym nên chưa sửa lỗi trang này, vui lòng thử lại sau nhé!"
        </div>

        {/* Nút chính: về Dashboard admin */}
        <Link to="/dashboard" className="admin404-btn-home">
          Trở về Trang chủ
        </Link>

        <br />

        {/* Link phụ: về màn hình đăng nhập admin */}
        <Link to="/login" className="admin404-secondary-link">
          Hoặc về màn hình Đăng nhập Admin →
        </Link>
      </div>
    </div>
  );
}
