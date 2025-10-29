// src/components/SidebarLayout/SidebarLayout.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import "./SidebarLayout.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import logoFitmatch from "../../assets/logo-fitmatch.png";

// Chỉ cần toast (Container đã ở main.jsx)
import { toast } from "react-toastify";

// SECTIONS & linkClass & findParentKeyByPath giữ nguyên
const SECTIONS = (rawLevel) => {
  const level = Number(rawLevel);
  return [
    {
      key: "stats",
      title: "Thống kê",
      icon: "fa-solid fa-chart-line",
      items: [
        { to: "/stats/users",    label: "Người dùng" },
        { to: "/stats/journal",  label: "Nhật ký" },
        { to: "/stats/matching", label: "Ghép cặp" },
      ],
    },
    ...(level === 1
      ? [{
          key: "admins",
          title: "Tài khoản quản trị",
          icon: "fa-solid fa-user-shield",
          items: [
            { to: "/admins",        label: "Danh sách tài khoản", exact: true },
            { to: "/admins/create", label: "Tạo tài khoản" },
          ],
        }]
      : []),
    {
      key: "foods",
      title: "Các món ăn",
      icon: "fa-solid fa-bowl-food",
      items: [
        { to: "/foods",        label: "Danh sách các món ăn", exact: true },
        { to: "/foods/create", label: "Tạo món ăn" },
        { to: "/foods/review", label: "Duyệt món người dùng" },
      ],
    },
    {
      key: "exs",
      title: "Các bài tập",
      icon: "fa-solid fa-dumbbell",
      items: [
        { to: "/exercises",            label: "Danh sách bài tập", exact: true },
        { to: "/exercises/create",     label: "Tạo bài tập" },
        { to: "/exercises/schedules",  label: "Tạo lịch tập" },
      ],
    },
    {
      key: "matching",
      title: "Ghép cặp",
      icon: "fa-solid fa-people-arrows",
      items: [
        { to: "/matching", label: "Danh sách ghép cặp", exact: true },
        { to: "/reports",  label: "Report" },
      ],
    },
    {
      key: "users",
      title: "Người dùng",
      icon: "fa-solid fa-users",
      items: [
        { to: "/users", label: "Danh sách người dùng", exact: true },
      ],
    },
  ];
};

const linkClass = ({ isActive }) => "fm-link" + (isActive ? " is-active" : "");

function findParentKeyByPath(pathname, sections) {
  for (const s of sections) {
    for (const it of s.items) {
      if (it.exact) {
        if (pathname === it.to) return s.key;
      } else if (pathname.startsWith(it.to)) {
        return s.key;
      }
    }
  }
  return null;
}

