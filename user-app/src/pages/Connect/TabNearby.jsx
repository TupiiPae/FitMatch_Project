// user-app/src/pages/Connect/TabNearby.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  listNearby,
  createMatchRequest,
  getMyRequests,
  acceptMatchRequest,
  cancelMatchRequest,
} from "../../api/match";
import { toast } from "react-toastify";
import ConnectRequestConfirmModal from "./ConnectRequestConfirmModal";

export default function TabNearby({
  currentUser,
  connectionMode,
  locationRange,
  ageRange,
  genderFilter,
  discoverable,
  goalFilter,
  onCreatedRequest,
  onEnteredRoom,
  onOpenCreateTeam, // ✅ thêm prop
}) {
  const nav = useNavigate();
  const [viewMode, setViewMode] = useState("grid");
  const [search, setSearch] = useState("");

  const [selfCard, setSelfCard] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [requestMaps, setRequestMaps] = useState({
    incomingFromUser: {},
    outgoingToUser: {},
    outgoingToRoom: {},
  });

  const [confirmState, setConfirmState] = useState({
    open: false,
    mode: null,
    target: null,
    requestId: null,
  });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const openConfirm = (mode, target, requestId) => {
    setConfirmState({ open: true, mode, target, requestId: requestId || null });
  };
  const closeConfirm = () => {
    setConfirmState({ open: false, mode: null, target: null, requestId: null });
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setErrorMsg("");

        const [nearby, reqs] = await Promise.all([
          listNearby(connectionMode),
          getMyRequests().catch((err) => {
            console.error("getMyRequests error:", err);
            return null;
          }),
        ]);

        if (cancelled) return;

        setSelfCard(nearby?.self || null);
        setItems(Array.isArray(nearby?.items) ? nearby.items : []);

        if (reqs) {
          const incoming = Array.isArray(reqs.incoming) ? reqs.incoming : [];
          const outgoing = Array.isArray(reqs.outgoing) ? reqs.outgoing : [];

          const incomingFromUser = {};
          incoming.forEach((r) => {
            if (r.type === "duo" && r.fromUser?._id) incomingFromUser[r.fromUser._id] = r._id;
          });

          const outgoingToUser = {};
          const outgoingToRoom = {};
          outgoing.forEach((r) => {
            if (r.type === "duo" && r.toUser?._id) outgoingToUser[r.toUser._id] = r._id;
            else if (r.type === "group" && r.toRoom?._id) outgoingToRoom[r.toRoom._id] = r._id;
          });

          setRequestMaps({ incomingFromUser, outgoingToUser, outgoingToRoom });
        } else {
          setRequestMaps({ incomingFromUser: {}, outgoingToUser: {}, outgoingToRoom: {} });
        }
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
    return () => { cancelled = true; };
  }, [connectionMode, discoverable]);

  const filteredList = useMemo(() => {
    let base = items || [];
    return base.filter((u) => {
      if (connectionMode === "one_to_one" && u.isGroup) return false;
      if (connectionMode === "group" && !u.isGroup) return false;

      if (goalFilter) {
        const userGoal = (u.goal || "").trim().toLowerCase();
        const myGoal = goalFilter.trim().toLowerCase();
        if (!userGoal || userGoal !== myGoal) return false;
      }

      if (!u.isGroup && locationRange !== "any") {
        const key = u.areaKey;
        if (!key) return false;
        if (locationRange === "same_city") {
          if (!["same_city", "same_district", "same_ward"].includes(key)) return false;
        } else if (locationRange === "same_district") {
          if (!["same_district", "same_ward"].includes(key)) return false;
        } else if (locationRange === "same_ward") {
          if (key !== "same_ward") return false;
        }
      }

      if (ageRange !== "all" && typeof u.age === "number") {
        const age = u.age;
        if (ageRange === "18-21" && !(age >= 18 && age <= 21)) return false;
        if (ageRange === "22-27" && !(age >= 22 && age <= 27)) return false;
        if (ageRange === "28-35" && !(age >= 28 && age <= 35)) return false;
        if (ageRange === "36-45" && !(age >= 36 && age <= 45)) return false;
        if (ageRange === "45+" && age < 45) return false;
      }

      if (genderFilter !== "all" && !u.isGroup && u.gender && u.gender !== genderFilter) return false;

      if (search.trim()) {
        const txt = search.toLowerCase();
        const haystack = [
          u.nickname || "",
          u.goal || "",
          (u.trainingTypes || []).join(" "),
          u.locationLabel || "",
          u.bio || "",
        ].join(" ").toLowerCase();
        if (!haystack.includes(txt)) return false;
      }

      return true;
    });
  }, [items, connectionMode, locationRange, ageRange, genderFilter, search, goalFilter]);

  const resultCount = filteredList.length;

  const getInviteStateFor = (u) => {
    if (u.isGroup) {
      const reqId = requestMaps.outgoingToRoom[u.id];
      return reqId ? { type: "cancel_group", requestId: reqId } : { type: "send_group" };
    } else {
      const incomingId = requestMaps.incomingFromUser[u.id];
      if (incomingId) return { type: "accept_duo", requestId: incomingId };
      const outgoingId = requestMaps.outgoingToUser[u.id];
      if (outgoingId) return { type: "cancel_duo", requestId: outgoingId };
      return { type: "send_duo" };
    }
  };

  async function handleConfirm() {
    if (!confirmState.open || !confirmState.mode || !confirmState.target) return;
    const { mode, target, requestId } = confirmState;

    try {
      setConfirmLoading(true);

      if (mode === "send_duo") {
        if (!discoverable) toast.info("Hãy bật 'Cho phép mọi người tìm kiếm bạn' để kết nối dễ dàng hơn.");
        const res = await createMatchRequest({ type: "duo", targetUserId: target.id });
        const reqDoc = res?.request || res?.data?.request || null;
        const newId = reqDoc?._id || reqDoc?.id;
        if (newId) setRequestMaps((prev) => ({ ...prev, outgoingToUser: { ...prev.outgoingToUser, [target.id]: newId } }));
        toast.success("Đã gửi lời mời kết nối.");
      } else if (mode === "send_group") {
        if (!discoverable) toast.info("Hãy bật 'Cho phép mọi người tìm kiếm bạn' để kết nối dễ dàng hơn.");
        const res = await createMatchRequest({ type: "group", targetRoomId: target.id });
        const reqDoc = res?.request || res?.data?.request || null;
        const newId = reqDoc?._id || reqDoc?.id;
        if (newId) setRequestMaps((prev) => ({ ...prev, outgoingToRoom: { ...prev.outgoingToRoom, [target.id]: newId } }));
        toast.success("Đã gửi yêu cầu xin tham gia nhóm.");
      } else if (mode === "cancel_duo") {
        if (!requestId) return;
        await cancelMatchRequest(requestId);
        setRequestMaps((prev) => {
          const outgoingToUser = { ...prev.outgoingToUser };
          delete outgoingToUser[target.id];
          return { ...prev, outgoingToUser };
        });
        toast.success("Đã hủy lời mời kết nối.");
      } else if (mode === "cancel_group") {
        if (!requestId) return;
        await cancelMatchRequest(requestId);
        setRequestMaps((prev) => {
          const outgoingToRoom = { ...prev.outgoingToRoom };
          delete outgoingToRoom[target.id];
          return { ...prev, outgoingToRoom };
        });
        toast.success("Đã hủy yêu cầu tham gia nhóm.");
      } else if (mode === "accept_duo") {
        if (!requestId) return;
        const res = await acceptMatchRequest(requestId);
        const payload = res?.data ?? res;
        const roomId = payload?.roomId || payload?.data?.roomId || null;
        const roomType = payload?.roomType || payload?.data?.roomType || "duo";

        setRequestMaps((prev) => {
          const incomingFromUser = { ...prev.incomingFromUser };
          delete incomingFromUser[target.id];
          return { ...prev, incomingFromUser };
        });

        toast.success("Đã xác nhận lời mời kết nối.");
        if (onEnteredRoom && roomId) onEnteredRoom(roomId, roomType);
      }

      onCreatedRequest && onCreatedRequest();
      closeConfirm();
    } catch (e) {
      console.error("Confirm connect action error:", e);
      const msg = e?.response?.data?.message || e?.response?.data?.error || "Không thể thực hiện thao tác. Vui lòng thử lại.";
      toast.error(msg);
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <>
      <header className="cn-main-header">
        <h1>Kết nối bạn tập</h1>
        <p>Tìm kiếm những người có cùng mục tiêu và lịch tập, tạo nhóm tối đa 5 người để cùng nhau hoàn thành mục tiêu.</p>
      </header>

      <section className="cn-tab-nearby">
        <div className="cn-main-toolbar">
          <div className="cn-main-toolbar-left">
            <span className="cn-result-text">
              {loading ? "Đang tìm gợi ý quanh bạn..." : `${resultCount} kết quả phù hợp quanh bạn`}
            </span>
          </div>

          <div className="cn-main-toolbar-right">
            <button className="cn-create-group-btn" type="button" onClick={() => onOpenCreateTeam?.()}>
              <span className="cn-create-group-icon">＋</span>
              <span>Tạo nhóm mới (tối đa 5 người)</span>
            </button>

            <div className="cn-view-toggle">
              <button type="button" className={"cn-view-toggle-btn" + (viewMode === "grid" ? " is-active" : "")} onClick={() => setViewMode("grid")}>
                <i className="fa-solid fa-table-cells-large" />
              </button>
              <button type="button" className={"cn-view-toggle-btn" + (viewMode === "list" ? " is-active" : "")} onClick={() => setViewMode("list")}>
                <i className="fa-solid fa-list" />
              </button>
            </div>
          </div>
        </div>

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

        {errorMsg && (
          <div className="cn-error">
            <p>{errorMsg}</p>
          </div>
        )}

        <div className={"cn-card-list " + (viewMode === "grid" ? "cn-card-list--grid" : "cn-card-list--list")}>
          {selfCard && (
            <ConnectCard key="self" user={selfCard} viewMode={viewMode} inviteState={null} onOpenConfirm={null} isSelf={true} />
          )}

          {filteredList.map((u) => (
            <ConnectCard
              key={u.id}
              user={u}
              viewMode={viewMode}
              inviteState={getInviteStateFor(u)}
              onOpenConfirm={openConfirm}
              isSelf={false}
            />
          ))}
        </div>

        {!loading && filteredList.length === 0 && (
          <div className="cn-empty" style={{ marginTop: 8 }}>
            <p>Chưa tìm thấy bạn tập phù hợp với bộ lọc hiện tại. Thử nới rộng phạm vi hoặc thay đổi chế độ kết nối nhé.</p>
          </div>
        )}
      </section>

      <ConnectRequestConfirmModal
        open={confirmState.open}
        mode={confirmState.mode}
        targetName={confirmState.target?.nickname || ""}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
        loading={confirmLoading}
      />
    </>
  );
}

