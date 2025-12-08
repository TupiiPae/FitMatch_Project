// user-app/src/pages/Connect/TabNearby.jsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

/** Mock data gợi ý – chỉ dùng cho UI, sau này thay bằng API */
const MOCK_SUGGESTIONS = [
  {
    id: "u1",
    nickname: "Nhật Thiên",
    age: 24,
    gender: "male",
    distanceKm: 2.1,
    goal: "Tăng cơ",
    goalKey: "lose_weight",
    trainingTypes: ["Cardio", "Strength"],
    frequency: "Rất năng động",
    locationLabel: "Quận 1, TP.HCM",
    bio: "Thích chạy bộ, HIIT và tập tạ cơ bản.",
    imageUrl: "https://i.pinimg.com/736x/f4/8e/3b/f48e3b4a5aacfd596ff74e203bdbecb7.jpg", 
  },
  {
    id: "u2",
    nickname: "Nhật Hào",
    age: 27,
    gender: "male",
    distanceKm: 4.8,
    goal: "Tăng cơ",
    goalKey: "muscle_gain",
    trainingTypes: ["Strength"],
    frequency: "Chăm chỉ tập luyện",
    locationLabel: "Bình Thạnh, TP.HCM",
    bio: "Ưu tiên tập kháng lực và compound.Ưu tiên tập kháng lực và compound.Ưu tiên tập kháng lực và compound.",
    imageUrl: "https://i.pinimg.com/1200x/b0/07/34/b007344944aafec0d05a314614c80f07.jpg",
  },
  {
    id: "u3",
    nickname: "Ngọc Phước",
    age: 22,
    gender: "male",
    distanceKm: 1.3,
    goal: "Tăng cơ",
    goalKey: "stay_fit",
    trainingTypes: ["Cardio", "Yoga"],
    frequency: "Chăm chỉ tập luyện",
    locationLabel: "Quận 3, TP.HCM",
    bio: "Ưa thích yoga nhẹ nhàng và đi bộ nhanh.",
    imageUrl: "https://i.pinimg.com/1200x/2c/ed/ff/2cedff76c399563af28149ade2d922f7.jpg",
  },
  {
    id: "u4",
    nickname: "Team Runner Q7",
    isGroup: true,
    membersCount: 4,
    gender: "mixed",
    distanceKm: 6.2,
    goal: "Chạy 5K mỗi tuần",
    goalKey: "endurance",
    trainingTypes: ["Cardio"],
    frequency: "3 buổi/tuần",
    locationLabel: "Quận 7, TP.HCM",
    bio: "Nhóm chuyên chạy bộ, đang tuyển thêm 1–2 bạn.",
    imageUrl: "https://i.pinimg.com/736x/62/fa/35/62fa3542956d6d598796cee854c651c0.jpg",
  },
];

