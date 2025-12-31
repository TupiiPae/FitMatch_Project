import React, { useEffect, useRef, useState, useMemo } from "react";
// Import thêm useLocation
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCaretDown, faAngleRight, faCalendar, faFire, faLightbulb, faPenToSquare,
  faBookmark, faRightFromBracket, faUser, faMessage, faGear, faCircleInfo,
  faShieldHalved, faCamera, faChartLine, faUserFriends, faMobileAlt,
  faAppleAlt, faUtensils, faBrain, faCalculator, faBookOpen,
  faHeartPulse, faPersonRunning, faDumbbell, faVolleyball,
  faClipboard,faClipboardList,faClipboardCheck,faBell,
} from "@fortawesome/free-solid-svg-icons";
import { getMe } from "../../api/account";
import api from "../../lib/api";
import { toast } from "react-toastify";
import { getSocket } from "../../lib/socket";
import NotificationBell from "../NotificationBell/NotificationBell";
import ChatBell from "../ChatBell/ChatBell";

const logoHref =
  (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/") +
  "images/fm-logo-name.png";

// Helpers (KHÔNG THAY ĐỔI)
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

const apiBase = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) || api.defaults?.baseURL || "";
const toAbs = (u) => (u ? new URL(u, apiBase).toString() : u);
const withBust = (u) => (u ? `${u}${u.includes("?") ? "&" : "?"}t=${Date.now()}` : u);
// (HẾT Helpers)

