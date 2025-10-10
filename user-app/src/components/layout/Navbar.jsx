import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
// Nếu bạn muốn dùng byPrefixAndName như bạn đưa, xem chú thích ở dưới.
// import { byPrefixAndName } from "@fortawesome/fontawesome-svg-core/import.macro";

import {
  faCaretDown,
  faAngleRight,
  faCalendar,
  faFire,
  faBowlFood,
  faLightbulb,
  faPenToSquare,
  faBookmark,
} from "@fortawesome/free-solid-svg-icons";

// Logo ở public/images/logo-fitmatch.png
const logoHref =
  (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
    ? import.meta.env.BASE_URL
    : "/") + "images/logo-fitmatch.png";

export default function Navbar({ nickname = "Bạn", avatarSrc }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // cho mobile

  const toggleMobile = () => setMobileOpen((v) => !v);
  const dropdownToggle = (key) =>
    setOpenDropdown((prev) => (prev === key ? null : key));

  return (
    <header className="fm-header" role="banner">
      <div className="fm-nav">
        <div className="fm-nav-grid">
          {/* LEFT: LOGO */}
          <div className="fm-left">
            <button className="fm-burger" aria-label="Mở menu" onClick={toggleMobile}>
              <span />
              <span />
              <span />
            </button>

            <NavLink to="/" className="fm-brand" aria-label="FitMatch">
              <img className="fm-logo" src={logoHref} alt="FitMatch" />
            </NavLink>
          </div>

          {/* CENTER: MENU */}
          <nav className={`fm-menu ${mobileOpen ? "is-open" : ""}`} aria-label="Chính">
            <ul className="fm-menu__list">
              <li className="fm-menu__item">
                <NavLink to="/thong-ke" className="fm-link">
                  Thống kê
                </NavLink>
              </li>

              <li className="fm-menu__item">
                <NavLink to="/ket-noi" className="fm-link">
                  Kết nối
                </NavLink>
              </li>

              {/* DINH DƯỠNG */}
              <li
                className="fm-menu__item has-dropdown"
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <NavLink to="/dinh-duong/nhat-ky" className="fm-link">
                  Dinh dưỡng{" "}
                  <FontAwesomeIcon icon={faCaretDown} className="fm-caret" />
                  {/*
                  Nếu bạn muốn dùng cú pháp của bạn:
                  <FontAwesomeIcon icon={byPrefixAndName.fas['caret-down']} className="fm-caret" />
                  */}
                </NavLink>

                {/* Nút mở cho mobile */}
                <button
                  className="fm-dd-toggle"
                  aria-label="Mở Dinh dưỡng"
                  onClick={() => dropdownToggle("dd")}
                  aria-expanded={openDropdown === "dd"}
                >
                  <FontAwesomeIcon icon={faCaretDown} />
                </button>

                <div
                  className={`fm-dropdown ${openDropdown === "dd" ? "is-open" : ""}`}
                  role="menu"
                  aria-haspopup="true"
                >
                  <NavLink to="/dinh-duong/nhat-ky" className="fm-dd-link" role="menuitem">
                    <FontAwesomeIcon icon={faBookmark} /> Nhật ký
                  </NavLink>

                  {/* Ghi lại bữa ăn + submenu ngang phải */}
                  <div className="fm-dd-group">
                    <NavLink to="/dinh-duong/ghi-lai" className="fm-dd-link fm-dd-link--row" role="menuitem">
                      <FontAwesomeIcon icon={faPenToSquare} />
                      <span>Ghi lại bữa ăn</span>
                      <FontAwesomeIcon icon={faAngleRight} className="fm-angle" />
                    </NavLink>

                    {/* Submenu: chỉ bung khi trỏ vào mục "Ghi lại bữa ăn" */}
                    <div className="fm-dd-sub" role="menu">
                      <NavLink
                        to="/dinh-duong/ghi-lai/yeu-thich"
                        className="fm-dd-sublink"
                        role="menuitem"
                      >
                        Yêu thích của tôi
                      </NavLink>
                      <NavLink
                        to="/dinh-duong/ghi-lai/tinh-calo-ai"
                        className="fm-dd-sublink"
                        role="menuitem"
                      >
                        Tính toán Calo với AI
                      </NavLink>
                    </div>
                  </div>

                  <NavLink to="/dinh-duong/thuc-don-goi-y" className="fm-dd-link" role="menuitem">
                    <FontAwesomeIcon icon={faLightbulb} /> Thực đơn gợi ý
                  </NavLink>
                </div>
              </li>

              {/* TẬP LUYỆN */}
              <li
                className="fm-menu__item has-dropdown"
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <NavLink to="/tap-luyen/lich-cua-ban" className="fm-link">
                  Tập luyện{" "}
                  <FontAwesomeIcon icon={faCaretDown} className="fm-caret" />
                  {/*
                  Hoặc:
                  <FontAwesomeIcon icon={byPrefixAndName.fas['caret-down']} className="fm-caret" />
                  */}
                </NavLink>

                {/* Nút mở cho mobile */}
                <button
                  className="fm-dd-toggle"
                  aria-label="Mở Tập luyện"
                  onClick={() => dropdownToggle("tl")}
                  aria-expanded={openDropdown === "tl"}
                >
                  <FontAwesomeIcon icon={faCaretDown} />
                </button>

                <div
                  className={`fm-dropdown ${openDropdown === "tl" ? "is-open" : ""}`}
                  role="menu"
                  aria-haspopup="true"
                >
                  <NavLink to="/tap-luyen/lich-cua-ban" className="fm-dd-link" role="menuitem">
                    <FontAwesomeIcon icon={faCalendar} /> Lịch tập của bạn
                  </NavLink>

                  {/* Các bài tập + submenu ngang phải */}
                  <div className="fm-dd-group">
                    <div className="fm-dd-link fm-dd-link--row is-accent" role="menuitem" tabIndex={0}>
                      <FontAwesomeIcon icon={faFire} />
                      <span>Các bài tập</span>
                      <FontAwesomeIcon icon={faAngleRight} className="fm-angle" />
                    </div>

                    {/* Submenu: chỉ bung khi trỏ vào mục "Các bài tập" */}
                    <div className="fm-dd-sub" role="menu">
                      <NavLink to="/tap-luyen/bai-tap/cardio" className="fm-dd-sublink" role="menuitem">
                        Cardio
                      </NavLink>
                      <NavLink to="/tap-luyen/bai-tap/workout" className="fm-dd-sublink" role="menuitem">
                        Workout
                      </NavLink>
                    </div>
                  </div>

                  <NavLink to="/tap-luyen/goi-y" className="fm-dd-link" role="menuitem">
                    <FontAwesomeIcon icon={faLightbulb} /> Gợi ý tập luyện
                  </NavLink>
                </div>
              </li>

              <li className="fm-menu__item">
                <NavLink to="/cong-dong" className="fm-link">Cộng đồng</NavLink>
              </li>

              <li className="fm-menu__item">
                <NavLink to="/ung-dung" className="fm-link">Ứng dụng</NavLink>
              </li>
            </ul>
          </nav>

          {/* RIGHT: AVATAR + HELLO */}
          <div className="fm-right">
            <span className="fm-hello">
              Xin chào, <strong>{nickname}</strong>
            </span>
            <div className="fm-avatar" title="Tài khoản" role="button" tabIndex={0}>
              <img src={avatarSrc || "/images/avatar.png"} alt="Avatar" />
              {/* TODO: dropdown tài khoản */}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