// ---------------- TopNav (giữ nguyên logic, UI tinh chỉnh) ----------------
function TopNav({ collapsed, onToggleSidebar, theme, onToggleTheme }) {
  const { auth } = useAuth();
  const level = Number(auth?.profile?.level) || 2;
  const username = auth?.profile?.username || "admin";

  return (
    <header className="fm-topnav">
      <div className="fm-topnav__left">
        <button
          className="fm-iconbtn fm-togglebtn"
          onClick={onToggleSidebar}
          title={collapsed ? "Hiện sidebar" : "Ẩn sidebar"}
          aria-label="Toggle sidebar"
        >
          <i className={collapsed ? "fa-solid fa-angles-right" : "fa-solid fa-angles-left"} />
        </button>
      </div>

      <div className="fm-topnav__right">
        <button className="fm-iconbtn" onClick={onToggleTheme} title="Chế độ sáng/tối" aria-label="Toggle theme">
          <i className={theme === "dark" ? "fa-solid fa-moon" : "fa-regular fa-sun"} />
        </button>
        <button className="fm-iconbtn" title="Thông báo" aria-label="Notifications">
          <i className="fa-regular fa-bell" />
          <span className="fm-dot" />
        </button>

        <div className="fm-nav__account">
          {level === 1 ? (
            <div className="fm-account-box fm-account-box--level1">
              <i className="fa-solid fa-user" />
              <span>Admin cấp 1&nbsp;&nbsp;|&nbsp;&nbsp;{username}</span>
            </div>
          ) : (
            <div className="fm-account-box fm-account-box--level2">
              <i className="fa-solid fa-users" />
              <span>Admin cấp 2&nbsp;&nbsp;|&nbsp;&nbsp;{username}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ------------------------ SidebarLayout ------------------------
export default function SidebarLayout(){
  const { auth, logout } = useAuth();
  const level = Number(auth?.profile?.level) || 2;
  const location = useLocation();

  const [theme, setTheme] = useState(() => localStorage.getItem("fm_theme") || "light");
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("theme-dark");
    else root.classList.remove("theme-dark");
    localStorage.setItem("fm_theme", theme);
  }, [theme]);

  const [collapsed, setCollapsed] = useState(false);
  const sideCls = useMemo(() => "fm-side" + (collapsed ? " is-sm" : ""), [collapsed]);

  const sections = useMemo(() => SECTIONS(level), [level]);

  const parentKey = findParentKeyByPath(location.pathname, sections);
  const [openKey, setOpenKey] = useState(parentKey);
  useEffect(() => setOpenKey(parentKey), [parentKey]);

  const isOpen = (key) => !collapsed && key === openKey;

  const onClickSectionHead = (key) => {
    if (collapsed) { setCollapsed(false); setOpenKey(key); }
    else { setOpenKey((k) => (k === key ? null : key)); }
  };
  const onClickChild = () => { if (collapsed) setCollapsed(false); };
  const onIconOnlyClick = (key) => { setCollapsed(false); setOpenKey(key); };

  // --------- Toast đăng nhập thành công (mỗi tab 1 lần) ---------
  const shownLoginToast = useRef(false);
  useEffect(() => {
    // Nếu đã có auth (đang đăng nhập) và chưa toast trong tab này
    if (auth?.token && !sessionStorage.getItem("fm_toasted_login") && !shownLoginToast.current) {
      shownLoginToast.current = true;
      sessionStorage.setItem("fm_toasted_login", "1");
      toast.success("Đăng nhập thành công!");
    }
  }, [auth?.token]);

  // --------- Modal xác nhận đăng xuất ---------
  const [showConfirm, setShowConfirm] = useState(false);
  const openConfirm = () => setShowConfirm(true);
  const closeConfirm = () => setShowConfirm(false);
  const doLogout = () => {
    closeConfirm();
    logout();                // giữ nguyên logic gốc
    toast.success("Đăng xuất thành công!");
  };

  return (
    <div className="fm-layout">
      <aside className={sideCls}>
        {/* Logo */}
        <div className="fm-side__logo">
          <a className="fm-logo-link" href="#" aria-label="Trang chủ admin">
            <img src={logoFitmatch} alt="FitMatch" className="fm-logo-rect" />
          </a>
        </div>

        <nav className="fm-side__nav">
          {sections.map((sec) => {
            const opened = isOpen(sec.key);
            return (
              <div key={sec.key} className={"fm-sec" + (opened ? " is-open" : "")}>
                <button className="fm-sec__head" onClick={() => onClickSectionHead(sec.key)}>
                  <div className="fm-sec__title">
                    <i
                      className={sec.icon + " fm-sec__icon"}
                      aria-hidden="true"
                      onClick={(e) => { if (collapsed) { e.stopPropagation(); onIconOnlyClick(sec.key); } }}
                    />
                    <span className="fm-sec__text">{sec.title}</span>
                  </div>
                  <i className="fa-solid fa-chevron-down fm-caret" />
                </button>

                <div className="fm-sec__body">
                  {sec.items.map((it) => (
                    <NavLink key={it.to} to={it.to} end={it.exact} className={linkClass} onClick={onClickChild}>
                      {it.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
          <div style={{ height: 72 }} />
        </nav>

        {/* Khối cố định dưới cùng: "Thông tin tài khoản" dạng menu + nút đăng xuất */}
        <div className="fm-logout-fixed">
          {level === 2 && (
            <NavLink
              to="/profile"
              className="fm-link fm-link--profile"
              onClick={() => collapsed && setCollapsed(false)}
            >
              <i className="fa-regular fa-id-card fm-link__icon" />
              <span>Thông tin tài khoản</span>
            </NavLink>
          )}
          <button className="fm-btn-danger w-full" onClick={openConfirm}>
            <i className="fa-solid fa-arrow-right-from-bracket" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      <main className="fm-main">
        <TopNav
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed(v=>!v)}
          theme={theme}
          onToggleTheme={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
        />
        <div className="fm-content">
          <Outlet />
        </div>
      </main>

      {/* Modal xác nhận Đăng xuất */}
      {showConfirm && (
        <div className="fm-modal-overlay" onClick={closeConfirm}>
          <div className="fm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="logout-title">
            <div className="fm-modal__icon">
              <i className="fa-solid fa-circle-question" />
            </div>
            <h3 id="logout-title" className="fm-modal__title">Xác nhận đăng xuất</h3>
            <p className="fm-modal__text">Bạn có chắc chắn muốn đăng xuất khỏi trang quản trị?</p>
            <div className="fm-modal__actions">
              <button className="fm-btn ghost" onClick={closeConfirm}>Hủy</button>
              <button className="fm-btn danger" onClick={doLogout}>Đăng xuất</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
