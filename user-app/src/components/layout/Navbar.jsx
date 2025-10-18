import React, { useEffect, useRef, useState, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCaretDown, faAngleRight, faCalendar, faFire, faLightbulb, faPenToSquare,
  faBookmark, faRightFromBracket, faUser, faMessage, faGear, faCircleInfo,
  faShieldHalved, faCamera
} from "@fortawesome/free-solid-svg-icons";
import { getMe } from "../../api/account";
import api from "../../lib/api";
import { toast } from "react-toastify";

const logoHref =
  (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/") +
  "images/logo-fitmatch.png";

// Helpers
const fmtDate = (iso) => {
  if (!iso) return "xx/xx/xxxx";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "xx/xx/xxxx";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

const calcAge = (dob) => {
  if (!dob || typeof dob !== "string") return "xx";
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(dob);
  if (!m) return "xx";
  const [y, mo, d] = dob.split("-").map(Number);
  const birth = new Date(y, (mo || 1) - 1, d || 1);
  if (Number.isNaN(birth.getTime())) return "xx";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const md = today.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 && age <= 120 ? String(age) : "xx";
};

// Build absolute URL + cache bust
const apiBase = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) || api.defaults?.baseURL || "";
const toAbs = (u) => (u ? new URL(u, apiBase).toString() : u);
const withBust = (u) => (u ? `${u}${u.includes("?") ? "&" : "?"}t=${Date.now()}` : u);

export default function Navbar({
  nickname: nicknameProp = "Bạn",
  avatarSrc: avatarProp,
  joinDate: joinDateProp = "xx/xx/xxxx",
  age: ageProp = "xx",
  heightCm: heightProp = "xxx",
  weightKg: weightProp = "xx",
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [openLogout, setOpenLogout] = useState(false);

  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const accRef = useRef(null);

  // Fetch /api/user/me
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const u = await getMe(); // should return res.data.user
        if (!mounted) return;
        setMe(u || null);
      } catch {
        if (!mounted) return;
        setMe(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const p = me?.profile || {};
  const displayNickname = p.nickname || me?.username || nicknameProp || "Bạn";
  const displayJoinDate = fmtDate(me?.createdAt) || joinDateProp;
  const displayAge      = (p.dob ? calcAge(p.dob) : ageProp) || "xx";
  const displayHeight   = (typeof p.heightCm === "number" ? p.heightCm : heightProp) || "xxx";
  const displayWeight   = (typeof p.weightKg === "number" ? p.weightKg : weightProp) || "xx";

  // Avatar ưu tiên DB → props → default
  const avatarFromDb = useMemo(() => {
    if (!p?.avatarUrl) return null;
    return withBust(toAbs(p.avatarUrl));
  }, [p?.avatarUrl]);

  const displayAvatar = avatarFromDb || avatarProp || "/images/avatar.png";

  const toggleMobile = () => setMobileOpen(v => !v);
  const dropdownToggle = key => setOpenDropdown(prev => (prev === key ? null : key));
  const toggleAccount = () => setAccountOpen(v => !v);
  const closeAccount = () => setAccountOpen(false);

  // Click outside to close account dropdown
  useEffect(() => {
    const onDocClick = (e) => {
      if (!accRef.current) return;
      if (!accRef.current.contains(e.target)) setAccountOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Esc close logout modal
  useEffect(() => {
    if (!openLogout) return;
    const onKey = (e) => { if (e.key === "Escape") setOpenLogout(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openLogout]);

  // Upload avatar từ dropdown nhanh
  const uploadAvatarQuick = async (file) => {
    try {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Vui lòng chọn tệp hình ảnh!");
        return;
      }
      const MAX = 2 * 1024 * 1024;
      if (file.size > MAX) {
        toast.error("Kích thước ảnh tối đa 2MB");
        return;
      }
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await api.post("/api/user/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const updated = res?.data?.user;
      if (updated) setMe(updated);
      toast.success("Đã cập nhật ảnh đại diện!");
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Upload avatar thất bại";
      toast.error(msg);
    }
  };

  // Đăng xuất
  const handleLogout = async () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("jwt");
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <header className="fm-header" role="banner">
      <div className="fm-nav">
        <div className="fm-nav-grid">
          {/* LEFT: LOGO */}
          <div className="fm-left">
            <button className="fm-burger" aria-label="Mở menu" onClick={toggleMobile}>
              <span /><span /><span />
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
            <span className="fm-hello">
              Xin chào, <strong>{displayNickname}</strong>
              {loading ? "…" : ""}
            </span>
            <div className="fm-avatar" title="Tài khoản" role="button" tabIndex={0} onClick={toggleAccount}>
              <img src={displayAvatar} alt="Avatar" />
            </div>

            <AccountDropdown
              open={accountOpen}
              onClose={closeAccount}
              nickname={displayNickname}
              joinDate={displayJoinDate}
              age={displayAge}
              heightCm={displayHeight}
              weightKg={displayWeight}
              avatarUrl={displayAvatar}
              onUploadAvatar={uploadAvatarQuick}
              onAskLogout={() => { setAccountOpen(false); setOpenLogout(true); }}
            />
          </div>
        </div>
      </div>

      {/* Modal xác nhận Đăng xuất */}
      {openLogout && (
        <div className="logout-modal" role="dialog" aria-modal="true" aria-labelledby="logout-title">
          <div className="logout-backdrop" onClick={() => setOpenLogout(false)} />
          <div className="logout-dialog card" role="document">
            <div id="logout-title" className="logout-title">Đăng xuất tài khoản?</div>
            <p className="logout-desc">Bạn sắp đăng xuất khỏi FitMatch. Bạn có chắc chắn muốn tiếp tục?</p>
            <div className="logout-actions">
              <button className="btn-secondary" type="button" onClick={() => setOpenLogout(false)}>Hủy</button>
              <button className="btn-danger" type="button" onClick={handleLogout}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

/* ================= Account Dropdown Component ================= */

function AccountDropdown({ open, onClose, nickname, joinDate, age, heightCm, weightKg, avatarUrl, onUploadAvatar, onAskLogout }) {
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    // reset preview khi đóng
    if (!open) setPreview(null);
  }, [open]);

  const onPickAvatar = () => fileRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // hiển thị tạm trước
    const url = URL.createObjectURL(file);
    setPreview(url);
    await onUploadAvatar?.(file); // gọi API upload nhanh
  };

  return (
    <div className={`acc-pop ${open ? "is-open" : ""}`} role="menu" aria-hidden={!open}>
      <div className="acc-hit" />

      <div className="acc-top">
        <div className="acc-avatarWrap">
          <div className="acc-avatar">
            <img src={preview || avatarUrl || "/images/avatar.png"} alt="avatar" />
          </div>
          <button className="acc-avatar-btn" title="Đổi avatar" aria-label="Đổi avatar" type="button" onClick={onPickAvatar}>
            <FontAwesomeIcon icon={faCamera} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="acc-file" onChange={onFile} />
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

      <button className="acc-logout" type="button" onClick={onAskLogout}>
        <FontAwesomeIcon icon={faRightFromBracket} /> Đăng xuất
      </button>
    </div>
  );
}