export default function Navbar({
  nickname: nicknameProp = "Bạn",
  avatarSrc: avatarProp,
  joinDate: joinDateProp = "xx/xx/xxxx",
  age: ageProp = "xx",
  heightCm: heightProp = "xxx",
  weightKg: weightProp = "xx",
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null); // Giữ cho mobile
  const [accountOpen, setAccountOpen] = useState(false);
  const [openLogout, setOpenLogout] = useState(false);

    // ================= NOTIFICATIONS =================
  const nav = useNavigate();

  const [notiOpen, setNotiOpen] = useState(false);
  const [notiLoading, setNotiLoading] = useState(false);
  const [notiItems, setNotiItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const safeArr = (v) => (Array.isArray(v) ? v : []);

  const parseNotiList = (res) => {
    // hỗ trợ nhiều kiểu responseOk/res.data
    const d = res?.data ?? res;
    const data = d?.data ?? d;
    const items =
      data?.items ??
      data?.notifications ??
      data?.rows ??
      (Array.isArray(data) ? data : []);
    return safeArr(items);
  };

  const fetchNotifications = async ({ silent = false } = {}) => {
    try {
      if (!silent) setNotiLoading(true);

      // ✅ bạn có thể tạo endpoint này trên BE:
      // GET /api/notifications?limit=20
      const r = await api.get("/api/notifications", { params: { limit: 20 } });
      const items = parseNotiList(r);

      setNotiItems(items);

      // nếu API trả kèm unread -> dùng luôn, không thì tính tạm
      const unread =
        Number(r?.data?.data?.unread ?? r?.data?.unread ?? NaN);
      if (Number.isFinite(unread)) setUnreadCount(unread);
      else setUnreadCount(items.filter((x) => !x?.readAt).length);
    } catch (e) {
      // nếu bạn chưa làm API, phần realtime vẫn chạy
    } finally {
      if (!silent) setNotiLoading(false);
    }
  };

  const markRead = async (id) => {
    if (!id) return;
    // PATCH /api/notifications/:id/read
    try {
      await api.patch(`/api/notifications/${id}/read`);
    } catch {}
    setNotiItems((prev) =>
      prev.map((x) =>
        String(x?._id) === String(id) ? { ...x, readAt: x.readAt || new Date().toISOString() } : x
      )
    );
    setUnreadCount((c) => Math.max(0, Number(c || 0) - 1));
  };

  const markAllRead = async () => {
    // PATCH /api/notifications/read-all
    try {
      await api.patch("/api/notifications/read-all");
    } catch {}
    setNotiItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() })));
    setUnreadCount(0);
  };

  const goByNoti = async (n) => {
    if (!n) return;

    const id = String(n?._id || "");
    if (id) await markRead(id);

    const type = String(n?.type || "");
    const data = n?.data || {};

    setNotiOpen(false);

    // map route theo type (bạn có thể mở rộng thêm)
    if (type === "chat_message" && data?.conversationId) {
      nav(`/tin-nhan?conversationId=${encodeURIComponent(String(data.conversationId))}`, {
        state: { conversationId: String(data.conversationId) },
      });
      return;
    }

    // match request / accept / reject => về trang kết nối
    if (type.startsWith("match_") || type.includes("group_") || type.includes("duo")) {
      nav("/ket-noi");
      return;
    }

    // fallback
    nav("/home");
  };

  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);

  const accRef = useRef(null);
  const location = useLocation(); // Thêm hook location

  // Logic fetch /api/user/me (KHÔNG THAY ĐỔI)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const u = await getMe();
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

    // Realtime notifications
  useEffect(() => {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("jwt");

    if (!token) return;

    // load lần đầu (nếu bạn đã có API)
    fetchNotifications({ silent: true });

    const s = getSocket?.();
    if (!s) return;

    const onNew = (n) => {
      if (!n) return;

      // prepend item
      setNotiItems((prev) => {
        const id = String(n?._id || "");
        if (id && prev.some((x) => String(x?._id) === id)) return prev;
        return [n, ...prev].slice(0, 30);
      });

      // tăng badge (server cũng sẽ bắn noti:count)
      if (!n?.readAt) setUnreadCount((c) => Number(c || 0) + 1);
    };

    const onCount = (p) => {
      const u = Number(p?.unread ?? p?.count ?? NaN);
      if (Number.isFinite(u)) setUnreadCount(u);
    };

    s.on("noti:new", onNew);
    s.on("noti:count", onCount);

    return () => {
      s.off("noti:new", onNew);
      s.off("noti:count", onCount);
    };
  }, []);

  // Logic xử lý props (KHÔNG THAY ĐỔI)
  const p = me?.profile || {};
  const displayNickname = p.nickname || me?.username || nicknameProp || "Bạn";
  const displayJoinDate = fmtDate(me?.createdAt) || joinDateProp;
  const displayAge = (p.dob ? calcAge(p.dob) : ageProp) || "xx";
  const displayHeight = (typeof p.heightCm === "number" ? p.heightCm : heightProp) || "xxx";
  const displayWeight = (typeof p.weightKg === "number" ? p.weightKg : weightProp) || "xx";

  const avatarFromDb = useMemo(() => {
    if (!p?.avatarUrl) return null;
    return withBust(toAbs(p.avatarUrl));
  }, [p?.avatarUrl]);

  const displayAvatar = avatarFromDb || avatarProp || "/images/avatar.png";

  // Logic toggles (KHÔNG THAY ĐỔI)
  const toggleMobile = () => setMobileOpen(v => !v);
  const dropdownToggle = key => setOpenDropdown(prev => (prev === key ? null : key));
  const toggleAccount = () => setAccountOpen(v => !v);
  const closeAccount = () => setAccountOpen(false);

  // Logic click outside (KHÔNG THAY ĐỔI)
  useEffect(() => {
    const onDocClick = (e) => {
      if (!accRef.current) return;
      if (!accRef.current.contains(e.target)) {setAccountOpen(false); setNotiOpen(false);}
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Logic Esc close modal (KHÔNG THAY ĐỔI)
  useEffect(() => {
    if (!openLogout) return;
    const onKey = (e) => { if (e.key === "Escape") setOpenLogout(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openLogout]);

  // Logic upload avatar (KHÔNG THAY ĐỔI)
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

  // Logic đăng xuất (KHÔNG THAY ĐỔI)
  const handleLogout = async () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("jwt");
    } finally {
      window.location.href = "/";
    }
  };

  // Biến kiểm tra active cho menu cha
  const isDinhDuongActive = location.pathname.startsWith('/dinh-duong');
  const isTapLuyenActive = location.pathname.startsWith('/tap-luyen');

  return (
    <header className="fm-header" role="banner">
      {/* Cấu trúc layout mới: flex, space-between */}
      <div className="fm-nav">
        {/* NHÓM TRÁI: Logo + Menu */}
        <div className="fm-nav-left-group">
          <div className="fm-left">
            <button className="fm-burger" aria-label="Mở menu" onClick={toggleMobile}>
              <span /><span /><span />
            </button>
            <NavLink to="/" className="fm-brand" aria-label="FitMatch">
              <img className="fm-logo" src={logoHref} alt="FitMatch" />
            </NavLink>
          </div>

          {/* CENTER: MENU (Đã cập nhật) */}
          <nav className={`fm-menu ${mobileOpen ? "is-open" : ""}`} aria-label="Chính">
            <ul className="fm-menu__list">
              <li className="fm-menu__item">
                <NavLink to="/home" className="fm-link">Trang chủ</NavLink>
              </li>
              {/* DINH DƯỠNG (Mega-menu) */}
              <li className={`fm-menu__item has-dropdown ${isDinhDuongActive ? 'is-active-parent' : ''}`}>
                <NavLink to="/dinh-duong/nhat-ky" className="fm-link">
                  Dinh dưỡng<i className="fa-solid fa-caret-down"></i>
                </NavLink>
                <button
                  className="fm-dd-toggle"
                  aria-label="Mở Dinh dưỡng"
                  onClick={() => dropdownToggle("dd")}
                  aria-expanded={openDropdown === "dd"}
                >
                  <FontAwesomeIcon icon={faCaretDown} />
                </button>

                <div className={`fm-dropdown fm-megamenu ${openDropdown === "dd" ? "is-open" : ""}`} role="menu" aria-haspopup="true">
                  <div className="fm-megamenu-content">
                    {/* <div className="fm-megamenu-image">
                      <img src="/images/dropd1.png" alt="Dinh dưỡng" />
                    </div> */}
                    <div className="fm-megamenu-links">
                      <NavLink to="/dinh-duong/nhat-ky" className="fm-megamenu-link" role="menuitem">
                        <FontAwesomeIcon icon={faBookOpen} />
                        <div>
                          <strong>Nhật ký dinh dưỡng</strong>
                          <span>Theo dõi bữa ăn hàng ngày của bạn</span>
                        </div>
                      </NavLink>
                      <NavLink to="/dinh-duong/ghi-lai/tao-mon" className="fm-megamenu-link" role="menuitem">
                        <FontAwesomeIcon icon={faAppleAlt} />
                        <div>
                          <strong>Tạo món ăn</strong>
                          <span>Lưu lại công thức món ăn của riêng bạn</span>
                        </div>
                      </NavLink>
                      <NavLink to="/dinh-duong/ghi-lai" className="fm-megamenu-link" role="menuitem">
                        <FontAwesomeIcon icon={faUtensils} />
                        <div>
                          <strong>Ghi lại bữa ăn</strong>
                          <span>Thêm nhanh các bữa ăn sáng, trưa, tối</span>
                        </div>
                      </NavLink>
                      {/* <NavLink to="/dinh-duong/tao-mon-an-ai" className="fm-megamenu-link" role="menuitem">
                        <FontAwesomeIcon icon={faBrain} />
                        <div>
                          <strong>Tạo món ăn với AI</strong>
                          <span>Để AI tính toán công thức món ăn cho bạn</span>
                        </div>
                      </NavLink> */}
                      <NavLink to="/dinh-duong/thuc-don-goi-y" className="fm-megamenu-link" role="menuitem">
                        <FontAwesomeIcon icon={faLightbulb} />
                        <div>
                          <strong>Thực đơn gợi ý</strong>
                          <span>Khám phá các thực đơn lành mạnh</span>
                        </div>
                      </NavLink>
                      <NavLink to="/dinh-duong/tinh-calo-ai" className="fm-megamenu-link" role="menuitem">
                        <FontAwesomeIcon icon={faCalculator} />
                        <div>
                          <strong>Tính toán Calorie với AI</strong>
                          <span>Chụp ảnh món ăn để ước tính calo</span>
                        </div>
                      </NavLink>
                    </div>
                  </div>
                </div>
              </li>

              {/* TẬP LUYỆN (Mega-menu) */}
              <li className={`fm-menu__item has-dropdown ${isTapLuyenActive ? 'is-active-parent' : ''}`}>
                <NavLink to="/tap-luyen/lich-cua-ban" className="fm-link">
                  Tập luyện<i className="fa-solid fa-caret-down"></i>
                </NavLink>
                <button
                  className="fm-dd-toggle"
                  aria-label="Mở Tập luyện"
                  onClick={() => dropdownToggle("tl")}
                  aria-expanded={openDropdown === "tl"}
                >
                  <FontAwesomeIcon icon={faCaretDown} />
                </button>

                <div className={`fm-dropdown fm-megamenu ${openDropdown === "tl" ? "is-open" : ""}`} role="menu" aria-haspopup="true">
                  <div className="fm-megamenu-content">
                    {/* <div className="fm-megamenu-image">
                      <img src="/images/dropd2.png" alt="Tập luyện" />
                    </div> */}
                    <div className="fm-megamenu-links">
                      <NavLink to="/tap-luyen/lich-cua-ban" className="fm-megamenu-link" role="menuitem">
                        <FontAwesomeIcon icon={faCalendar} />
                        <div>
                          <strong>Lịch tập của bạn</strong>
                          <span>Xem kế hoạch tập luyện của bạn</span>
                        </div>
                      </NavLink>
                      <NavLink to="/tap-luyen/bai-tap/khang-luc" className="fm-megamenu-link" role="menuitem">
                        <FontAwesomeIcon icon={faDumbbell} />
                        <div>
                          <strong>Các bài tập kháng lực</strong>
                          <span>Danh sách bài tập xây dựng và phát triển cơ bắp</span>
                        </div>
                      </NavLink>
                      <NavLink to="/tap-luyen/lich-cua-ban/tao" className="fm-megamenu-link" role="menuitem">
                        <FontAwesomeIcon icon={faClipboardList} />
                        <div>
                          <strong>Tạo lịch tập của bạn</strong>
                          <span>Xây dựng kế hoạch tập luyện của bạn</span>
                        </div>
                      </NavLink>
                      <NavLink to="/tap-luyen/bai-tap/cardio" className="fm-megamenu-link" role="menuitem">
                        <FontAwesomeIcon icon={faHeartPulse} />
                        <div>
                          <strong>Các bài tập cardio</strong>
                          <span>Danh sách bài tập tăng cường sức bền tim mạch</span>
                        </div>
                      </NavLink>
                      <NavLink to="/tap-luyen/goi-y" className="fm-megamenu-link" role="menuitem">
                        <FontAwesomeIcon icon={faLightbulb} />
                        <div>
                          <strong>Lịch tập gợi ý</strong>
                          <span>Các kế hoạch tập luyện mẫu</span>
                        </div>
                      </NavLink>
                      <NavLink to="/tap-luyen/bai-tap/the-thao" className="fm-megamenu-link" role="menuitem">
                        <FontAwesomeIcon icon={faVolleyball} />
                        <div>
                          <strong>Các môn thể thao</strong>
                          <span>Danh sách các môn thể thao </span>
                        </div>
                      </NavLink>                     
                    </div>
                  </div>
                </div>
              </li>
              <li className="fm-menu__item">
                <NavLink to="/ket-noi" className="fm-link">Kết nối</NavLink>
              </li>
              <li className="fm-menu__item">
                <NavLink to="/thong-ke" className="fm-link">Thống kê</NavLink>
              </li>
              {/* <li className="fm-menu__item">
                <NavLink to="/ung-dung" className="fm-link">Ứng dụng</NavLink>
              </li> */}
            </ul>
          </nav>
        </div>

        {/* RIGHT: HELLO + AVATAR + ACCOUNT DROPDOWN (KHÔNG THAY ĐỔI) */}
        <div className="fm-right" ref={accRef}>
          <ChatBell/>
          <NotificationBell />
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

      {/* Modal xác nhận Đăng xuất (KHÔNG THAY ĐỔI) */}
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

/* ================= Account Dropdown Component (KHÔNG THAY ĐỔI) ================= */
// ... (Giữ nguyên toàn bộ component AccountDropdown)
function AccountDropdown({ open, onClose, nickname, joinDate, age, heightCm, weightKg, avatarUrl, onUploadAvatar, onAskLogout }) {
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) setPreview(null);
  }, [open]);

  const onPickAvatar = () => fileRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    await onUploadAvatar?.(file);
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
        <NavLink to="/tai-khoan/tai-khoan" className="acc-item"><FontAwesomeIcon icon={faGear} />Tài khoản</NavLink>
        <div className="acc-sep" />
        <NavLink to="/tin-nhan" className="acc-item"><FontAwesomeIcon icon={faMessage} />Tin nhắn</NavLink>
        <div className="acc-sep" />
      </div>
      <button className="acc-logout" type="button" onClick={onAskLogout}>
        <FontAwesomeIcon icon={faRightFromBracket} /> Đăng xuất
      </button>
    </div>
  );
}