// user-app/src/pages/Connect/TabMyConnections.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getMyRequests,
  acceptMatchRequest,
  rejectMatchRequest,
  cancelMatchRequest,
} from "../../api/match";
import { toast } from "react-toastify";
import ConnectRequestConfirmModal from "./ConnectRequestConfirmModal";

export default function TabMyConnections({ currentUser }) {
  const nav = useNavigate();

  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Modal xác nhận chung (dùng lại như TabNearby)
  const [confirmState, setConfirmState] = useState({
    open: false,
    mode: null, // 'accept_duo' | 'reject_duo' | 'cancel_duo' | 'cancel_group'
    requestId: null,
    targetName: "",
  });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const openConfirm = (mode, req, targetName) => {
    const id = req?._id || req?.id;
    if (!id) return;
    setConfirmState({
      open: true,
      mode,
      requestId: id,
      targetName: targetName || "",
    });
  };

  const closeConfirm = () => {
    setConfirmState((prev) => ({
      ...prev,
      open: false,
    }));
  };

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

  // Xử lý khi bấm nút xác nhận trong modal
  async function handleConfirm() {
    const { mode, requestId } = confirmState;
    if (!mode || !requestId) return;

    try {
      setConfirmLoading(true);

      if (mode === "accept_duo") {
        await acceptMatchRequest(requestId);
        toast.success("Đã xác nhận lời mời kết nối.");
        // Sau này nếu muốn điều hướng vào phòng, có thể lấy roomId từ response
      } else if (mode === "reject_duo") {
        await rejectMatchRequest(requestId);
        toast.info("Đã từ chối lời mời.");
      } else if (mode === "cancel_duo") {
        await cancelMatchRequest(requestId);
        toast.info("Đã hủy lời mời kết nối 1:1.");
      } else if (mode === "cancel_group") {
        await cancelMatchRequest(requestId);
        toast.info("Đã hủy yêu cầu tham gia nhóm.");
      }

      await load();
      closeConfirm();
    } catch (e) {
      console.error("handleConfirm error:", e);
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        "Không thể thực hiện thao tác. Vui lòng thử lại.";
      toast.error(msg);
    } finally {
      setConfirmLoading(false);
    }
  }

  // Phân loại request giống UI mock cũ
  const incomingRequests = incoming.filter((r) => r.type === "duo");
  const outgoingUserRequests = outgoing.filter((r) => r.type === "duo");
  const outgoingGroupRequests = outgoing.filter((r) => r.type === "group");

  const hasRequests =
    incomingRequests.length +
      outgoingUserRequests.length +
      outgoingGroupRequests.length >
    0;

  const handleOpenTeamConnectDemo = () => {
    nav("/ket-noi/nhom");
  };

  return (
    <section className="cn-myconnections">
      <h2>Kết nối của tôi</h2>
      <p className="cn-myconnections-sub">
        Quản lý các lời mời kết nối đang chờ xử lý. Khi{" "}
        <strong>Xác nhận</strong>, bạn sẽ được chuyển sang phòng kết nối 1:1 hoặc
        phòng nhóm tương ứng.
      </p>

      {loading && (
        <div className="cn-empty" style={{ marginTop: 6 }}>
          <p>Đang tải danh sách lời mời...</p>
        </div>
      )}

      {errorMsg && !loading && (
        <div className="cn-error" style={{ marginTop: 6 }}>
          <p>{errorMsg}</p>
        </div>
      )}

      {!loading && !errorMsg && !hasRequests && (
        <>
          <p className="cn-myconnections-placeholder">
            Hiện bạn chưa có bất kỳ lời mời kết nối nào. Hãy dùng tab{" "}
            <strong>Tìm kiếm xung quanh</strong> để gửi lời mời hoặc tham gia
            nhóm mới.
          </p>

          <button
            type="button"
            className="cn-btn-ghost"
            style={{ marginTop: 10 }}
            onClick={handleOpenTeamConnectDemo}
          >
            Xem giao diện Kết nối nhóm (demo)
          </button>
        </>
      )}

      {/* ===== Box 1: Có người dùng gửi lời mời kết nối ===== */}
      {!loading && !errorMsg && incomingRequests.length > 0 && (
        <div className="cn-myconnections-card">
          <div className="cn-requests-section">
            <h3 className="cn-requests-title">
              Có người dùng gửi lời mời kết nối
            </h3>
            <p className="cn-requests-desc">
              Khi bạn nhấp <strong>Xác nhận lời mời kết nối</strong>, hệ thống
              sẽ tạo phòng kết nối 1:1 giữa bạn và người dùng đó.
            </p>

            <div className="cn-requests-list">
              {incomingRequests.map((req) => {
                const fromUser = req.fromUser || {};
                const profile = fromUser.profile || {};
                const nickname =
                  profile.nickname ||
                  fromUser.username ||
                  "Người dùng FitMatch";
                const goalLabel =
                  fromUser.connectGoalLabel ||
                  req.meta?.fromGoalLabel ||
                  "Chưa rõ";
                const avatarUrl = profile.avatarUrl || null;
                const createdAtText = formatViDateTime(req.createdAt);
                const note =
                  req.message ||
                  "Người dùng này muốn kết nối 1:1 với bạn.";

                return (
                  <article key={req._id} className="cn-request-row">
                    {avatarUrl && (
                      <div className="cn-request-thumb">
                        <img src={avatarUrl} alt={nickname} />
                      </div>
                    )}

                    <div className="cn-request-main-col">
                      <div className="cn-request-type">Lời mời đến</div>
                      <h4 className="cn-request-title">
                        <strong>{nickname}</strong> muốn kết nối 1:1 với bạn
                      </h4>
                      <p className="cn-request-main">{note}</p>
                      <p className="cn-request-meta">
                        Mục tiêu tập luyện: {goalLabel}
                      </p>

                      <div className="cn-request-footer">
                        <span className="cn-request-meta">
                          Nhận {createdAtText}
                        </span>
                        <span className="cn-request-status-pill cn-request-status-pending">
                          Đang chờ bạn xác nhận
                        </span>
                      </div>

                      <div className="cn-request-actions">
                        <button
                          type="button"
                          className="cn-btn-success"
                          onClick={() =>
                            openConfirm("accept_duo", req, nickname)
                          }
                        >
                          Xác nhận lời mời kết nối
                        </button>
                        <button
                          type="button"
                          className="cn-btn-cancel"
                          onClick={() =>
                            openConfirm("reject_duo", req, nickname)
                          }
                        >
                          Từ chối lời mời kết nối
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== Box 2: Bạn đã gửi lời mời kết nối 1:1 ===== */}
      {!loading && !errorMsg && outgoingUserRequests.length > 0 && (
        <div className="cn-myconnections-card">
          <div className="cn-requests-section">
            <h3 className="cn-requests-title">
              Bạn đã gửi lời mời kết nối 1:1
            </h3>
            <p className="cn-requests-desc">
              Đây là các lời mời 1:1 mà bạn đã gửi cho người khác. Bạn chỉ có
              thể <strong>hủy lời mời</strong>, không thể tự duyệt.
            </p>

            <div className="cn-requests-list">
              {outgoingUserRequests.map((req) => {
                const toUser = req.toUser || {};
                const profile = toUser.profile || {};
                const nickname =
                  profile.nickname ||
                  toUser.username ||
                  "Người dùng FitMatch";
                const avatarUrl = profile.avatarUrl || null;
                const createdAtText = formatViDateTime(req.createdAt);
                const goalLabel =
                  req.meta?.fromGoalLabel || "Chưa cập nhật";
                const note =
                  req.message ||
                  "Bạn đã gửi lời mời kết nối 1:1, đang chờ phản hồi.";

                return (
                  <article key={req._id} className="cn-request-row">
                    {avatarUrl && (
                      <div className="cn-request-thumb">
                        <img src={avatarUrl} alt={nickname} />
                      </div>
                    )}

                    <div className="cn-request-main-col">
                      <div className="cn-request-type">Lời mời bạn gửi đi</div>
                      <h4 className="cn-request-title">
                        Gửi lời mời kết nối với người dùng{" "}
                        <strong>{nickname}</strong>
                      </h4>
                      <p className="cn-request-main">{note}</p>
                      {goalLabel && (
                        <p className="cn-request-meta">
                          Mục tiêu của bạn tập: {goalLabel}
                        </p>
                      )}

                      <div className="cn-request-footer">
                        <span className="cn-request-meta">
                          Gửi {createdAtText}
                        </span>
                        <span className="cn-request-status-pill cn-request-status-pending">
                          Đang chờ người dùng đồng ý
                        </span>
                      </div>

                      <div className="cn-request-actions">
                        <button
                          type="button"
                          className="cn-btn-cancel"
                          onClick={() =>
                            openConfirm("cancel_duo", req, nickname)
                          }
                        >
                          Hủy lời mời kết nối
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== Box 3: Bạn đã gửi lời mời tham gia nhóm ===== */}
      {!loading && !errorMsg && outgoingGroupRequests.length > 0 && (
        <div className="cn-myconnections-card">
          <div className="cn-requests-section">
            <h3 className="cn-requests-title">
              Bạn đã gửi lời mời tham gia nhóm
            </h3>
            <p className="cn-requests-desc">
              Đây là các lời mời tham gia phòng kết nối nhóm. Bạn chỉ có thể{" "}
              <strong>hủy lời mời</strong>. Khi quản lý nhóm duyệt, bạn sẽ được
              đưa vào phòng Kết nối nhóm.
            </p>

            <div className="cn-requests-list">
              {outgoingGroupRequests.map((req) => {
                const room = req.toRoom || {};
                const groupName = room.name || "Nhóm tập luyện";
                const imageUrl = room.coverImageUrl || null;
                const membersCount = room.members?.length || 0;
                const schedule =
                  room.scheduleText || "Lịch tập chưa cập nhật";
                const createdAtText = formatViDateTime(req.createdAt);
                const note =
                  req.message ||
                  "Bạn đã gửi lời mời tham gia nhóm, đang chờ quản lý nhóm duyệt.";

                return (
                  <article key={req._id} className="cn-request-row">
                    {imageUrl && (
                      <div className="cn-request-thumb">
                        <img src={imageUrl} alt={groupName} />
                      </div>
                    )}

                    <div className="cn-request-main-col">
                      <div className="cn-request-type">Lời mời bạn gửi đi</div>
                      <h4 className="cn-request-title">
                        Gửi lời mời kết nối với Nhóm{" "}
                        <strong>{groupName}</strong>
                      </h4>
                      <p className="cn-request-main">{note}</p>
                      <p className="cn-request-meta">
                        Thành viên hiện tại: {membersCount} · {schedule}
                      </p>

                      <div className="cn-request-footer">
                        <span className="cn-request-meta">
                          Gửi {createdAtText}
                        </span>
                        <span className="cn-request-status-pill cn-request-status-pending">
                          Đang chờ quản lý nhóm
                        </span>
                      </div>

                      <div className="cn-request-actions">
                        <button
                          type="button"
                          className="cn-btn-cancel"
                          onClick={() =>
                            openConfirm("cancel_group", req, groupName)
                          }
                        >
                          Hủy lời mời tham gia nhóm
                        </button>
                        <button
                          type="button"
                          className="cn-btn-ghost"
                          onClick={handleOpenTeamConnectDemo}
                        >
                          Xem giao diện Kết nối nhóm
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal xác nhận – dùng chung với TabNearby */}
      <ConnectRequestConfirmModal
        open={confirmState.open}
        mode={confirmState.mode}
        targetName={confirmState.targetName}
        onClose={closeConfirm}
        onConfirm={handleConfirm}
        loading={confirmLoading}
      />
    </section>
  );
}

/* ===== Helper format thời gian ===== */
function formatViDateTime(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}
