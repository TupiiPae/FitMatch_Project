// user-app/src/pages/Connect/TabMyConnections.jsx
import { useEffect, useState } from "react";
import {
  getMyRequests,
  acceptMatchRequest,
  rejectMatchRequest,
  cancelMatchRequest,
} from "../../api/match";
import { toast } from "react-toastify";

export default function TabMyConnections({ currentUser }) {
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function load() {
    try {
      setLoading(true);
      setErrorMsg("");

      const res = await getMyRequests();
      const payload = res?.data ?? res;

      setIncoming(Array.isArray(payload?.incoming) ? payload.incoming : []);
      setOutgoing(Array.isArray(payload?.outgoing) ? payload.outgoing : []);
    } catch (e) {
      console.error("getMyRequests error:", e);
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        "Không thể tải danh sách lời mời.";
      setErrorMsg(msg);
      setIncoming([]);
      setOutgoing([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAccept(id) {
    try {
      await acceptMatchRequest(id);
      toast.success("Đã chấp nhận lời mời.");
      load();
    } catch (e) {
      console.error("acceptMatchRequest error:", e);
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        "Không thể chấp nhận lời mời.";
      toast.error(msg);
    }
  }

  async function handleReject(id) {
    try {
      await rejectMatchRequest(id);
      toast.info("Đã từ chối lời mời.");
      load();
    } catch (e) {
      console.error("rejectMatchRequest error:", e);
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        "Không thể từ chối lời mời.";
      toast.error(msg);
    }
  }

  async function handleCancel(id) {
    try {
      await cancelMatchRequest(id);
      toast.info("Đã hủy lời mời.");
      load();
    } catch (e) {
      console.error("cancelMatchRequest error:", e);
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        "Không thể hủy lời mời.";
      toast.error(msg);
    }
  }

  const hasIncoming = incoming.length > 0;
  const hasOutgoing = outgoing.length > 0;

  return (
    <section className="cn-tab-requests">
      <div className="cn-main-toolbar">
        <div className="cn-main-toolbar-left">
          <span className="cn-result-text">
            Lời mời kết nối & yêu cầu tham gia nhóm
          </span>
        </div>
      </div>

      {loading && (
        <div className="cn-empty">
          <p>Đang tải danh sách lời mời...</p>
        </div>
      )}

      {errorMsg && !loading && (
        <div className="cn-error">
          <p>{errorMsg}</p>
        </div>
      )}

      {!loading && !errorMsg && !hasIncoming && !hasOutgoing && (
        <div className="cn-empty">
          <p>
            Hiện bạn chưa có lời mời kết nối nào. Hãy khám phá tab{" "}
            <strong>Tìm kiếm xung quanh</strong> để gửi lời mời bạn tập
            mới nhé.
          </p>
        </div>
      )}

      <div className="cn-requests-grid">
        {/* INCOMING */}
        <div className="cn-requests-column">
          <h3 className="cn-requests-title">Lời mời đến</h3>
          {incoming.map((req) => (
            <RequestCardIncoming
              key={req._id}
              req={req}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          ))}
          {!hasIncoming && !loading && (
            <p className="cn-requests-empty">Chưa có lời mời mới.</p>
          )}
        </div>

        {/* OUTGOING */}
        <div className="cn-requests-column">
          <h3 className="cn-requests-title">Lời mời đã gửi</h3>
          {outgoing.map((req) => (
            <RequestCardOutgoing
              key={req._id}
              req={req}
              onCancel={handleCancel}
            />
          ))}
          {!hasOutgoing && !loading && (
            <p className="cn-requests-empty">
              Bạn chưa gửi lời mời kết nối nào.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/* ===== Request cards ===== */

function RequestCardIncoming({ req, onAccept, onReject }) {
  const fromUser = req.fromUser || {};
  const profile = fromUser.profile || {};
  const nickname =
    profile.nickname || fromUser.username || "Người dùng FitMatch";
  const avatarUrl = profile.avatarUrl;
  const goalLabel =
    fromUser.connectGoalLabel ||
    (req.meta && req.meta.fromGoalLabel) ||
    "";

  const createdAt = req.createdAt
    ? new Date(req.createdAt).toLocaleString("vi-VN")
    : "";

  return (
    <article className="cn-request-card">
      <div className="cn-request-header">
        <div className="cn-request-avatar">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={nickname}
              className="cn-avatar-img"
            />
          ) : (
            <div className="cn-avatar-placeholder">
              {getInitials(nickname)}
            </div>
          )}
        </div>
        <div>
          <div className="cn-request-title">{nickname}</div>
          {goalLabel && (
            <div className="cn-request-sub">
              Mục tiêu: <strong>{goalLabel}</strong>
            </div>
          )}
          {createdAt && (
            <div className="cn-request-time">Gửi lúc: {createdAt}</div>
          )}
        </div>
      </div>

      {req.message && (
        <p className="cn-request-message">“{req.message}”</p>
      )}

      <div className="cn-request-actions">
        <button
          type="button"
          className="cn-btn-primary"
          onClick={() => onAccept(req._id)}
        >
          Chấp nhận
        </button>
        <button
          type="button"
          className="cn-btn-ghost"
          onClick={() => onReject(req._id)}
        >
          Từ chối
        </button>
      </div>
    </article>
  );
}

function RequestCardOutgoing({ req, onCancel }) {
  const type = req.type; // "duo" | "group"
  const toUser = req.toUser || null;
  const toRoom = req.toRoom || null;

  let title = "";
  let subtitle = "";

  if (type === "duo" && toUser) {
    const profile = toUser.profile || {};
    title =
      profile.nickname || toUser.username || "Người dùng FitMatch";
    subtitle = "Lời mời kết nối 1:1";
  } else if (type === "group" && toRoom) {
    title = toRoom.name || "Nhóm tập luyện";
    const membersCount = toRoom.members?.length || 0;
    subtitle = `Yêu cầu tham gia nhóm · ${membersCount} thành viên`;
  } else {
    title = "Yêu cầu kết nối";
  }

  const createdAt = req.createdAt
    ? new Date(req.createdAt).toLocaleString("vi-VN")
    : "";

  return (
    <article className="cn-request-card">
      <div className="cn-request-header">
        <div className="cn-request-avatar cn-request-avatar--small">
          <span className="cn-avatar-placeholder">
            {title ? title[0]?.toUpperCase() : "?"}
          </span>
        </div>
        <div>
          <div className="cn-request-title">{title}</div>
          {subtitle && (
            <div className="cn-request-sub">{subtitle}</div>
          )}
          {createdAt && (
            <div className="cn-request-time">Gửi lúc: {createdAt}</div>
          )}
        </div>
      </div>

      {req.message && (
        <p className="cn-request-message">“{req.message}”</p>
      )}

      <div className="cn-request-actions">
        <button
          type="button"
          className="cn-btn-ghost"
          onClick={() => onCancel(req._id)}
        >
          Hủy lời mời
        </button>
      </div>
    </article>
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
