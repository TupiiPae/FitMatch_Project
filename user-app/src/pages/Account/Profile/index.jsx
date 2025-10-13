import React, { useEffect, useMemo, useState } from "react";
import "./ProfileLayout.css";
import { getMe } from "../../../api/account";
import BodyProfile from "./BodyProfile";
import GoalsCustomize from "./GoalsCustomize";

// === Fallback user (gần giống bản Profile.jsx cũ) ===
const fallbackUser = {
  username: "Tupae",
  createdAt: null,
  profile: {
    nickname: "Tupae",
    sex: "male",
    dob: "2003-01-01",
    heightCm: "",
    weightKg: "",
    goal: "",
    targetWeightKg: "",
    weeklyChangeKg: "",
    trainingIntensity: "",
    bmi: "",
    bmr: "",
    tdee: "",
  },
};

const fmtDate = (iso) => {
  if (!iso) return "xx/xx/xxxx";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "xx/xx/xxxx";
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}/${d.getFullYear()}`;
};

export default function Profile() {
  const [tab, setTab] = useState("body"); // 'body' | 'goals' | 'nutri' | 'weight'
  const [user, setUser] = useState(fallbackUser); // luôn có dữ liệu để render
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe(); // có thể null nếu endpoint/token chưa đúng
        if (me && typeof me === "object") {
          setUser((prev) => ({
            ...prev,
            ...me,
            profile: { ...(prev.profile || {}), ...(me.profile || {}) },
          }));
        }
      } catch (e) {
        // im lặng fallback; vẫn render bằng fallbackUser
        // console.error("getMe failed", e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const p = user?.profile || {};
  const joinDate = useMemo(() => fmtDate(user?.createdAt), [user?.createdAt]);

  return (
    <div className="pf-wrap">
      {/* Header */}
      <div className="pf-head">
        <div className="pf-user">
          <div className="pf-avatar">
            <img src="/images/avatar.png" alt="avatar" />
          </div>
          <div className="pf-userinfo">
            <div className="pf-name">{p.nickname || user?.username || "Bạn"}</div>
            <div className="pf-join">Đã tham gia từ {joinDate}</div>
          </div>
        </div>
        <button className="pf-cta">Đi tới trang chỉnh sửa tài khoản</button>
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
          {tab === "body" && <BodyProfile user={user} />}
          {tab === "goals" && <GoalsCustomize user={user} setUser={setUser} />}
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
        </section>
      </div>

      {/* Gợi ý debug nhẹ, chỉ hiện khi API chưa load được lần đầu */}
      {!loaded && (
        <div style={{ padding: 12, color: "#6b7280", fontSize: 13 }}>
          Đang tải dữ liệu tài khoản…
        </div>
      )}
    </div>
  );
}
