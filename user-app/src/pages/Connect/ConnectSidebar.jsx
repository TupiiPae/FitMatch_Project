// user-app/src/pages/Connect/ConnectSidebar.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Connect.css";
import TabNearby from "./TabNearby";
import TabMyConnections from "./TabMyConnections";
import { toast } from "react-toastify";

import { getMe } from "../../api/account";
import {
  getMatchStatus,
  updateDiscoverable,
} from "../../api/match";
import api from "../../lib/api";

// ===== Helpers =====
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

function calcAge(dob) {
  if (!dob) return null;
  // hỗ trợ cả "YYYY-MM-DD" và ISO "YYYY-MM-DDTHH:mm:ss"
  const [yStr, mStr, dStrRaw] = String(dob).split("-");
  const y = Number(yStr);
  const m = Number(mStr || 1);
  const d = Number((dStrRaw || "1").slice(0, 2));
  const b = new Date(y, m - 1, d);
  if (Number.isNaN(b.getTime())) return null;
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const md = t.getMonth() - b.getMonth();
  if (md < 0 || (md === 0 && t.getDate() < b.getDate())) a--;
  return a;
}

const LOCATION_RANGE_OPTIONS = [
  { value: "any", label: "Không giới hạn" },
  { value: "20", label: "Trong vòng 20 km" },
  { value: "15", label: "Trong vòng 15 km" },
  { value: "10", label: "Trong vòng 10 km" },
  { value: "5", label: "Trong vòng 5 km" },
  { value: "3", label: "Trong vòng 3 km" },
];

const AGE_RANGE_OPTIONS = [
  { value: "all", label: "Tất cả" },
  { value: "18-21", label: "18–21" },
  { value: "22-27", label: "22–27" },
  { value: "28-35", label: "28–35" },
  { value: "36-45", label: "36–45" },
  { value: "45+", label: "Trên 45" },
];

const GOAL_LABELS = {
  giam_can: "Giảm cân",
  duy_tri: "Duy trì",
  tang_can: "Tăng cân",
  giam_mo: "Giảm mỡ",
  tang_co: "Tăng cơ",
};

function buildAddressLabel(profile) {
  const addr = profile?.address || {};
  if (addr.district && addr.city) return `${addr.district}, ${addr.city}`;
  if (addr.city) return addr.city;
  return "";
}

