import React from "react";
import { NavLink } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="fm-footer">
      <div className="fm-footer__inner">
        <div className="fm-foot-col">
          <div className="fm-brand">FitMatch</div>
          <div className="fm-foot-note">
            © {new Date().getFullYear()} FitMatch. All rights reserved.
          </div>
        </div>

        <div className="fm-foot-col">
          <div className="fm-foot-title">Điều hướng</div>
          <ul>
            <li><NavLink to="/thong-ke">Thống kê</NavLink></li>
            <li><NavLink to="/ket-noi">Kết nối</NavLink></li>
            <li><NavLink to="/dinh-duong/nhat-ky">Dinh dưỡng</NavLink></li>
            <li><NavLink to="/tap-luyen/lich-cua-ban">Tập luyện</NavLink></li>
            <li><NavLink to="/ung-dung">Ứng dụng</NavLink></li>
          </ul>
        </div>

        <div className="fm-foot-col">
          <div className="fm-foot-title">Liên hệ</div>
          <ul>
            <li><a href="#">Trung tâm hỗ trợ</a></li>
            <li><a href="#">Điều khoản</a></li>
            <li><a href="#">Chính sách bảo mật</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
