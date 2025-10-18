// user-app/src/pages/Account/PrivacyPolicy/index.jsx
import React from "react";
import "../AccountSettings/AccountLayout.css"; // tái dùng layout & biến pf-*
import Policy from "./Policy";
import { getMe } from "../../../api/account";
import api from "../../../lib/api";

// Helpers
const fmtDate = (iso) => {
  if (!iso) return "xx/xx/xxxx";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "xx/xx/xxxx";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try { return new URL(u, API_ORIGIN).toString(); } catch { return u; }
};

export default function PrivacyPolicyPage() {
  const [user, setUser] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const me = await getMe();           // getMe() trả object user từ BE
        if (!mounted) return;
        setUser(me || null);
      } catch (e) {
        if (!mounted) return;
        setErr(e?.response?.data?.message || "Không thể tải tài khoản");
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const p = user?.profile || {};
  const joinDate = React.useMemo(() => fmtDate(user?.createdAt), [user?.createdAt]);
  const avatarSrc = React.useMemo(() => (p.avatarUrl ? toAbs(p.avatarUrl) : "/images/avatar.png"), [p.avatarUrl]);

  if (loading) {
    return (
      <div className="pf-wrap acc-page">
        <div className="card" style={{ marginTop: 16 }}>
          <h2 className="pf-title">Đang tải…</h2>
          <p className="pf-desc">Vui lòng chờ trong giây lát.</p>
        </div>
      </div>
    );
  }

  if (err || !user) {
    return (
      <div className="pf-wrap acc-page">
        <div className="card" style={{ marginTop: 16 }}>
          <h2 className="pf-title">Không thể tải dữ liệu</h2>
          <p className="pf-desc">{err || "Không có dữ liệu tài khoản"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pf-wrap acc-page">
      {/* Header chung */}
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
        {/* Sidebar chỉ 1 route */}
        <aside className="pf-side">
          <div className="pf-side-title">Quyền riêng tư</div>
          <button className="pf-side-item is-active">Chính sách quyền riêng tư</button>
        </aside>

        {/* Nội dung */}
        <section className="pf-content">
          <Policy />
        </section>
      </div>
    </div>
  );
}
