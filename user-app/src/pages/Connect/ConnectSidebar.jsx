// user-app/src/pages/Connect/ConnectSidebar.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Connect.css";
import TabNearby from "./TabNearby";
import TabMyConnections from "./TabMyConnections";
import DuoConnect from "./DuoConnect";

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

export default function ConnectSideBar() {
  const nav = useNavigate();

  // TODO: sau này lấy từ API / context
  const currentUser = {
    nickname: "Tuấn Phi",
    gender: "male",
    goalKey: "lose_weight",
    goalLabel: "Tăng cơ",
  };

  // TODO: sau này check từ API
  const hasConnections = false;

  const [activeTab, setActiveTab] = useState("nearby"); // "nearby" | "my-connections"
  const [connectionMode, setConnectionMode] = useState("one_to_one"); // "one_to_one" | "group"
  const [locationRange, setLocationRange] = useState("20");
  const [ageRange, setAgeRange] = useState("all");
  const [genderFilter, setGenderFilter] = useState("male"); // "all" | "male" | "female"
  const [discoverable, setDiscoverable] = useState(false); // bật / tắt cho phép tìm kiếm

  return (
    <div className="cn-page">
      <div className="cn-layout">
        {/* ===== SIDEBAR ===== */}
        <aside className="cn-sidebar">
          <div className="cn-filters">
            {/* Header: Avatar + tên + toggle cho phép tìm kiếm */}
            <div className="cn-side-profile">
              <div className="cn-side-avatar">
                {getInitials(currentUser?.nickname || "FM")}
              </div>
              <div>
                <div className="cn-side-nickname">
                  {currentUser?.nickname || "Người dùng FitMatch"}
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
                    onClick={() => setDiscoverable((v) => !v)}
                  >
                    <span className="cn-switch-knob" />
                  </button>
                </div>

                {/* <div className="cn-side-sub">
                  {discoverable
                    ? "Hồ sơ của bạn đang hiển thị trong kết quả \"Tìm kiếm xung quanh\"."
                    : "Bật lên để hồ sơ của bạn xuất hiện trong \"Tìm kiếm xung quanh\"."}
                </div> */}
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
                <span className="cn-side-link-label">Hồ sơ thể chất của tôi</span>
              </button>

              <button
                type="button"
                className="cn-side-link"
                onClick={() => nav("/tai-khoan/tai-khoan")}
              >
                <span className="cn-side-link-icon">
                  <i className="fa-solid fa-gear" />
                </span>
                <span className="cn-side-link-label">Thông tin của tôi</span>
              </button>

              <hr className="cn-side-divider" />

              <button
                type="button"
                className={
                  "cn-side-link" + (activeTab === "nearby" ? " is-active" : "")
                }
                onClick={() => setActiveTab("nearby")}
              >
                <span className="cn-side-link-icon">
                  <i className="fa-solid fa-location-arrow" />
                </span>
                <span className="cn-side-link-label">Tìm kiếm xung quanh</span>
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
                <span className="cn-side-link-label">Kết nối của tôi</span>
              </button>

              {/* NOTE:
                 Trước đây tab "Kết nối của tôi" bị disable khi chưa có kết nối.
                 Hiện tại mở sẵn cho dễ test UI.
                 TODO: Khi nối API, có thể dùng hasConnections để disable / show hint. */}
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
                      (connectionMode === "one_to_one" ? " is-active" : "")
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
                  Giới tính của bạn: {getGenderLabel(currentUser?.gender)}
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
                    {currentUser?.goalLabel || "Chưa thiết lập mục tiêu"}
                  </span>
                </div>
                <p className="cn-goal-hint">
                  Thay đổi mục tiêu trong <strong>Hồ sơ thể chất</strong> để hệ thống
                  gợi ý bạn tập phù hợp hơn.
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
              Tìm kiếm những người có cùng mục tiêu và lịch tập, tạo nhóm tối đa 5
              người để cùng nhau hoàn thành mục tiêu.
            </p>
          </header>

          {activeTab === "nearby" ? (
            <TabNearby
              currentUser={currentUser}
              connectionMode={connectionMode}
              locationRange={locationRange}
            />
          ) : (
            <TabMyConnections currentUser={currentUser} />
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
