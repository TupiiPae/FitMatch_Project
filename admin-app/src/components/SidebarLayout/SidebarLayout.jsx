// src/components/SidebarLayout/SidebarLayout.jsx
import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import "./SidebarLayout.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import logoFitmatch from "../../assets/logo-fitmatch.png";

// ép Number(level) ở tham số vào
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
        { to: "/exercises",           label: "Danh sách bài tập", exact: true },
        { to: "/exercises/create",    label: "Tạo bài tập" },
        { to: "/exercises/schedules", label: "Tạo lịch tập" },
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

// mở đúng section theo pathname (hỗ trợ exact)
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

function TopNav({ collapsed, onToggleSidebar, theme, onToggleTheme, onLogout }) {
  const { auth } = useAuth();
  const level = Number(auth?.profile?.level);
  const username = auth?.profile?.username || "admin";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const off = (e) => { if (!e.target.closest(".fm-nav__account")) setOpen(false); };
    document.addEventListener("click", off);
    return () => document.removeEventListener("click", off);
  }, []);

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
          <button className="fm-avatarbtn" onClick={() => setOpen(v=>!v)}>
            <div className="fm-avatar">{username.slice(0,1).toUpperCase()}</div>
            <span className="fm-username">{username}</span>
            <i className="fa-solid fa-chevron-down fm-caret" />
          </button>
          {open && (
            <div className="fm-menu">
              {level === 2 && (
                <NavLink to="/profile" className="fm-menu__item">Chỉnh sửa tài khoản</NavLink>
              )}
              <button className="fm-menu__item is-danger" onClick={onLogout}>Đăng xuất</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default function SidebarLayout(){
  const { auth, logout } = useAuth();
  // ép số + fallback 2 (để lv2 vẫn dùng được menu còn lại)
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

        <div className="fm-logout-fixed">
          {level === 2 && (
            <NavLink to="/profile" className="fm-link fm-link--ghost" onClick={() => collapsed && setCollapsed(false)}>
              Thông tin tài khoản
            </NavLink>
          )}
          <button className="fm-btn-danger w-full" onClick={logout}>Đăng xuất</button>
        </div>
      </aside>

      <main className="fm-main">
        <TopNav
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed(v=>!v)}
          theme={theme}
          onToggleTheme={() => setTheme(t => (t === "dark" ? "light" : "dark"))}
          onLogout={logout}
        />
        <div className="fm-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