export default function TabNearby({ currentUser, connectionMode, locationRange }) {
  const nav = useNavigate();
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"
  const [search, setSearch] = useState("");

  /**
   * Lọc danh sách:
   *  - Hiện tại CHƯA filter theo mục tiêu/giới tính để dễ debug UI.
   *  - Sau này có data thật có thể bật filter theo currentUser.goalKey & gender.
   */
  const filteredList = useMemo(() => {
    return MOCK_SUGGESTIONS.filter((u) => {
      // Mode 1:1 hoặc Nhóm
      if (connectionMode === "one_to_one" && u.isGroup) return false;
      if (connectionMode === "group" && !u.isGroup) return false;

      // Vị trí
      if (locationRange !== "any" && typeof u.distanceKm === "number") {
        const maxRange = Number(locationRange);
        if (u.distanceKm > maxRange) return false;
      }

      // Tìm kiếm text
      if (search.trim()) {
        const txt = search.toLowerCase();
        const haystack = [
          u.nickname || "",
          u.goal || "",
          (u.trainingTypes || []).join(" "),
          u.locationLabel || "",
          u.bio || "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(txt)) return false;
      }

      return true;
    });
  }, [connectionMode, locationRange, search]);

  const resultCount = filteredList.length;

  return (
    <section className="cn-tab-nearby">
      {/* Toolbar: kết quả + tạo nhóm + toggle view */}
      <div className="cn-main-toolbar">
        <div className="cn-main-toolbar-left">
          <span className="cn-result-text">
            {resultCount} kết quả phù hợp quanh bạn
          </span>
        </div>
        <div className="cn-main-toolbar-right">
          <button
            className="cn-create-group-btn"
            type="button"
            onClick={() => nav("/ket-noi/tao-nhom")}
          >
            <span className="cn-create-group-icon">＋</span>
            <span>Tạo nhóm mới (tối đa 5 người)</span>
          </button>
          <div className="cn-view-toggle">
            <button
              type="button"
              className={
                "cn-view-toggle-btn" + (viewMode === "grid" ? " is-active" : "")
              }
              onClick={() => setViewMode("grid")}
            >
              <i className="fa-solid fa-table-cells-large" />
            </button>
            <button
              type="button"
              className={
                "cn-view-toggle-btn" + (viewMode === "list" ? " is-active" : "")
              }
              onClick={() => setViewMode("list")}
            >
              <i className="fa-solid fa-list" />
            </button>
          </div>
        </div>
      </div>

      {/* Thanh search */}
      <div className="cn-main-search">
        <div className="cn-search-input">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            type="text"
            placeholder="Tìm theo tên, môn tập, mục tiêu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Danh sách */}
      {filteredList.length === 0 ? (
        <div className="cn-empty">
          <p>
            Chưa tìm thấy bạn tập phù hợp với bộ lọc hiện tại. Thử nới rộng
            phạm vi hoặc thay đổi chế độ kết nối nhé.
          </p>
        </div>
      ) : (
        <div
          className={
            "cn-card-list " +
            (viewMode === "grid" ? "cn-card-list--grid" : "cn-card-list--list")
          }
        >
          {filteredList.map((u) => (
            <ConnectCard key={u.id} user={u} viewMode={viewMode} />
          ))}
        </div>
      )}
    </section>
  );
}

/* ===== Card: Grid & List ===== */

function ConnectCard({ user, viewMode }) {
  const nav = useNavigate();

  const {
    id,
    nickname,
    age,
    gender,
    distanceKm,
    goal,
    trainingTypes = [],
    frequency,
    locationLabel,
    bio,
    isGroup,
    membersCount,
    imageUrl,
  } = user;

  const genderLabel =
    !isGroup && gender === "male"
      ? "Nam"
      : !isGroup && gender === "female"
      ? "Nữ"
      : !isGroup && gender
      ? "Khác"
      : "";

  const distanceShort =
    typeof distanceKm === "number"
      ? `Cách bạn ${Math.round(distanceKm)} km`
      : "";

  const metaLineParts = [];
  if (!isGroup && age) metaLineParts.push(`${age} tuổi`);
  if (!isGroup && genderLabel) metaLineParts.push(genderLabel);
  if (locationLabel) metaLineParts.push(`📍 ${locationLabel}`);
  const metaLine = metaLineParts.join(" · ");

  const goalLabel = goal || "";
  const levelLabel = frequency || "";

  const goProfile = () => {
    // TODO: sau này tạo route hồ sơ public, ví dụ: /ket-noi/ho-so/:id
    nav(`/ket-noi/ho-so/${id}`);
  };

  // ===== GRID STYLE (card có ảnh lớn) =====
  if (viewMode === "grid") {
    return (
      <article className="cn-card cn-card--grid">
        <div className="cn-card-img-wrap">
          <img
            src={imageUrl}
            alt={nickname}
            className="cn-card-img"
          />
          <div className="cn-card-img-overlay">
            <button
              type="button"
              className="cn-card-img-name-btn"
              onClick={goProfile}
            >
              {nickname}
            </button>
            {distanceShort && (
              <div className="cn-card-img-distance">{distanceShort}</div>
            )}
            {isGroup && (
              <div className="cn-card-img-badge">
                Nhóm · {membersCount || 1} / 5
              </div>
            )}
          </div>
        </div>

        <div className="cn-card-body">
          {metaLine && <div className="cn-card-meta-line">{metaLine}</div>}

          <div className="cn-card-chip-row">
            {goalLabel && (
              <span className="cn-chip cn-chip-goal">{goalLabel}</span>
            )}
            {levelLabel && (
              <span className="cn-chip cn-chip-level">{levelLabel}</span>
            )}
          </div>

          {bio && <p className="cn-card-bio-text">{bio}</p>}

          {/* Luôn nằm cuối card nhờ margin-top:auto trong CSS */}
          <div className="cn-card-actions">
            <button type="button" className="cn-btn-primary">
              {isGroup ? "Xin tham gia nhóm" : "Gửi lời mời kết nối"}
            </button>
            <button type="button" className="cn-btn-ghost">
              <i className="fa-solid fa-flag"></i>
            </button>
          </div>
        </div>
      </article>
    );
  }

  // ===== LIST STYLE =====
  return (
    <article className="cn-card cn-card--list">
      <div className="cn-avatar">
        <img
          src={imageUrl}
          alt={nickname}
          className="cn-avatar-img"
        />
      </div>

      <div className="cn-card-main">
        <div className="cn-card-header">
          <div>
            <div className="cn-nickname-row">
              <button
                type="button"
                className="cn-name-link"
                onClick={goProfile}
              >
                {nickname}
              </button>
              {isGroup && (
                <span className="cn-badge cn-badge-group">
                  Nhóm · {membersCount} / 5
                </span>
              )}
            </div>
            <div className="cn-meta-row">
              {!isGroup && age && (
                <span className="cn-meta">
                  {age} tuổi · {genderLabel || "—"}
                </span>
              )}
              {locationLabel && (
                <span className="cn-meta">📍 {locationLabel}</span>
              )}
              {typeof distanceKm === "number" && (
                <span className="cn-meta">
                  Cách bạn ~{distanceKm.toFixed(1)} km
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="cn-goal-row">
          <span className="cn-badge cn-badge-goal">{goal}</span>
          {trainingTypes.length > 0 && (
            <span className="cn-meta">
              Ưu tiên: {trainingTypes.join(" · ")}
            </span>
          )}
        </div>

        {frequency && <p className="cn-frequency">{frequency}</p>}

        {bio && <p className="cn-bio">{bio}</p>}

        <div className="cn-card-actions">
          <button type="button" className="cn-btn-primary">
            {isGroup ? "Xin tham gia nhóm" : "Gửi lời mời kết nối"}
          </button>
          <button type="button" className="cn-btn-ghost">
            Báo cáo
          </button>
        </div>
      </div>
    </article>
  );
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
