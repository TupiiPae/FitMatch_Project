// user-app/src/pages/Connect/TabNearby.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listNearby,
  createMatchRequest,
} from "../../api/match";
import { toast } from "react-toastify";

export default function TabNearby({
  currentUser,
  connectionMode,
  locationRange,
  ageRange,
  genderFilter,
  discoverable,
}) {
  const nav = useNavigate();
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "list"
  const [search, setSearch] = useState("");

  const [selfCard, setSelfCard] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ===== Load từ API /match/nearby =====
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErrorMsg("");

        const res = await listNearby(connectionMode);
        const payload = res?.data ?? res;

        if (cancelled) return;

        setSelfCard(payload?.self || null);
        setItems(Array.isArray(payload?.items) ? payload.items : []);
      } catch (e) {
        if (cancelled) return;
        console.error("listNearby error:", e);
        const msg =
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          "Không thể tải danh sách gợi ý xung quanh.";
        setErrorMsg(msg);
        setSelfCard(null);
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [connectionMode]);

  // ===== Filter danh sách theo range / age / gender / search =====
  const filteredList = useMemo(() => {
    let base = items || [];

    return base.filter((u) => {
      // Mode 1:1 hoặc Nhóm
      if (connectionMode === "one_to_one" && u.isGroup) return false;
      if (connectionMode === "group" && !u.isGroup) return false;

      // Vị trí
      if (
        locationRange !== "any" &&
        typeof u.distanceKm === "number"
      ) {
        const maxRange = Number(locationRange);
        if (u.distanceKm > maxRange) return false;
      }

      // Độ tuổi
      if (ageRange !== "all" && typeof u.age === "number") {
        const age = u.age;
        if (ageRange === "18-21" && !(age >= 18 && age <= 21))
          return false;
        if (ageRange === "22-27" && !(age >= 22 && age <= 27))
          return false;
        if (ageRange === "28-35" && !(age >= 28 && age <= 35))
          return false;
        if (ageRange === "36-45" && !(age >= 36 && age <= 45))
          return false;
        if (ageRange === "45+" && age < 45) return false;
      }

      // Giới tính
      if (
        genderFilter !== "all" &&
        !u.isGroup &&
        u.gender &&
        u.gender !== genderFilter
      ) {
        return false;
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
  }, [
    items,
    connectionMode,
    locationRange,
    ageRange,
    genderFilter,
    search,
  ]);

  const resultCount = filteredList.length;

  // ===== Gửi lời mời kết nối =====
  async function handleInvite(user) {
    try {
      if (!discoverable) {
        toast.info(
          "Hãy bật 'Cho phép mọi người tìm kiếm bạn' để kết nối dễ dàng hơn."
        );
      }

      if (user.isGroup) {
        // group
        const res = await createMatchRequest({
          type: "group",
          targetRoomId: user.id,
        });
        const payload = res?.data ?? res;
        if (payload?.request) {
          toast.success("Đã gửi yêu cầu xin tham gia nhóm.");
        } else {
          toast.success("Đã gửi yêu cầu xin tham gia nhóm.");
        }
      } else {
        // duo
        const res = await createMatchRequest({
          type: "duo",
          targetUserId: user.id,
        });
        const payload = res?.data ?? res;
        if (payload?.request) {
          toast.success("Đã gửi lời mời kết nối.");
        } else {
          toast.success("Đã gửi lời mời kết nối.");
        }
      }
    } catch (e) {
      console.error("createMatchRequest error:", e);
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        "Không thể gửi lời mời. Vui lòng thử lại.";
      toast.error(msg);
    }
  }

  return (
    <section className="cn-tab-nearby">
      {/* Toolbar: kết quả + tạo nhóm + toggle view */}
      <div className="cn-main-toolbar">
        <div className="cn-main-toolbar-left">
          <span className="cn-result-text">
            {loading
              ? "Đang tìm gợi ý quanh bạn..."
              : `${resultCount} kết quả phù hợp quanh bạn`}
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
                "cn-view-toggle-btn" +
                (viewMode === "grid" ? " is-active" : "")
              }
              onClick={() => setViewMode("grid")}
            >
              <i className="fa-solid fa-table-cells-large" />
            </button>
            <button
              type="button"
              className={
                "cn-view-toggle-btn" +
                (viewMode === "list" ? " is-active" : "")
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

      {/* Thông báo lỗi nếu có */}
      {errorMsg && (
        <div className="cn-error">
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Pinned card của chính mình (nếu có) */}
      {selfCard && (
        <div className="cn-self-card-wrap">
          <div className="cn-self-card-title">
            <span>Hồ sơ của bạn</span>
          </div>
          <ConnectCard
            user={selfCard}
            viewMode="list"
            onInvite={null}
          />
        </div>
      )}

      {/* Danh sách */}
      {filteredList.length === 0 && !loading ? (
        <div className="cn-empty">
          <p>
            Chưa tìm thấy bạn tập phù hợp với bộ lọc hiện tại. Thử nới
            rộng phạm vi hoặc thay đổi chế độ kết nối nhé.
          </p>
        </div>
      ) : (
        <div
          className={
            "cn-card-list " +
            (viewMode === "grid"
              ? "cn-card-list--grid"
              : "cn-card-list--list")
          }
        >
          {filteredList.map((u) => (
            <ConnectCard
              key={u.id}
              user={u}
              viewMode={viewMode}
              onInvite={handleInvite}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ===== Card: Grid & List ===== */

function ConnectCard({ user, viewMode, onInvite }) {
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

  const handleInviteClick = () => {
    onInvite && onInvite(user);
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
              <div className="cn-card-img-distance">
                {distanceShort}
              </div>
            )}
            {isGroup && (
              <div className="cn-card-img-badge">
                Nhóm · {membersCount || 1} / 5
              </div>
            )}
          </div>
        </div>

        <div className="cn-card-body">
          {metaLine && (
            <div className="cn-card-meta-line">{metaLine}</div>
          )}

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
            <button
              type="button"
              className="cn-btn-primary"
              onClick={handleInviteClick}
            >
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
          <button
            type="button"
            className="cn-btn-primary"
            onClick={handleInviteClick}
          >
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
