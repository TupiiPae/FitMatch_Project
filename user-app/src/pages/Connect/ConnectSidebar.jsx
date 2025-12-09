// user-app/src/pages/Connect/ConnectSidebar.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Connect.css";
import TabNearby from "./TabNearby";
import TabMyConnections from "./TabMyConnections";
import { toast } from "react-toastify";

import { getMe } from "../../api/account";
import { getMatchStatus, updateDiscoverable } from "../../api/match";

const LOCATION_RANGE_OPTIONS = [
  { value: "any", label: "Không giới hạn" }, // mặc định: tất cả
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

function mapGoalLabel(goalKey, connectGoalLabel) {
  if (connectGoalLabel) return connectGoalLabel;
  if (!goalKey) return "";
  return GOAL_LABELS[goalKey] || "";
}

export default function ConnectSideBar() {
  const nav = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [hasConnections] = useState(false); // TODO: dùng API sau

  const [activeTab, setActiveTab] = useState("nearby"); // "nearby" | "my-connections"
  const [connectionMode, setConnectionMode] = useState("one_to_one"); // "one_to_one" | "group"

  const [locationRange, setLocationRange] = useState("any"); // mặc định: tất cả
  const [ageRange, setAgeRange] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all"); // sẽ set theo giới tính user sau khi load

  const [discoverable, setDiscoverable] = useState(false);
  const [hasAddressForConnect, setHasAddressForConnect] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // ===== Load thông tin user + trạng thái match =====
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setLoadingStatus(true);

        const [me, status] = await Promise.all([
          getMe().catch((e) => {
            console.error("getMe error:", e);
            return null;
          }),
          getMatchStatus().catch((e) => {
            console.error("getMatchStatus error:", e);
            return null;
          }),
        ]);

        if (cancelled) return;

        // ---- Map currentUser cho Connect ----
        if (me) {
          const profile = me.profile || {};
          const addr = profile.address || {};

          const age = calcAgeFromDob(profile.dob);
          const locationLabel = buildLocationLabel(me, profile, addr);
          const goalKey = me.connectGoalKey || profile.goal || null;
          const goalLabel = mapGoalLabel(goalKey, me.connectGoalLabel);

          const userForConnect = {
            id: me.id || me._id,
            username: me.username,
            nickname:
              profile.nickname || me.username || "Người dùng FitMatch",
            gender: profile.sex || null,
            age,
            locationLabel,
            goalKey,
            goalLabel,
            avatarUrl: profile.avatarUrl || null,
          };

          setCurrentUser(userForConnect);

          // Mặc định filter giới tính = giới tính chủ tài khoản
          if (profile.sex === "male" || profile.sex === "female") {
            setGenderFilter(profile.sex);
          } else {
            setGenderFilter("all");
          }
        }

        // ---- Map trạng thái connect (discoverable, địa chỉ) ----
        if (status) {
          const payload = status.data ?? status;
          if (payload) {
            setDiscoverable(!!payload.discoverable);
            setHasAddressForConnect(!!payload.hasAddressForConnect);
          }
        }
      } catch (e) {
        console.error("ConnectSidebar init error:", e);
        if (!cancelled) {
          toast.error(
            "Không thể tải dữ liệu kết nối. Vui lòng thử lại sau."
          );
        }
      } finally {
        if (!cancelled) setLoadingStatus(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  // ===== Toggle discoverable =====
  async function handleToggleDiscoverable() {
    try {
      // Nếu đang tắt -> bật lên nhưng chưa có địa chỉ
      if (!discoverable && !hasAddressForConnect) {
        toast.warn(
          "Bạn cần cập nhật địa chỉ trong hồ sơ trước khi bật cho phép tìm kiếm."
        );
        nav("/tai-khoan/tai-khoan");
        return;
      }

      const next = !discoverable;
      setDiscoverable(next);

      const res = await updateDiscoverable(next);
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
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        "Không thể cập nhật trạng thái kết nối.";
      toast.error(msg);
    }
  }

  const displayUser = currentUser || {
    nickname: "Người dùng FitMatch",
    gender: null,
    age: null,
    locationLabel: "",
    goalLabel: "",
  };

  return (
    <div className="cn-page">
      <div className="cn-layout">
        {/* ===== SIDEBAR ===== */}
        <aside className="cn-sidebar">
          <div className="cn-filters">
            {/* Header: Avatar + tên + toggle cho phép tìm kiếm */}
            <div className="cn-side-profile">
              <div className="cn-side-avatar">
                {displayUser.avatarUrl ? (
                  <img src={displayUser.avatarUrl} alt="avatar" />
                ) : (
                  getInitials(displayUser.nickname || "FM")
                )}
              </div>
              <div>
                <div className="cn-side-nickname">
                  {displayUser.nickname || "Người dùng FitMatch"}
                </div>

                {/* Thông tin phụ: tuổi + vị trí */}
                <div className="cn-side-meta">
                  {displayUser.age ? (
                    <span>{displayUser.age} tuổi</span>
                  ) : (
                    <span>Tuổi: Chưa cập nhật</span>
                  )}
                  {" · "}
                  {displayUser.locationLabel ? (
                    <span>{displayUser.locationLabel}</span>
                  ) : (
                    <span>Vị trí: Chưa cập nhật</span>
                  )}
                </div>

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
                    disabled={loadingStatus}
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
                    <span>
                      Bạn cần cập nhật địa chỉ trong{" "}
                      <strong>Thông tin của tôi</strong> trước khi bật
                      kết nối xung quanh.
                    </span>
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

            {/* Khu Lọc */}
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

              {/* Vị trí – select list */}
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
                  Vị trí được lấy từ địa chỉ bạn đã lưu trong hồ sơ.
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

              {/* Mục tiêu – highlight ở cuối sidebar */}
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
                  Thay đổi mục tiêu trong{" "}
                  <strong>Hồ sơ thể chất</strong> để hệ thống gợi ý
                  bạn tập phù hợp hơn.
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
              Tìm kiếm những người có cùng mục tiêu và lịch tập, tạo nhóm
              tối đa 5 người để cùng nhau hoàn thành mục tiêu.
            </p>
          </header>

          {activeTab === "nearby" ? (
            <TabNearby
              currentUser={displayUser}
              connectionMode={connectionMode}
              locationRange={locationRange}
              ageRange={ageRange}
              genderFilter={genderFilter}
              discoverable={discoverable}
            />
          ) : (
            <TabMyConnections currentUser={displayUser} />
          )}
        </main>
      </div>
    </div>
  );
}

/* ===== Helpers ===== */

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

function calcAgeFromDob(dob) {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  if (!y || !m || !d) return null;
  const b = new Date(y, m - 1, d);
  const t = new Date();
  let age = t.getFullYear() - b.getFullYear();
  const md = t.getMonth() - b.getMonth();
  if (md < 0 || (md === 0 && t.getDate() < b.getDate())) age--;
  if (!Number.isFinite(age) || age < 0 || age > 120) return null;
  return age;
}

function buildLocationLabel(me, profile, addr) {
  if (me && typeof me.connectLocationLabel === "string" && me.connectLocationLabel.trim()) {
    return me.connectLocationLabel.trim();
  }
  if (!addr) return "";
  const parts = [addr.district, addr.city].filter(Boolean);
  return parts.join(", ");
}
