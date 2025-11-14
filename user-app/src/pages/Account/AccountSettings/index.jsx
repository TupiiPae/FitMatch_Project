import React, { useEffect, useMemo, useState } from "react";
import "./AccountLayout.css";
import { getMe } from "../../../api/account";
import Account from "./Account";
import ChangePassword from "./ChangePassword";
import DeleteAccount from "./DeleteAccount";
import api from "../../../lib/api";

// Helpers dựng URL tuyệt đối + (tuỳ chọn) cache-busting
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

const fmtDate = (iso) => {
  if (!iso) return "xx/xx/xxxx";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "xx/xx/xxxx";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export default function AccountSettings() {
  const [tab, setTab] = useState("account"); 
  const [user, setUser] = useState(null);    
  const [openLogout, setOpenLogout] = useState(false);

  // tải user 1 lần
  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        setUser(me || null);
      } catch {
        setUser(null);
      }
    })();
  }, []);

  const p = user?.profile || {};
  const joinDate = useMemo(() => fmtDate(user?.createdAt), [user?.createdAt]);

  // avatar lấy từ DB (nếu có) -> URL tuyệt đối, fallback ảnh mặc định
  const avatarSrc = useMemo(() => {
    const u = p.avatarUrl ? toAbs(p.avatarUrl) : "/images/avatar.png";
    return u;
  }, [p.avatarUrl]);

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
    <div className="pf-wrap acc-page">
      <div className="pf-head">
        <div className="pf-user">
          <div className="pf-avatar sm">
            <img src={avatarSrc} alt="avatar" />
          </div>
          <div className="pf-userinfo">
            <div className="pf-name">{p.nickname || user?.username || "Bạn"}</div>
            <div className="pf-join">Đã tham gia từ {joinDate}</div>
          </div>
        </div>
      </div>

      <div className="pf-body">
        <aside className="pf-side">
          <div className="pf-side-title">Thông tin và liên hệ</div>
          <button
            className={`pf-side-item ${tab === "account" ? "is-active" : ""}`}
            onClick={() => setTab("account")}
          >
            Thông tin tài khoản
          </button>

          <div className="pf-side-title">Tài khoản và bảo mật</div>
          <button
            className={`pf-side-item ${tab === "password" ? "is-active" : ""}`}
            onClick={() => setTab("password")}
          >
            Thay đổi mật khẩu
          </button>
          <button
            className={`pf-side-item ${tab === "delete" ? "is-active" : ""}`}
            onClick={() => setTab("delete")}
          >
            Xóa dữ liệu và tài khoản
          </button>
          <button className="pf-side-item" onClick={() => setOpenLogout(true)}>
            Đăng xuất
          </button>
        </aside>

        <section className="pf-content">
          {/* Truyền xuống callback để child báo user mới lên parent */}
          {tab === "account" && <Account onUserChange={setUser} />}
          {tab === "password" && <ChangePassword />}
          {tab === "delete" && <DeleteAccount />}
        </section>
      </div>

      {openLogout && (
        <div className="logout-modal" role="dialog" aria-modal="true" aria-labelledby="logout-title">
          <div className="logout-backdrop" onClick={() => setOpenLogout(false)} />
          <div className="logout-dialog card" role="document">
            <div id="logout-title" className="logout-title">
              Đăng xuất tài khoản?
            </div>
            <p className="logout-desc">
              Bạn sắp đăng xuất khỏi FitMatch. Bạn có chắc chắn muốn tiếp tục?
            </p>
            <div className="logout-actions">
              <button className="btn-secondary" type="button" onClick={() => setOpenLogout(false)}>
                Hủy
              </button>
              <button className="btn-danger" type="button" onClick={handleLogout}>
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
