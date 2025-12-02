import React from "react";
import { NavLink } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFacebookF, faInstagram, faYoutube } from "@fortawesome/free-brands-svg-icons";
import { faEnvelope } from "@fortawesome/free-solid-svg-icons";

export default function Footer() {
  const year = new Date().getFullYear();

  const handleScrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="fm-footer fm-footer--mock07">
      <div className="fm-foot-container">
        {/* LEFT: Logo + copy */}
        <div className="fm-foot-left">
          <NavLink to="/" className="fm-foot-logo">
            {/* Thay src logo theo file thực tế của bạn */}
            <img
              src="/images/fm-logo-name.png"
              alt="FitMatch"
              className="fm-foot-logo-img"
              onError={(e) => {
                // fallback nếu chưa có file logo
                e.currentTarget.style.display = "none";
              }}
            />
          </NavLink>
          <div className="fm-foot-copy">
            © {year} FitMatch. All rights reserved.
          </div>
        </div>

        {/* CENTER: Nav menu */}
        <nav className="fm-foot-nav" aria-label="Footer navigation">
          <NavLink to="/#main-content" >Về FitMatch</NavLink>
          <NavLink to="tai-khoan/chinh-sach-bao-mat" onClick={handleScrollTop}>Chính sách bảo mật</NavLink>
          <NavLink to="tai-khoan/dieu-khoan-dich-vu" onClick={handleScrollTop}>Điều khoản dịch vụ</NavLink>
          <NavLink to="/tai-khoan/faq" onClick={handleScrollTop}>FAQs</NavLink>
          <NavLink to="tai-khoan/lien-he" onClick={handleScrollTop}>Liên hệ</NavLink>
        </nav>

        {/* RIGHT: Social icons */}
        <div className="fm-foot-right">
          <div className="fm-foot-social" aria-label="Social links">
            <a
              href="https://www.facebook.com/profile.php?id=61582997385998"
              aria-label="Facebook"
              target="_blank"
              rel="noreferrer"
            >
              <FontAwesomeIcon icon={faFacebookF} />
            </a>
            <a
              href="https://Youtube.com"
              aria-label="Youtube"
              target="_blank"
              rel="noreferrer"
            >
              <FontAwesomeIcon icon={faYoutube} />
            </a>
            <a
              href="https://mail.google.com"
              aria-label="Gmail"
              target="_blank"
              rel="noreferrer"
            >
              <FontAwesomeIcon icon={faEnvelope} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
