import React, { useEffect, useMemo, useState } from "react";
import "./AccountLayout.css";
import { getMe } from "../../../api/account";
import Account from "./Account";
import ChangePassword from "./ChangePassword";
import DeleteAccount from "./DeleteAccount";

const fallbackUser = {
  username: "Tupae",
  createdAt: null,
  email: "tupae@example.com",
  profile: { nickname: "Tupae" },
};

const fmtDate = (iso) => {
  if (!iso) return "xx/xx/xxxx";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "xx/xx/xxxx";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export default function AccountSettings() {
  const [tab, setTab] = useState("account"); // 'account' | 'password' | 'delete'
  const [user, setUser] = useState(fallbackUser);

  // Modal xác nhận đăng xuất
  const [openLogout, setOpenLogout] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        if (me && typeof me === "object") {
          setUser((prev) => ({
            ...prev,
            ...me,
            profile: { ...(prev.profile || {}), ...(me.profile || {}) },
          }));
        }
      } catch {
        /* fallback */
      }
    })();
  }, []);

  const p = user?.profile || {};
  const joinDate = useMemo(() => fmtDate(user?.createdAt), [user?.createdAt]);

  const handleLogout = async () => {
    try {
      // Tuỳ cơ chế auth của bạn:
      // Nếu Bearer token trong localStorage:
      localStorage.removeItem("token");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("jwt");
      // Nếu dùng cookie-session, có thể gọi /auth/logout ở đây.
    } finally {
      window.location.href = "/";
    }
  };

  return (
    <div className="pf-wrap acc-page">
      <div className="pf-head">
        <div className="pf-user">
          <div className="pf-avatar sm">
            <img src="/images/avatar.png" alt="avatar" />
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
          {tab === "account" && <Account />}
          {tab === "password" && <ChangePassword />}
          {tab === "delete" && <DeleteAccount />}
        </section>
      </div>

      {/* Modal xác nhận Đăng xuất */}
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
