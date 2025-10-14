import React, { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCaretDown,
  faAngleRight,
  faCalendar,
  faFire,
  faLightbulb,
  faPenToSquare,
  faBookmark,
  faRightFromBracket,
  faUser,
  faMessage,
  faGear,
  faCircleInfo,
  faShieldHalved,
  faCamera
} from "@fortawesome/free-solid-svg-icons";

// Logo ở public/images/logo-fitmatch.png
const logoHref =
  (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/") +
  "images/logo-fitmatch.png";

export default function Navbar({
  nickname = "Bạn",
  avatarSrc,
  // Thông tin hiển thị trong dropdown:
  joinDate = "xx/xx/xxxx",
  age = "xx",
  heightCm = "xxx",
  weightKg = "xx"
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // menu dinh dưỡng/tập luyện (mobile)
  const [accountOpen, setAccountOpen] = useState(false);  // dropdown tài khoản
  const accRef = useRef(null);

  const toggleMobile = () => setMobileOpen(v => !v);
  const dropdownToggle = key => setOpenDropdown(prev => (prev === key ? null : key));
  const toggleAccount = () => setAccountOpen(v => !v);
  const closeAccount = () => setAccountOpen(false);

  // Đóng dropdown tài khoản khi click ra ngoài
  useEffect(() => {
    const onDocClick = (e) => {
      if (!accRef.current) return;
      if (!accRef.current.contains(e.target)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

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
              <li className="fm-menu__item"><NavLink to="/thong-ke" className="fm-link">Thống kê</NavLink></li>
              <li className="fm-menu__item"><NavLink to="/ket-noi" className="fm-link">Kết nối</NavLink></li>

              {/* DINH DƯỠNG */}
              <li className="fm-menu__item has-dropdown" onMouseLeave={() => setOpenDropdown(null)}>
                <NavLink to="/dinh-duong/nhat-ky" className="fm-link">
                  Dinh dưỡng <FontAwesomeIcon icon={faCaretDown} className="fm-caret" />
                </NavLink>
                {/* Mobile toggle */}
                <button
                  className="fm-dd-toggle"
                  aria-label="Mở Dinh dưỡng"
                  onClick={() => dropdownToggle("dd")}
                  aria-expanded={openDropdown === "dd"}
                >
                  <FontAwesomeIcon icon={faCaretDown} />
                </button>

                <div className={`fm-dropdown ${openDropdown === "dd" ? "is-open" : ""}`} role="menu" aria-haspopup="true">
                  <NavLink to="/dinh-duong/nhat-ky" className="fm-dd-link" role="menuitem">
                    <FontAwesomeIcon icon={faBookmark} /> Nhật ký
                  </NavLink>

                  <div className="fm-dd-group">
                    <NavLink to="/dinh-duong/ghi-lai" className="fm-dd-link fm-dd-link--row" role="menuitem">
                      <FontAwesomeIcon icon={faPenToSquare} />
                      <span>Ghi lại bữa ăn</span>
                      <FontAwesomeIcon icon={faAngleRight} className="fm-angle" />
                    </NavLink>
                    {/* Submenu: chỉ bung khi trỏ vào mục "Ghi lại bữa ăn" */}
                    <div className="fm-dd-sub" role="menu">
                      <NavLink to="/dinh-duong/ghi-lai/yeu-thich" className="fm-dd-sublink" role="menuitem">
                        Yêu thích của tôi
                      </NavLink>
                      <NavLink to="/dinh-duong/ghi-lai/tinh-calo-ai" className="fm-dd-sublink" role="menuitem">
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
              <li className="fm-menu__item has-dropdown" onMouseLeave={() => setOpenDropdown(null)}>
                <NavLink to="/tap-luyen/lich-cua-ban" className="fm-link">
                  Tập luyện <FontAwesomeIcon icon={faCaretDown} className="fm-caret" />
                </NavLink>
                {/* Mobile toggle */}
                <button
                  className="fm-dd-toggle"
                  aria-label="Mở Tập luyện"
                  onClick={() => dropdownToggle("tl")}
                  aria-expanded={openDropdown === "tl"}
                >
                  <FontAwesomeIcon icon={faCaretDown} />
                </button>

                <div className={`fm-dropdown ${openDropdown === "tl" ? "is-open" : ""}`} role="menu" aria-haspopup="true">
                  <NavLink to="/tap-luyen/lich-cua-ban" className="fm-dd-link" role="menuitem">
                    <FontAwesomeIcon icon={faCalendar} /> Lịch tập của bạn
                  </NavLink>

                  <div className="fm-dd-group">
                    <div className="fm-dd-link fm-dd-link--row is-accent" role="menuitem" tabIndex={0}>
                      <FontAwesomeIcon icon={faFire} />
                      <span>Các bài tập</span>
                      <FontAwesomeIcon icon={faAngleRight} className="fm-angle" />
                    </div>
                    {/* Submenu: chỉ bung khi trỏ vào mục "Các bài tập" */}
                    <div className="fm-dd-sub" role="menu">
                      <NavLink to="/tap-luyen/bai-tap/cardio" className="fm-dd-sublink" role="menuitem">Cardio</NavLink>
                      <NavLink to="/tap-luyen/bai-tap/workout" className="fm-dd-sublink" role="menuitem">Workout</NavLink>
                    </div>
                  </div>

                  <NavLink to="/tap-luyen/goi-y" className="fm-dd-link" role="menuitem">
                    <FontAwesomeIcon icon={faLightbulb} /> Gợi ý tập luyện
                  </NavLink>
                </div>
              </li>

              <li className="fm-menu__item"><NavLink to="/cong-dong" className="fm-link">Cộng đồng</NavLink></li>
              <li className="fm-menu__item"><NavLink to="/ung-dung" className="fm-link">Ứng dụng</NavLink></li>
            </ul>
          </nav>

          {/* RIGHT: HELLO + AVATAR + ACCOUNT DROPDOWN */}
          <div className="fm-right" ref={accRef}>
            <span className="fm-hello">Xin chào, <strong>{nickname}</strong></span>
            <div className="fm-avatar" title="Tài khoản" role="button" tabIndex={0} onClick={toggleAccount}>
              <img src={avatarSrc || "/images/avatar.png"} alt="Avatar" />
            </div>

            <AccountDropdown
              open={accountOpen}
              onClose={closeAccount}
              nickname={nickname}
              joinDate={joinDate}
              age={age}
              heightCm={heightCm}
              weightKg={weightKg}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

/* ================= Account Dropdown Component ================= */

function AccountDropdown({ open, onClose, nickname, joinDate, age, heightCm, weightKg }) {
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const onPickAvatar = () => fileRef.current?.click();
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    // TODO: gọi API upload sau
  };

  return (
    <div className={`acc-pop ${open ? "is-open" : ""}`} role="menu" aria-hidden={!open}>
      {/* vùng đệm 5px để không tắt ngay khi lia chuột */}
      <div className="acc-hit" />

      <div className="acc-top">
        {/* Avatar + nút đổi ảnh (nút ở góc dưới-phải avatar) */}
        <div className="acc-avatarWrap">
          <div className="acc-avatar">
            <img src={preview || "/images/avatar.png"} alt="avatar" />
          </div>
          <button
            className="acc-avatar-btn"
            title="Đổi avatar"
            aria-label="Đổi avatar"
            type="button"
            onClick={onPickAvatar}
          >
            <FontAwesomeIcon icon={faCamera} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="acc-file"
            onChange={onFile}
          />
        </div>

        <div className="acc-name">{nickname}</div>
        <div className="acc-join">Đã tham gia từ {joinDate}</div>

        <div className="acc-metrics">
          <div className="acc-metric">
            <div className="acc-metric__value">{age}</div>
            <div className="acc-metric__label">tuổi</div>
          </div>
          <div className="acc-divider" />
          <div className="acc-metric">
            <div className="acc-metric__value">{heightCm}</div>
            <div className="acc-metric__label">cm</div>
          </div>
          <div className="acc-divider" />
          <div className="acc-metric">
            <div className="acc-metric__value">{weightKg}</div>
            <div className="acc-metric__label">kg</div>
          </div>
        </div>
      </div>

      <div className="acc-menu">
        <NavLink to="/tai-khoan/ho-so" className="acc-item"><FontAwesomeIcon icon={faUser} />Hồ sơ</NavLink>
        <div className="acc-sep" />
        <NavLink to="/tin-nhan" className="acc-item"><FontAwesomeIcon icon={faMessage} />Tin nhắn</NavLink>
        <div className="acc-sep" />
        <NavLink to="/tai-khoan/tai-khoan" className="acc-item"><FontAwesomeIcon icon={faGear} />Tài khoản</NavLink>
        <div className="acc-sep" />
        <NavLink to="/ve-fitmatch" className="acc-item"><FontAwesomeIcon icon={faCircleInfo} />Về FitMatch</NavLink>
        <div className="acc-sep" />
        <NavLink to="/tai-khoan/quyen-rieng-tu" className="acc-item"><FontAwesomeIcon icon={faShieldHalved} />Chính sách quyền riêng tư</NavLink>
      </div>

      <button className="acc-logout">
        <FontAwesomeIcon icon={faRightFromBracket} /> Đăng xuất
      </button>
    </div>
  );
}
