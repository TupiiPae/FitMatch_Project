// admin-app/src/components/SidebarLayout/SidebarLayout.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext.jsx";
import "./SidebarLayout.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import logoFitmatch from "../../assets/fm-logo-name.png";
import { toast } from "react-toastify";
import { listAuditLogs } from "../../lib/api.js";

/* ---------- MUI imports ---------- */
import List from "@mui/material/List";
import ListSubheader from "@mui/material/ListSubheader";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Collapse from "@mui/material/Collapse";

import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import RestaurantOutlinedIcon from "@mui/icons-material/RestaurantOutlined";
import FitnessCenterOutlinedIcon from "@mui/icons-material/FitnessCenterOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import MailOutlineOutlinedIcon from "@mui/icons-material/MailOutlineOutlined";
import HelpOutlineOutlinedIcon from "@mui/icons-material/HelpOutlineOutlined";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ReportGmailerrorredOutlinedIcon from "@mui/icons-material/ReportGmailerrorredOutlined";

/* ----------------- Helpers chung ----------------- */

const NOTIF_READ_PREFIX = "fm_admin_notif_read_";

// Hành động -> label tiếng Việt (giống Audit_Log.jsx)
const ACTION_LABELS = {
  create: "Tạo mới",
  update: "Cập nhật",
  delete: "Xóa",
  login: "Đăng nhập",
  logout: "Đăng xuất",
  approve: "Duyệt",
  reject: "Từ chối",
  block: "Khóa",
  unblock: "Mở khóa",
  import: "Nhập dữ liệu",
  export: "Xuất dữ liệu",
};

function toActionLabel(action) {
  if (!action) return "";
  return ACTION_LABELS[action] || action;
}

// Loại tài nguyên -> label TV (giống Audit_Log.jsx)
const RESOURCE_LABELS = {
  food: "Món ăn",
  foods: "Món ăn",
  suggestMenu: "Thực đơn gợi ý",
  suggest_menu: "Thực đơn gợi ý",
  suggestPlan: "Lịch tập gợi ý",
  suggest_plan: "Lịch tập gợi ý",
  exercise: "Bài tập",
  exercise_strength: "Bài tập Strength",
  exercise_cardio: "Bài tập Cardio",
  exercise_sport: "Bài tập Sport",
  user: "Người dùng",
  admin: "Tài khoản admin",
  adminAccount: "Tài khoản admin",
};

function toResourceLabel(rt) {
  if (!rt) return "";
  return RESOURCE_LABELS[rt] || rt;
}

// Lấy thông tin từ log
const getResourceTypeFromLog = (it) =>
  it.resourceType || it.type || it.category || "";

const getResourceNameFromLog = (it) => it.resourceName || it.resourceTitle || "";

const getResourceIdFromLog = (it) => it.resourceId || it.entityId || "";

// Map resourceType -> đường dẫn edit (giống Audit_Log.jsx)
function getEditPath(resourceType, id) {
  if (!resourceType || !id) return null;
  const rt = String(resourceType);

  if (rt === "food" || rt === "foods") {
    return `/foods/${id}/edit`;
  }

  if (rt === "suggestMenu" || rt === "suggest_menu") {
    return `/foods/suggest-menu/${id}/edit`;
  }

  if (rt === "suggestPlan" || rt === "suggest_plan") {
    return `/exercises/suggest-plan/${id}/edit`;
  }

  // Bài tập
  if (rt === "exercise" || rt === "exercise_strength") {
    return `/exercises/strength/${id}/edit`;
  }
  if (rt === "exercise_cardio") {
    return `/exercises/cardio/${id}/edit`;
  }
  if (rt === "exercise_sport") {
    return `/exercises/sport/${id}/edit`;
  }

  return null;
}

function fmtDateTimeShort(v) {
  if (!v) return "";
  try {
    return new Date(v).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return String(v);
  }
}

/* ----------------- Menu sidebar (MUI) ----------------- */

