import React, { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import "./SidebarLayout.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import logoFitmatch from "../../assets/logo-fitmatch.png";
import { toast } from "react-toastify";

const buildManagementSections = (rawLevel) => {
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
      title: "Thực phẩm",
      icon: "fa-solid fa-utensils",
      items: [
        { to: "/foods",              label: "Danh sách món ăn", exact: true },
        { to: "/foods/create",       label: "Tạo món ăn mới" },
        { to: "/foods/review",       label: "Duyệt món ăn người dùng" },
        { to: "/foods/suggest-menu",       label: "Danh sách thực đơn gợi ý", exact: true },
        { to: "/foods/suggest-menu/create", label: "Tạo thực đơn gợi ý" },
      ],
    },
    {
      key: "exs",
      title: "Bài tập",
      icon: "fa-solid fa-dumbbell",
      items: [
        { to: "/exercises/strength", label: "Danh sách bài tập - Strength",},
        { to: "/exercises/cardio",   label: "Danh sách bài tập - Cardio" },
        { to: "/exercises/sport",    label: "Danh sách các môn - Sport" },
        { to: "/exercises/create",   label: "Tạo bài tập/môn thể thao mới", openCreateModal: true },
        { to: "/exercises/suggest-plan",  label: "Danh sách lịch tập gợi ý", exact: true},
        { to: "/exercises/suggest-plan/create", label: "Tạo lịch tập gợi ý" },
      ],
    },
    {
      key: "matching",
      title: "Ghép cặp",
      icon: "fa-solid fa-people-arrows",
      items: [
        { to: "/matching", label: "Danh sách ghép cặp", exact: true },
        { to: "/reports",  label: "Báo cáo" },
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

const subLinkClass = ({ isActive }) =>
  "fm-sublink" + (isActive ? " is-active" : "");

function TopNav({ collapsed, onToggleSidebar, theme, onToggleTheme }) {
  const { auth } = useAuth();
  const level = Number(auth?.profile?.level) || 2;
  const displayName = auth?.profile?.nickname || auth?.profile?.username || "admin";

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
              <span>Admin cấp 1&nbsp;&nbsp;|&nbsp;&nbsp;{displayName}</span>
            </div>
          ) : (
            <div className="fm-account-box fm-account-box--level2">
              <i className="fa-solid fa-users" />
              <span>Admin cấp 2&nbsp;&nbsp;|&nbsp;&nbsp;{displayName}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default function SidebarLayout(){
  const { auth, logout } = useAuth();
  const level = Number(auth?.profile?.level) || 2;
  const nav = useNavigate();

  const [theme, setTheme] = useState(() => localStorage.getItem("fm_theme") || "light");
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("theme-dark");
    else root.classList.remove("theme-dark");
    localStorage.setItem("fm_theme", theme);
  }, [theme]);

  const [collapsed, setCollapsed] = useState(false);
  const sideCls = useMemo(() => "fm-side" + (collapsed ? " is-sm" : ""), [collapsed]);

  const mgmtSections = useMemo(() => buildManagementSections(level), [level]);

  // dropdown states
  const [openKeys, setOpenKeys] = useState(() => new Set());
  const isOpen = (key) => openKeys.has(key);
  const toggleSection = (key) => {
    setOpenKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // login toast once
  const shownLoginToast = useRef(false);
  useEffect(() => {
    if (auth?.token && !sessionStorage.getItem("fm_toasted_login") && !shownLoginToast.current) {
      shownLoginToast.current = true;
      sessionStorage.setItem("fm_toasted_login", "1");
      toast.success("Đăng nhập thành công!");
    }
  }, [auth?.token]);

  // logout modal
  const [showConfirm, setShowConfirm] = useState(false);
  const openConfirm = () => setShowConfirm(true);
  const closeConfirm = () => setShowConfirm(false);
  const doLogout = () => {
    closeConfirm();
    logout();
    toast.success("Đăng xuất thành công!");
  };

  // ===== NEW: Create Exercise modal =====
  const [showCreateExModal, setShowCreateExModal] = useState(false);
  const openCreateExModal = () => setShowCreateExModal(true);
  const closeCreateExModal = () => setShowCreateExModal(false);
  const goCreate = (type) => {
    closeCreateExModal();
    if (type === "Strength") nav("/exercises/strength/create");
    else if (type === "Cardio") nav("/exercises/cardio/create");
    else if (type === "Sport") nav("/exercises/sport/create");
  };

  const goProfile = () => {
    nav("/profile");
    if (collapsed) setCollapsed(false);
  };

  return (
    <div className="fm-layout">
      <aside className={sideCls}>
        <div className="fm-side__logo">
          <a className="fm-logo-link" href="#" aria-label="Trang chủ admin">
            <img src={logoFitmatch} alt="FitMatch" className="fm-logo-rect" />
          </a>
        </div>

        <nav className="fm-side__nav">
          <div className="fm-cat">Quản lý</div>

          {mgmtSections.map((sec) => {
            const opened = isOpen(sec.key);
            return (
              <div key={sec.key} className={"fm-sec" + (opened ? " is-open" : "")}>
                <button
                  className="fm-sec__head"
                  onClick={() => toggleSection(sec.key)}
                  aria-expanded={opened}
                >
                  <div className="fm-sec__title">
                    <i className={sec.icon + " fm-sec__icon"} aria-hidden="true" />
                    <span className="fm-sec__text">{sec.title}</span>
                  </div>
                  <i className={"fa-solid " + (opened ? "fa-minus" : "fa-plus") + " fm-expander"} />
                </button>

                <div className="fm-sec__body">
                  {(sec.items || []).map((it) => {
                    // intercept item that should open modal
                    if (it.openCreateModal) {
                      return (
                        <button
                          type="button"
                          key={it.to}
                          className="fm-sublink fm-sublink--btn"
                          onClick={openCreateExModal}
                          aria-haspopup="dialog"
                        >
                          <span className="fm-sublink__text">{it.label}</span>
                        </button>
                      );
                    }
                    return (
                      <NavLink
                        key={it.to}
                        to={it.to}
                        end={it.exact}
                        className={subLinkClass}
                      >
                        <span className="fm-sublink__text">{it.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="fm-cat fm-cat--settings">Hồ sơ</div>

          <button className="fm-sec__head fm-sec__head--single" onClick={goProfile} title="Thông tin tài khoản">
            <div className="fm-sec__title">
              <i className="fa-solid fa-id-card fm-sec__icon" />
              <span className="fm-sec__text">Thông tin tài khoản</span>
            </div>
          </button>
        </nav>

        <div className="fm-logout-fixed">
          <button className="fm-btn-danger w-full" onClick={openConfirm} title="Đăng xuất">
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

      {/* Logout Modal */}
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

      {/* ===== Create Exercise Modal ===== */}
      {showCreateExModal && (
        <div className="fm-modal-overlay" onClick={closeCreateExModal}>
          <div
            className="fm-modal fm-modal--create"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="createex-title"
          >

            <h3 className="fm-modal__text">
              Chọn dữ liệu cần tạo:
            </h3>

            <div className="fm-modal__grid">
              <button className="fm-option" onClick={() => goCreate("Strength")}>
                <div className="fm-option__title">Tạo bài tập</div>
                <div className="fm-option__desc">Strength</div>
              </button>

              <button className="fm-option" onClick={() => goCreate("Cardio")}>
                <div className="fm-option__title">Tạo bài tập</div>
                <div className="fm-option__desc">Cardio</div>
              </button>

              <button className="fm-option" onClick={() => goCreate("Sport")}>
                <div className="fm-option__title">Tạo môn thể thao</div>
                <div className="fm-option__desc">Sport</div>
              </button>
            </div>

            <div className="fm-modal__actions">
              <button className="fm-btn ghost" onClick={closeCreateExModal}>Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
