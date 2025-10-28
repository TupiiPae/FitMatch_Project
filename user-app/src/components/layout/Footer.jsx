import React from "react";
import { NavLink } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFacebookF, faLinkedinIn, faGithub } from "@fortawesome/free-brands-svg-icons";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="fm-footer fm-footer--mock07">
      <div className="fm-foot-container">
        {/* Brand center */}
        <div className="fm-foot-brand">FitMatch</div>

        {/* Nav center – 6 items */}
        <nav className="fm-foot-nav" aria-label="Footer">
          <NavLink to="/thong-ke">Thống kê</NavLink>
          <NavLink to="/ket-noi">Kết nối</NavLink>
          <NavLink to="/dinh-duong/nhat-ky">Dinh Dưỡng</NavLink>
          <NavLink to="/tap-luyen/lich-cua-ban">Tập Luyện</NavLink>
          <NavLink to="/cong-dong">Cộng đồng</NavLink>
          <NavLink to="/ung-dung">Ứng dụng</NavLink>
        </nav>

        {/* Social */}
        <div className="fm-foot-social" aria-label="Social">
          <a href="https://facebook.com" aria-label="Facebook" target="_blank" rel="noreferrer">
            <FontAwesomeIcon icon={faFacebookF} />
          </a>
          <a href="https://linkedin.com" aria-label="LinkedIn" target="_blank" rel="noreferrer">
            <FontAwesomeIcon icon={faLinkedinIn} />
          </a>
          <a href="https://github.com" aria-label="GitHub" target="_blank" rel="noreferrer">
            <FontAwesomeIcon icon={faGithub} />
          </a>
        </div>

        {/* Copy */}
        <div className="fm-foot-copy">
          Copyright © {year} All rights reserved. <a href="#">FitMatch</a>
        </div>
      </div>
    </footer>
  );
}