const buildManagementSections = (rawLevel) => {
  const level = Number(rawLevel);

  const statsSection = {
    key: "stats",
    title: "Thống kê",
    icon: <BarChartOutlinedIcon fontSize="small" />,
    items: [
      { to: "/stats/users", label: "Người dùng" },
      { to: "/stats/journal", label: "Nhật ký" },
      { to: "/stats/matching", label: "Ghép cặp" },
      { to: "/statistics/audit-log", label: "Nhật ký thao tác" },
    ],
  };

  // Mục "Danh sách người dùng" được đưa vào nhóm Quản lý
  const usersSection = {
    key: "users",
    title: "Người dùng",
    icon: <GroupOutlinedIcon fontSize="small" />,
    items: [{ to: "/users", label: "Danh sách người dùng", exact: true }],
  };

  const foodsSection = {
    key: "foods",
    title: "Thực phẩm",
    icon: <RestaurantOutlinedIcon fontSize="small" />,
    items: [
      { to: "/foods", label: "Danh sách món ăn", exact: true },
      { to: "/foods/create", label: "Tạo món ăn mới" },
      { to: "/foods/review", label: "Duyệt món ăn người dùng" },
      {
        to: "/foods/suggest-menu",
        label: "Danh sách thực đơn gợi ý",
        exact: true,
      },
      { to: "/foods/suggest-menu/create", label: "Tạo thực đơn gợi ý" },
    ],
  };

  const exsSection = {
    key: "exs",
    title: "Bài tập",
    icon: <FitnessCenterOutlinedIcon fontSize="small" />,
    items: [
      { to: "/exercises/strength", label: "Danh sách bài tập - Strength" },
      { to: "/exercises/cardio", label: "Danh sách bài tập - Cardio" },
      { to: "/exercises/sport", label: "Danh sách các môn - Sport" },
      {
        to: "/exercises/create",
        label: "Tạo bài tập/môn thể thao mới",
        openCreateModal: true,
      },
      {
        to: "/exercises/suggest-plan",
        label: "Danh sách lịch tập gợi ý",
        exact: true,
      },
      {
        to: "/exercises/suggest-plan/create",
        label: "Tạo lịch tập gợi ý",
      },
    ],
  };

  const matchingSection = {
    key: "matching",
    title: "Ghép cặp",
    icon: <PeopleAltOutlinedIcon fontSize="small" />,
    items: [
      { to: "/matching", label: "Danh sách ghép cặp", exact: true },
      { to: "/reports", label: "Báo cáo" },
    ],
  };

  const sections = [statsSection, usersSection, foodsSection, exsSection, matchingSection];

  if (level === 1) {
    sections.splice(1, 0, {
      key: "admins",
      title: "Tài khoản quản trị",
      icon: <AdminPanelSettingsOutlinedIcon fontSize="small" />,
      items: [
        { to: "/admins", label: "Danh sách tài khoản", exact: true },
        { to: "/admins/create", label: "Tạo tài khoản" },
      ],
    });
  }

  return sections;
};

// Hỗ trợ: chỉ còn Liên hệ
const SUPPORT_PAGES = [
  { key:"contact", label:"Hỗ trợ", to:"/contact", icon:<MailOutlineOutlinedIcon fontSize="small" /> },
  { key: "faq", label: "FAQ", to: "/faq", icon: <HelpOutlineOutlinedIcon fontSize="small" />, },
];

/* ----------------- TopNav + Notifications ----------------- */

