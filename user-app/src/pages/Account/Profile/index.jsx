// user-app/src/pages/Account/Profile/index.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./ProfileLayout.css";
import { getMe } from "../../../api/account";
import api from "../../../lib/api";
import BodyProfile from "./BodyProfile";
import GoalsCustomize from "./GoalsCustomize";

const fmtDate = (iso) => {
  if (!iso) return "xx/xx/xxxx";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "xx/xx/xxxx";
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

// Helper: chuyển đường dẫn tương đối (/uploads/...) thành URL tuyệt đối dựa vào api.defaults.baseURL
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u; // nếu u đã là absolute
  }
};

export default function Profile() {
  const [tab, setTab] = useState("body"); // 'body' | 'goals' | 'nutri' | 'weight'
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const me = await getMe();             // getMe() trả {id, username, email, profile, createdAt...}
        if (!mounted) return;
        setUser(me || null);
      } catch (e) {
        if (!mounted) return;
        setErr(e?.response?.data?.message || "Không thể tải dữ liệu tài khoản");
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const p = user?.profile || {};
  const joinDate = useMemo(() => fmtDate(user?.createdAt), [user?.createdAt]);

  // 👇 Avatar lấy từ user.profile.avatarUrl (nếu có) và chuyển sang URL tuyệt đối
  const avatarSrc = useMemo(
    () => (p.avatarUrl ? toAbs(p.avatarUrl) : "/images/avatar.png"),
    [p.avatarUrl]
  );

  return (
    <div className="pf-wrap">
      {/* Header */}
      <div className="pf-head">
        <div className="pf-user">
          <div className="pf-avatar">
            <img src={avatarSrc} alt="avatar" />
          </div>
          <div className="pf-userinfo">
            <div className="pf-name">{p.nickname || user?.username || "Bạn"}</div>
            <div className="pf-join">Đã tham gia từ {joinDate}</div>
          </div>
        </div>
        <a className="pf-cta" href="/tai-khoan/tai-khoan">Đi tới trang chỉnh sửa tài khoản</a>
      </div>

      <div className="pf-body">
        {/* Sidebar */}
        <aside className="pf-side">
          <div className="pf-side-title">Hồ sơ</div>
          <button
            className={`pf-side-item ${tab === "body" ? "is-active" : ""}`}
            onClick={() => setTab("body")}
          >
            Hồ sơ thể chất
          </button>
          <button
            className={`pf-side-item ${tab === "goals" ? "is-active" : ""}`}
            onClick={() => setTab("goals")}
          >
            Tùy chỉnh mục tiêu
          </button>

          <div className="pf-side-title">Báo cáo</div>
          <button
            className={`pf-side-item ${tab === "nutri" ? "is-active" : ""}`}
            onClick={() => setTab("nutri")}
          >
            Xem thống kê Dinh dưỡng
          </button>
          <button
            className={`pf-side-item ${tab === "weight" ? "is-active" : ""}`}
            onClick={() => setTab("weight")}
          >
            Xem thống kê Cân nặng
          </button>
        </aside>

        {/* Content */}
        <section className="pf-content">
          {loading && (
            <div className="card">
              <h2 className="pf-title">Đang tải dữ liệu…</h2>
              <p className="pf-desc">Vui lòng chờ trong giây lát.</p>
            </div>
          )}

          {!loading && err && (
            <div className="card">
              <h2 className="pf-title">Không thể tải dữ liệu</h2>
              <p className="pf-desc">{err}</p>
            </div>
          )}

          {!loading && !err && !user && (
            <div className="card">
              <h2 className="pf-title">Chưa có hồ sơ</h2>
              <p className="pf-desc">Bạn chưa hoàn tất onboarding hoặc chưa có dữ liệu hồ sơ.</p>
            </div>
          )}

          {!loading && !err && user && (
            <>
              {tab === "body" && <BodyProfile user={user} />}
              {tab === "goals" && <GoalsCustomize user={user} />}
              {tab === "nutri" && (
                <div className="card">
                  <h2 className="pf-title">Xem thống kê Dinh dưỡng</h2>
                  <p className="pf-desc">Đang phát triển…</p>
                </div>
              )}
              {tab === "weight" && (
                <div className="card">
                  <h2 className="pf-title">Xem thống kê Cân nặng</h2>
                  <p className="pf-desc">Đang phát triển…</p>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
