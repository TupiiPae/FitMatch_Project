import React from "react";
import "../AccountSettings/AccountLayout.css"; // tái dùng layout & biến pf-*
import Policy from "./Policy";
import { getMe } from "../../../api/account";

const fallbackUser = {
  username: "Tupae",
  createdAt: null,
  profile: { nickname: "Tupae" },
};

const fmtDate = (iso) => {
  if (!iso) return "xx/xx/xxxx";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "xx/xx/xxxx";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export default function PrivacyPolicyPage() {
  const [user, setUser] = React.useState(fallbackUser);

  React.useEffect(() => {
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
      } catch {/* fallback */}
    })();
  }, []);

  const p = user?.profile || {};
  const joinDate = React.useMemo(() => fmtDate(user?.createdAt), [user?.createdAt]);

  return (
    <div className="pf-wrap acc-page">
      {/* Header chung */}
      <div className="pf-head">
        <div className="pf-user">
          <div className="pf-avatar sm"><img src="/images/avatar.png" alt="avatar" /></div>
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