function TopNav({
  collapsed,
  onToggleSidebar,
  theme,
  onToggleTheme,
  onGoProfile,
  onOpenLogout,
}) {
  const { auth } = useAuth();
  const level = Number(auth?.profile?.level) || 2;
  const displayName =
    auth?.profile?.nickname || auth?.profile?.username || "admin";
  const adminId =
    auth?.profile?._id || auth?.profile?.id || auth?.profile?.adminId;

  const nav = useNavigate();

  // Notifications state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [readIds, setReadIds] = useState([]);
  const notifRef = useRef(null);

  // Account dropdown
  const [accOpen, setAccOpen] = useState(false);
  const accRef = useRef(null);

  // Load danh sách id đã đọc từ localStorage khi đổi admin
  useEffect(() => {
    if (!adminId) {
      setReadIds([]);
      return;
    }
    try {
      const raw = localStorage.getItem(NOTIF_READ_PREFIX + adminId);
      if (!raw) {
        setReadIds([]);
        return;
      }
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) setReadIds(arr);
      else setReadIds([]);
    } catch {
      setReadIds([]);
    }
  }, [adminId]);

  // Lưu lại readIds
  useEffect(() => {
    if (!adminId) return;
    try {
      localStorage.setItem(
        NOTIF_READ_PREFIX + adminId,
        JSON.stringify(readIds)
      );
    } catch {
      // ignore
    }
  }, [adminId, readIds]);

  // Load audit-log làm nguồn dữ liệu thông báo
  useEffect(() => {
    if (!auth?.token) return;
    let alive = true;
    (async () => {
      setNotifLoading(true);
      try {
        const res = await listAuditLogs({ limit: 30 });
        const arr = Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res)
          ? res
          : [];
        if (!alive) return;
        setNotifs(arr);
      } catch (err) {
        console.error("Load notifications failed", err);
        if (alive) toast.error("Không tải được thông báo");
      } finally {
        if (alive) setNotifLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [auth?.token]);

  const unreadCount = useMemo(() => {
    if (!notifs?.length) return 0;
    const set = new Set(readIds);
    let c = 0;
    for (const it of notifs) {
      const id = it._id || it.id;
      if (!id) continue;
      if (!set.has(id)) c++;
    }
    return c;
  }, [notifs, readIds]);

  const isUnread = (log) => {
    const id = log?._id || log?.id;
    if (!id) return false;
    return !readIds.includes(id);
  };

  const handleToggleDropdown = () => {
    setNotifOpen((o) => !o);
  };

  const handleMarkAllRead = () => {
    const ids = notifs.map((n) => n._id || n.id).filter(Boolean);
    setReadIds(ids);
  };

  const handleClickNotif = (log) => {
    const id = log?._id || log?.id;
    if (id) {
      setReadIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }
    const rt = getResourceTypeFromLog(log);
    const rid = getResourceIdFromLog(log);
    const path = getEditPath(rt, rid) || "/statistics/audit-log";
    nav(path);
    setNotifOpen(false);
  };

  // Click ngoài để đóng dropdown thông báo
  useEffect(() => {
    if (!notifOpen) return;
    const handler = (e) => {
      if (!notifRef.current) return;
      if (!notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notifOpen]);

  // Click ngoài để đóng dropdown account
  useEffect(() => {
    if (!accOpen) return;
    const handler = (e) => {
      if (!accRef.current) return;
      if (!accRef.current.contains(e.target)) {
        setAccOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [accOpen]);

  return (
    <header className="fm-topnav">
      <div className="fm-topnav__left">
        <button
          className="fm-iconbtn fm-togglebtn"
          onClick={onToggleSidebar}
          title={collapsed ? "Hiện sidebar" : "Ẩn sidebar"}
          aria-label="Toggle sidebar"
        >
          <i
            className={
              collapsed ? "fa-solid fa-angles-right" : "fa-solid fa-angles-left"
            }
          />
        </button>
      </div>

      <div className="fm-topnav__right">
        <button
          className="fm-iconbtn"
          onClick={onToggleTheme}
          title="Chế độ sáng/tối"
          aria-label="Toggle theme"
        >
          <i
            className={
              theme === "dark" ? "fa-solid fa-moon" : "fa-regular fa-sun"
            }
          />
        </button>

        {/* Notifications */}
        <div className="fm-notify-wrapper" ref={notifRef}>
          <button
            className="fm-iconbtn"
            title="Thông báo"
            aria-label="Notifications"
            onClick={handleToggleDropdown}
          >
            <i className="fa-regular fa-bell" />
            {unreadCount > 0 && (
              <span className="fm-badge">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="fm-notify-dropdown">
              <div className="fm-notify-header">
                <span className="fm-notify-title">Thông báo</span>
                <button
                  type="button"
                  className="fm-notify-markall"
                  onClick={handleMarkAllRead}
                  disabled={!unreadCount}
                >
                  Đánh dấu đã đọc tất cả
                </button>
              </div>

              <div className="fm-notify-body">
                {notifLoading && (
                  <div className="fm-notify-empty">Đang tải...</div>
                )}

                {!notifLoading && (!notifs || notifs.length === 0) && (
                  <div className="fm-notify-empty">
                    Chưa có thông báo nào gần đây
                  </div>
                )}

                {!notifLoading &&
                  notifs.map((log) => {
                    const id = log._id || log.id;
                    const actionRaw = log.action || "";
                    const actionLabel = toActionLabel(actionRaw) || "";
                    const resourceTypeRaw = getResourceTypeFromLog(log);
                    const resourceLabel =
                      toResourceLabel(resourceTypeRaw) || "";
                    const name =
                      getResourceNameFromLog(log) || "(Không có tên)";
                    const unread = isUnread(log);

                    return (
                      <button
                        key={id}
                        type="button"
                        className={
                          "fm-notify-item" + (unread ? " is-unread" : "")
                        }
                        onClick={() => handleClickNotif(log)}
                      >
                        <div className="fm-notify-main">
                          <div className="fm-notify-line1">
                            <span className="fm-notify-action">
                              {actionLabel}
                            </span>{" "}
                            <span className="fm-notify-resource">
                              {resourceLabel}
                            </span>
                          </div>
                          <div className="fm-notify-name">{name}</div>
                          <div className="fm-notify-time">
                            {fmtDateTimeShort(log.createdAt)}
                          </div>
                        </div>
                        {unread && <span className="fm-notify-dot" />}
                      </button>
                    );
                  })}
              </div>

              <div className="fm-notify-footer">
                <button
                  type="button"
                  className="fm-notify-link"
                  onClick={() => {
                    nav("/statistics/audit-log");
                    setNotifOpen(false);
                  }}
                >
                  Xem tất cả nhật ký thao tác
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Account box + dropdown */}
        <div className="fm-nav__account" ref={accRef}>
          <button
            type="button"
            className={
              "fm-account-box " +
              (level === 1
                ? "fm-account-box--level1"
                : "fm-account-box--level2")
            }
            onClick={() => setAccOpen((o) => !o)}
          >
            <i className={level === 1 ? "fa-solid fa-user" : "fa-solid fa-users"} />
            <span>
              {level === 1 ? "Admin cấp 1" : "Admin cấp 2"}
              &nbsp;&nbsp;|&nbsp;&nbsp;{displayName}
            </span>
            <i
              className={
                "fa-solid " +
                (accOpen ? "fa-chevron-up" : "fa-chevron-down") +
                " fm-account-caret"
              }
            />
          </button>

          {accOpen && (
            <div className="fm-account-dropdown">
              <button
                type="button"
                className="fm-account-item"
                onClick={() => {
                  if (typeof onGoProfile === "function") onGoProfile();
                  setAccOpen(false);
                }}
              >
                <i className="fa-regular fa-id-card" />
                <span>Thông tin tài khoản</span>
              </button>
              <button
                type="button"
                className="fm-account-item fm-account-item--logout"
                onClick={() => {
                  if (typeof onOpenLogout === "function") onOpenLogout();
                  setAccOpen(false);
                }}
              >
                <i className="fa-solid fa-arrow-right-from-bracket" />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* ----------------- Layout chính ----------------- */

export default function SidebarLayout() {
  const { auth, logout } = useAuth();
  const level = Number(auth?.profile?.level) || 2;
  const nav = useNavigate();
  const location = useLocation();

  const [theme, setTheme] = useState(
    () => localStorage.getItem("fm_theme") || "light"
  );
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("theme-dark");
    else root.classList.remove("theme-dark");
    localStorage.setItem("fm_theme", theme);
  }, [theme]);

  const [collapsed, setCollapsed] = useState(false);
  const sideCls = useMemo(
    () => "fm-side" + (collapsed ? " is-sm" : ""),
    [collapsed]
  );

  const mgmtSections = useMemo(
    () => buildManagementSections(level),
    [level]
  );

  // dropdown states sidebar (cho các list như Thống kê / Tài khoản quản trị / Thực phẩm / Bài tập / Ghép cặp)
  const [openKeys, setOpenKeys] = useState(() => new Set());
  const isOpen = (key) => openKeys.has(key);
  const toggleSection = (key) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // helper active route
  const isItemActive = (to, exact) => {
    if (!to) return false;
    if (exact) return location.pathname === to;
    return location.pathname.startsWith(to);
  };

  const isSectionActive = (sec) =>
    (sec.items || []).some((it) => isItemActive(it.to, it.exact));

  // login toast once
  const shownLoginToast = useRef(false);
  useEffect(() => {
    if (
      auth?.token &&
      !sessionStorage.getItem("fm_toasted_login") &&
      !shownLoginToast.current
    ) {
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

  // Create Exercise modal
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
            <img
              src={logoFitmatch}
              alt="FitMatch"
              className="fm-logo-rect"
            />
          </a>
        </div>

        <nav className="fm-side__nav">
          {/* Nhóm Quản lý */}
          <List
            component="nav"
            aria-labelledby="fm-sidebar-management"
            subheader={
              !collapsed && (
                <ListSubheader
                  component="div"
                  id="fm-sidebar-management"
                >
                  Quản lý
                </ListSubheader>
              )
            }
          >
            {mgmtSections.map((sec) => {
              const opened = isOpen(sec.key);
              const sectionActive = isSectionActive(sec);
              return (
                <React.Fragment key={sec.key}>
                  <ListItemButton
                    disableGutters
                    onClick={() => toggleSection(sec.key)}
                    className={
                      "fm-navitem fm-navitem--parent" +
                      (sectionActive ? " is-active" : "")
                    }
                  >
                    <ListItemIcon>{sec.icon}</ListItemIcon>
                    {!collapsed && <ListItemText primary={sec.title} />}
                    {!collapsed && (opened ? <ExpandLess /> : <ExpandMore />)}
                  </ListItemButton>
                  <Collapse in={opened} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {(sec.items || []).map((it) => {
                        const active = isItemActive(it.to, it.exact);
                        if (it.openCreateModal) {
                          return (
                            <ListItemButton
                              key={it.to}
                              disableGutters
                              className="fm-navitem fm-navitem--child"
                              onClick={openCreateExModal}
                            >
                              <ListItemIcon>
                                <FiberManualRecordIcon sx={{ fontSize: 8 }} />
                              </ListItemIcon>
                              {!collapsed && (
                                <ListItemText primary={it.label} />
                              )}
                            </ListItemButton>
                          );
                        }
                        return (
                          <ListItemButton
                            key={it.to}
                            disableGutters
                            className={
                              "fm-navitem fm-navitem--child" +
                              (active ? " is-active" : "")
                            }
                            onClick={() => nav(it.to)}
                          >
                            <ListItemIcon>
                              <FiberManualRecordIcon sx={{ fontSize: 8 }} />
                            </ListItemIcon>
                            {!collapsed && (
                              <ListItemText primary={it.label} />
                            )}
                          </ListItemButton>
                        );
                      })}
                    </List>
                  </Collapse>
                </React.Fragment>
              );
            })}
          </List>

          {/* Hỗ trợ: chỉ Liên hệ */}
          <List
            component="nav"
            aria-labelledby="fm-sidebar-support"
            subheader={
              !collapsed && (
                <ListSubheader component="div" id="fm-sidebar-support">
                  Hỗ trợ
                </ListSubheader>
              )
            }
          >
            {SUPPORT_PAGES.map((p) => {
              const active = isItemActive(p.to, true);
              return (
                <ListItemButton
                  key={p.key}
                  disableGutters
                  className={
                    "fm-navitem fm-navitem--simple" +
                    (active ? " is-active" : "")
                  }
                  onClick={() => nav(p.to)}
                >
                  <ListItemIcon>{p.icon}</ListItemIcon>
                  {!collapsed && <ListItemText primary={p.label} />}
                </ListItemButton>
              );
            })}
          </List>
        </nav>
      </aside>

      <main className="fm-main">
        <TopNav
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((v) => !v)}
          theme={theme}
          onToggleTheme={() =>
            setTheme((t) => (t === "dark" ? "light" : "dark"))
          }
          onGoProfile={goProfile}
          onOpenLogout={openConfirm}
        />
        <div className="fm-content">
          <Outlet />
        </div>
      </main>

      {/* Logout Modal */}
      {showConfirm && (
        <div className="fm-modal-overlay" onClick={closeConfirm}>
          <div
            className="fm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
          >
            <div className="fm-modal__icon">
              <i className="fa-solid fa-circle-question" />
            </div>
            <h3 id="logout-title" className="fm-modal__title">
              Xác nhận đăng xuất
            </h3>
            <p className="fm-modal__text">
              Bạn có chắc chắn muốn đăng xuất khỏi trang quản trị?
            </p>
            <div className="fm-modal__actions">
              <button className="fm-btn ghost" onClick={closeConfirm}>
                Hủy
              </button>
              <button className="fm-btn danger" onClick={doLogout}>
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Exercise Modal */}
      {showCreateExModal && (
        <div className="fm-modal-overlay" onClick={closeCreateExModal}>
          <div
            className="fm-modal fm-modal--create"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="createex-title"
          >
            <h3 className="fm-modal__text">Chọn dữ liệu cần tạo:</h3>

            <div className="fm-modal__grid">
              <button
                className="fm-option"
                onClick={() => goCreate("Strength")}
              >
                <div className="fm-option__title">Tạo bài tập</div>
                <div className="fm-option__desc">Strength</div>
              </button>

              <button
                className="fm-option"
                onClick={() => goCreate("Cardio")}
              >
                <div className="fm-option__title">Tạo bài tập</div>
                <div className="fm-option__desc">Cardio</div>
              </button>

              <button
                className="fm-option"
                onClick={() => goCreate("Sport")}
              >
                <div className="fm-option__title">Tạo môn thể thao</div>
                <div className="fm-option__desc">Sport</div>
              </button>
            </div>

            <div className="fm-modal__actions">
              <button className="fm-btn ghost" onClick={closeCreateExModal}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