function getInitials(name) {
  if (!name) return "FM";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getGenderLabel(gender) {
  if (gender === "male") return "Nam";
  if (gender === "female") return "Nữ";
  if (!gender) return "Chưa cập nhật";
  return "Khác";
}

export default function ConnectSidebar() {
  const nav = useNavigate();

  // user đầy đủ từ BE
  const [user, setUser] = useState(null);

  // trạng thái match
  const [discoverable, setDiscoverable] = useState(false);
  const [hasAddressForConnect, setHasAddressForConnect] = useState(false);

  // filters
  const [activeTab, setActiveTab] = useState("nearby"); // "nearby" | "my-connections"
  const [connectionMode, setConnectionMode] = useState("one_to_one");
  const [locationRange, setLocationRange] = useState("any");
  const [ageRange, setAgeRange] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");

  const [loading, setLoading] = useState(true);

  // ===== Load user + match status =====
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const [me, statusPayload] = await Promise.all([
          getMe(), // trả về object user
          getMatchStatus().catch((e) => {
            console.error("getMatchStatus error:", e);
            return null;
          }),
        ]);

        if (cancelled) return;

        if (me && typeof me === "object") {
          setUser(me);
          const p = me.profile || {};

          // set default gender filter = giới tính user nếu có
          if (p.sex === "male" || p.sex === "female") {
            setGenderFilter(p.sex);
          } else {
            setGenderFilter("all");
          }
        }

        if (statusPayload) {
          setDiscoverable(!!statusPayload.discoverable);
          setHasAddressForConnect(!!statusPayload.hasAddressForConnect);
        }
      } catch (e) {
        console.error("ConnectSidebar init error:", e);
        toast.error("Không thể tải dữ liệu kết nối.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ===== Derived info từ user =====
  const p = user?.profile || {};
  const avatarUrl = p.avatarUrl ? toAbs(p.avatarUrl) : null;

  const displayName =
    p.nickname ||
    p.fullName ||
    user?.username ||
    user?.email ||
    "Người dùng FitMatch";

  const displayGender = p.sex || null;
  const displayAge = calcAge(p.dob);
  const displayLocation = buildAddressLabel(p);

  const goalKey = user?.connectGoalKey || p.goal || null;
  const goalLabel =
    user?.connectGoalLabel ||
    (goalKey && GOAL_LABELS[goalKey]) ||
    "";

  // ===== Toggle discoverable =====
  const handleToggleDiscoverable = async () => {
    try {
      if (!discoverable && !hasAddressForConnect) {
        toast.warn(
          "Bạn cần cập nhật địa chỉ trong Thông tin tài khoản trước khi bật."
        );
        nav("/tai-khoan/tai-khoan");
        return;
      }

      const next = !discoverable;
      setDiscoverable(next);

      const res = await updateDiscoverable(next); // trả { discoverable }
      const payload = res?.data ?? res;

      if (payload && typeof payload.discoverable === "boolean") {
        setDiscoverable(payload.discoverable);
      }

      if (next) {
        toast.success("Đã bật cho phép mọi người tìm kiếm bạn.");
      } else {
        toast.info("Đã tắt hiển thị hồ sơ trong kết quả tìm kiếm.");
      }
    } catch (e) {
      console.error("updateDiscoverable error:", e);
      setDiscoverable((v) => !v); // revert
      toast.error(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          "Không thể cập nhật trạng thái kết nối."
      );
    }
  };

  const displayUser = {
    name: displayName,
    gender: displayGender,
    age: displayAge,
    goalLabel,
    locationLabel: displayLocation,
  };

  return (
    <div className="cn-page">
      <div className="cn-layout">
        {/* ===== SIDEBAR ===== */}
        <aside className="cn-sidebar">
          <div className="cn-filters">
            {/* User summary + toggle */}
            <div className="cn-side-profile">
              <div className="cn-side-avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayUser.name} />
                ) : (
                  <span>{getInitials(displayUser.name)}</span>
                )}
              </div>
              <div>
                <div className="cn-side-nickname">{displayUser.name}</div>

                <div className="cn-side-discover">
                  <span className="cn-side-discover-label">
                    Cho phép mọi người tìm kiếm bạn
                  </span>
                  <button
                    type="button"
                    className={
                      "cn-switch" + (discoverable ? " is-on" : "")
                    }
                    onClick={handleToggleDiscoverable}
                    disabled={loading}
                  >
                    <span className="cn-switch-knob" />
                  </button>
                </div>

                {hasAddressForConnect ? (
                  <div className="cn-side-sub">
                    {discoverable
                      ? 'Hồ sơ của bạn đang hiển thị trong "Tìm kiếm xung quanh".'
                      : 'Bật lên để hồ sơ của bạn xuất hiện trong "Tìm kiếm xung quanh".'}
                  </div>
                ) : (
                  <div className="cn-side-sub">
                    Bạn cần nhập địa chỉ trong{" "}
                    <strong>Thông tin tài khoản</strong> để dùng chức
                    năng kết nối xung quanh.
                  </div>
                )}

                {displayLocation && (
                  <div className="cn-side-location">
                    <i className="fa-solid fa-location-dot" />{" "}
                    {displayLocation}
                  </div>
                )}
              </div>
            </div>

            {/* Menu bên trái */}
            <nav className="cn-side-menu">
              <button
                type="button"
                className="cn-side-link"
                onClick={() => nav("/tai-khoan/ho-so")}
              >
                <span className="cn-side-link-icon">
                  <i className="fa-regular fa-user" />
                </span>
                <span className="cn-side-link-label">
                  Hồ sơ thể chất của tôi
                </span>
              </button>

              <button
                type="button"
                className="cn-side-link"
                onClick={() => nav("/tai-khoan/tai-khoan")}
              >
                <span className="cn-side-link-icon">
                  <i className="fa-solid fa-gear" />
                </span>
                <span className="cn-side-link-label">
                  Thông tin của tôi
                </span>
              </button>

              <hr className="cn-side-divider" />

              <button
                type="button"
                className={
                  "cn-side-link" +
                  (activeTab === "nearby" ? " is-active" : "")
                }
                onClick={() => setActiveTab("nearby")}
              >
                <span className="cn-side-link-icon">
                  <i className="fa-solid fa-location-arrow" />
                </span>
                <span className="cn-side-link-label">
                  Tìm kiếm xung quanh
                </span>
              </button>

              <button
                type="button"
                className={
                  "cn-side-link" +
                  (activeTab === "my-connections" ? " is-active" : "")
                }
                onClick={() => setActiveTab("my-connections")}
              >
                <span className="cn-side-link-icon">
                  <i className="fa-solid fa-users" />
                </span>
                <span className="cn-side-link-label">
                  Kết nối của tôi
                </span>
              </button>
            </nav>

            {/* ========== FILTERS ========== */}
            <div className="cn-side-section">
              <h3 className="cn-side-section-title">Lọc</h3>

              {/* Chế độ kết nối */}
              <div className="cn-side-field">
                <div className="cn-filter-label">Chế độ kết nối</div>
                <div className="cn-connection-mode">
                  <button
                    type="button"
                    className={
                      "cn-toggle-btn" +
                      (connectionMode === "one_to_one"
                        ? " is-active"
                        : "")
                    }
                    onClick={() => setConnectionMode("one_to_one")}
                  >
                    1:1
                  </button>
                  <button
                    type="button"
                    className={
                      "cn-toggle-btn" +
                      (connectionMode === "group" ? " is-active" : "")
                    }
                    onClick={() => setConnectionMode("group")}
                  >
                    Nhóm
                  </button>
                </div>
              </div>

              {/* Vị trí */}
              <div className="cn-side-field">
                <div className="cn-filter-label">Vị trí</div>
                <select
                  className="cn-location-select"
                  value={locationRange}
                  onChange={(e) => setLocationRange(e.target.value)}
                >
                  {LOCATION_RANGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="cn-filter-hint">
                  Vị trí được lấy từ địa chỉ trong hồ sơ của bạn.
                </p>
              </div>

              {/* Độ tuổi */}
              <div className="cn-side-field">
                <div className="cn-filter-label">Độ tuổi hiển thị</div>
                <select
                  className="cn-location-select cn-age-select"
                  value={ageRange}
                  onChange={(e) => setAgeRange(e.target.value)}
                >
                  {AGE_RANGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Giới tính */}
              <div className="cn-side-field">
                <div className="cn-filter-label">Giới tính hiển thị</div>
                <div className="cn-chip-group">
                  <button
                    type="button"
                    className={
                      "cn-chip cn-chip-filter" +
                      (genderFilter === "all" ? " is-active" : "")
                    }
                    onClick={() => setGenderFilter("all")}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    className={
                      "cn-chip cn-chip-filter" +
                      (genderFilter === "male" ? " is-active" : "")
                    }
                    onClick={() => setGenderFilter("male")}
                  >
                    Nam
                  </button>
                  <button
                    type="button"
                    className={
                      "cn-chip cn-chip-filter" +
                      (genderFilter === "female" ? " is-active" : "")
                    }
                    onClick={() => setGenderFilter("female")}
                  >
                    Nữ
                  </button>
                </div>
                <p className="cn-filter-hint">
                  Giới tính của bạn:{" "}
                  {getGenderLabel(displayUser.gender)}
                </p>
              </div>

              {/* Mục tiêu */}
              <div className="cn-side-field cn-side-goal-highlight">
                <div className="cn-side-goal-header">
                  <i className="fa-solid fa-bullseye" />
                  <span className="cn-side-goal-label">
                    Mục tiêu tập luyện hiện tại
                  </span>
                </div>
                <div className="cn-goal-chip-wrap">
                  <span className="cn-chip-static">
                    {displayUser.goalLabel || "Chưa thiết lập mục tiêu"}
                  </span>
                </div>
                <p className="cn-goal-hint">
                  Thay đổi trong <strong>Hồ sơ thể chất</strong> để hệ
                  thống gợi ý bạn tập phù hợp hơn.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* ===== MAIN CONTENT ===== */}
        <main className="cn-main">
          <header className="cn-main-header">
            <h1>Kết nối bạn tập</h1>
            <p>
              Tìm kiếm những người có cùng mục tiêu và lịch tập, tạo
              nhóm tối đa 5 người để cùng nhau hoàn thành mục tiêu.
            </p>
          </header>

          {activeTab === "nearby" ? (
            <TabNearby
              currentUser={user}
              connectionMode={connectionMode}
              locationRange={locationRange}
              ageRange={ageRange}
              genderFilter={genderFilter}
              discoverable={discoverable}
            />
          ) : (
            <TabMyConnections currentUser={user} />
          )}
        </main>
      </div>
    </div>
  );
}