/* ===== Card: Grid & List ===== */
function ConnectCard({ user, viewMode, inviteState, onOpenConfirm, isSelf = false }) {
  const nav = useNavigate();

  const {
    id, nickname, age, gender,
    goal, trainingTypes = [], intensityLabel, locationLabel,
    bio, isGroup, membersCount, imageUrl, areaLabel
  } = user;

  const isPreview = isSelf || !onOpenConfirm;

  const genderLabel =
    !isGroup && gender === "male" ? "Nam" :
    !isGroup && gender === "female" ? "Nữ" :
    !isGroup && gender ? "Khác" : "";

  const areaText = isSelf ? "Nhà" : (areaLabel || "");

  const metaLineParts = [];
  if (!isGroup && age) metaLineParts.push(`${age} tuổi`);
  if (!isGroup && genderLabel) metaLineParts.push(genderLabel);
  if (locationLabel) metaLineParts.push(`📍 ${locationLabel}`);
  const metaLine = metaLineParts.join(" · ");

  const inviteType = inviteState?.type || null;
  const inviteReqId = inviteState?.requestId || null;

  let primaryLabel = "", primaryClass = "cn-btn-primary";
  if (inviteType === "accept_duo") { primaryLabel = "Xác nhận lời mời kết nối"; primaryClass = "cn-btn-success"; }
  else if (inviteType === "cancel_duo") { primaryLabel = "Hủy lời mời kết nối"; primaryClass = "cn-btn-cancel"; }
  else if (inviteType === "cancel_group") { primaryLabel = "Hủy yêu cầu tham gia nhóm"; primaryClass = "cn-btn-cancel"; }
  else if (inviteType === "send_group") { primaryLabel = "Xin tham gia nhóm"; primaryClass = "cn-btn-primary"; }
  else if (inviteType === "send_duo") { primaryLabel = "Gửi lời mời kết nối"; primaryClass = "cn-btn-primary"; }

  const goProfile = () => { if (isSelf) return; nav(`/ket-noi/ho-so/${id}`); };
  const handlePrimaryClick = () => { if (!inviteType || !onOpenConfirm) return; onOpenConfirm(inviteType, user, inviteReqId); };

  if (viewMode === "grid") {
    return (
      <article className="cn-card cn-card--grid">
        {isSelf && (
          <div className="cn-card-pin" title="Hồ sơ của bạn">
            <i className="fa-solid fa-thumbtack" />
          </div>
        )}

        <div className="cn-card-img-wrap">
          <img src={imageUrl} alt={nickname} className="cn-card-img" />
          <div className="cn-card-img-overlay">
            {isPreview ? (
              <div className="cn-card-img-name-btn cn-card-img-name-static">{nickname}</div>
            ) : (
              <button type="button" className="cn-card-img-name-btn" onClick={goProfile}>{nickname}</button>
            )}

            {areaText && <div className="cn-card-img-distance">{areaText}</div>}
            {isGroup && <div className="cn-card-img-badge">Nhóm · {membersCount || 1} / 5</div>}
          </div>
        </div>

        <div className="cn-card-body">
          {metaLine && <div className="cn-card-meta-line">{metaLine}</div>}

          <div className="cn-card-chip-row">
            {goal && <span className="cn-chip cn-chip-goal">{goal}</span>}
            {intensityLabel && <span className="cn-chip cn-chip-level">{intensityLabel}</span>}
          </div>

          {bio && <p className="cn-card-bio-text">{bio}</p>}

          {!isSelf && inviteType && (
            <div className="cn-card-actions">
              <button type="button" className={primaryClass} onClick={handlePrimaryClick}>{primaryLabel}</button>
              <button type="button" className="cn-btn-ghost"><i className="fa-solid fa-flag"></i></button>
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="cn-card cn-card--list">
      {isSelf && (
        <div className="cn-card-pin" title="Hồ sơ của bạn">
          <i className="fa-solid fa-thumbtack" />
        </div>
      )}

      <div className="cn-avatar">
        <img src={imageUrl} alt={nickname} className="cn-avatar-img" />
      </div>

      <div className="cn-card-main">
        <div className="cn-card-header">
          <div>
            <div className="cn-nickname-row">
              {isPreview ? (
                <span className="cn-name-static">{nickname}</span>
              ) : (
                <button type="button" className="cn-name-link" onClick={goProfile}>{nickname}</button>
              )}
              {isGroup && <span className="cn-badge cn-badge-group">Nhóm · {membersCount} / 5</span>}
            </div>

            <div className="cn-meta-row">
              {!isGroup && age && <span className="cn-meta">{age} tuổi · {genderLabel || "—"}</span>}
              {areaText && <span className="cn-meta">{areaText}</span>}
              {locationLabel && <span className="cn-meta">📍 {locationLabel}</span>}
            </div>
          </div>
        </div>

        <div className="cn-goal-row">
          {goal && <span className="cn-badge cn-badge-goal">{goal}</span>}
          {intensityLabel && <span className="cn-badge cn-badge-level">{intensityLabel}</span>}
        </div>

        {trainingTypes.length > 0 && <p className="cn-frequency">Ưu tiên: {trainingTypes.join(" · ")}</p>}
        {bio && <p className="cn-bio">{bio}</p>}

        {!isSelf && inviteType && (
          <div className="cn-card-actions">
            <button type="button" className={primaryClass} onClick={handlePrimaryClick}>{primaryLabel}</button>
            <button type="button" className="cn-btn-ghost">Báo cáo</button>
          </div>
        )}
      </div>
    </article>
  );
}
