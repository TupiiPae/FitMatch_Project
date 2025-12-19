import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMyRequests, acceptMatchRequest, rejectMatchRequest, cancelMatchRequest } from "../../api/match";
import { toast } from "react-toastify";
import ConnectRequestConfirmModal from "./ConnectRequestConfirmModal";
import DuoConnect from "./DuoConnect";
import TeamConnect from "./TeamConnect";
import api from "../../lib/api";
import UserSideModal from "../UserProfile/UserSideModal";

const API_ORIGIN=(api?.defaults?.baseURL||"").replace(/\/+$/,"");
const toAbs=(u)=>{if(!u)return u;try{return new URL(u,API_ORIGIN).toString()}catch{return u}};
const normType=(t)=>{if(!t)return null;const s=String(t).toLowerCase();if(s==="duo"||s==="one_to_one"||s==="one-to-one"||s==="1:1")return"duo";if(s==="group"||s==="team")return"group";return s;};
const DEFAULT_AVATAR="/images/avatar.png";

export default function TabMyConnections({ currentUser, activeRoomId, activeRoomType, onEnteredRoom, onLeftRoom }) {
  const nav = useNavigate();
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [confirmState, setConfirmState] = useState({ open: false, mode: null, requestId: null, targetName: "" });
  const [confirmLoading, setConfirmLoading] = useState(false);

  // ===== USER SIDE MODAL (NEW) =====
  const [userModal,setUserModal]=useState({ open:false, user:null });
  const closeUserModal=()=>setUserModal({ open:false, user:null });
  const openUserModal=(u)=>{
    if(!u) return;
    const tid=String(u?._id||u?.id||"");
    const my=String(currentUser?._id||currentUser?.id||"");
    if(tid && my && tid===my) return;
    setUserModal({ open:true, user:u });
  };

  const openConfirm = (mode, req, targetName) => {
    const id = req?._id || req?.id;
    if (!id) return;
    setConfirmState({ open: true, mode, requestId: id, targetName: targetName || "" });
  };
  const closeConfirm = () => setConfirmState((p) => ({ ...p, open: false }));

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
      const msg = e?.response?.data?.message || e?.response?.data?.error || "Không thể tải danh sách lời mời.";
      setErrorMsg(msg);
      setIncoming([]);
      setOutgoing([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const handleLeftRoomInternal = () => { onLeftRoom && onLeftRoom(); load(); };

  async function handleConfirm() {
    const { mode, requestId } = confirmState;
    if (!mode || !requestId) return;

    try {
      setConfirmLoading(true);

      if (mode === "accept_duo") {
        const res = await acceptMatchRequest(requestId);
        const payload = res?.data ?? res;
        const roomId = payload?.roomId || payload?.data?.roomId || payload?.room?._id || payload?.room?.id || null;
        const roomType = normType(payload?.roomType || payload?.data?.roomType || payload?.type || "duo") || "duo";
        toast.success("Đã xác nhận lời mời kết nối.");
        if (onEnteredRoom && roomId) onEnteredRoom(roomId, roomType);
        closeConfirm();
        return;
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
      const msg = e?.response?.data?.message || e?.response?.data?.error || "Không thể thực hiện thao tác. Vui lòng thử lại.";
      toast.error(msg);
    } finally {
      setConfirmLoading(false);
    }
  }

  const incomingRequests = incoming.filter((r) => normType(r.type) === "duo");
  const outgoingUserRequests = outgoing.filter((r) => normType(r.type) === "duo");
  const outgoingGroupRequests = outgoing.filter((r) => normType(r.type) === "group");
  const hasRequests = incomingRequests.length + outgoingUserRequests.length + outgoingGroupRequests.length > 0;

  const roomTypeNorm = normType(activeRoomType);
  const isInDuoRoom = !!activeRoomId && roomTypeNorm === "duo";
  if (isInDuoRoom) return <section className="cn-myconnections"><DuoConnect onLeftRoom={handleLeftRoomInternal} /></section>;

  const isInGroupRoom = !!activeRoomId && roomTypeNorm === "group";
  if (isInGroupRoom) return <section className="cn-myconnections"><TeamConnect onLeftRoom={handleLeftRoomInternal} /></section>;

  return (
    <section className="cn-myconnections">
      <header className="cn-main-header">
        <h1>Các yêu cầu của bạn</h1>
        <p>Tìm kiếm những người có cùng mục tiêu và lịch tập, tạo nhóm tối đa 5 người để cùng nhau hoàn thành mục tiêu.</p>
      </header>

      {loading && <div className="cn-empty" style={{ marginTop: 6 }}><p>Đang tải danh sách lời mời...</p></div>}
      {errorMsg && !loading && <div className="cn-error" style={{ marginTop: 6 }}><p>{errorMsg}</p></div>}

      {!loading && !errorMsg && !hasRequests && (
        <p className="cn-myconnections-placeholder">
          Hiện bạn chưa có bất kỳ lời mời kết nối nào. Hãy dùng tab <strong>Tìm kiếm xung quanh</strong> để gửi lời mời hoặc tham gia nhóm mới.
        </p>
      )}

      {!loading && !errorMsg && incomingRequests.length > 0 && (
        <div className="cn-myconnections-card">
          <div className="cn-requests-section">
            <h3 className="cn-requests-title">Có người dùng gửi lời mời kết nối</h3>
            <p className="cn-requests-desc">Khi bạn nhấp <strong>Xác nhận lời mời kết nối</strong>, hệ thống sẽ tạo phòng kết nối 1:1 giữa bạn và người dùng đó.</p>

            <div className="cn-requests-list">
              {incomingRequests.map((req) => {
                const fromUser = req.fromUser || {};
                const profile = fromUser.profile || {};
                const nickname = profile.nickname || fromUser.username || "Người dùng FitMatch";
                const avatarAbs = profile.avatarUrl ? toAbs(profile.avatarUrl) : null;
                const thumbSrc = (String(avatarAbs || "").trim() || DEFAULT_AVATAR);
                const createdAtText = formatViDateTime(req.createdAt);

                return (
                  <article key={req._id} className="cn-request-row">
                    <div className="cn-request-thumb">
                      <img
                        src={thumbSrc}
                        alt={nickname}
                        onClick={()=>openUserModal(fromUser)}
                        style={{cursor:"pointer"}}
                        onError={(e)=>{e.currentTarget.onerror=null;e.currentTarget.src=DEFAULT_AVATAR;}}
                      />
                    </div>
                    <div className="cn-request-main-col">
                      <div className="cn-request-type">Lời mời đến</div>
                      <h4 className="cn-request-title">
                        <strong style={{cursor:"pointer"}} onClick={()=>openUserModal(fromUser)}>{nickname}</strong> muốn kết nối 1:1 với bạn
                      </h4>
                      <div className="cn-request-footer">
                        <span className="cn-request-meta">Nhận {createdAtText}</span>
                        <span className="cn-request-status-pill cn-request-status-pending">Đang chờ bạn xác nhận</span>
                      </div>
                      <div className="cn-request-actions">
                        <button type="button" className="cn-btn-success" onClick={() => openConfirm("accept_duo", req, nickname)}>Xác nhận lời mời kết nối</button>
                        <button type="button" className="cn-btn-cancel" onClick={() => openConfirm("reject_duo", req, nickname)}>Từ chối lời mời kết nối</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!loading && !errorMsg && outgoingUserRequests.length > 0 && (
        <div className="cn-myconnections-card">
          <div className="cn-requests-section">
            <h3 className="cn-requests-title">Bạn đã gửi lời mời kết nối 1:1</h3>
            <p className="cn-requests-desc">Đây là các lời mời 1:1 mà bạn đã gửi cho người khác. Bạn chỉ có thể <strong>hủy lời mời</strong>, không thể tự duyệt.</p>

            <div className="cn-requests-list">
              {outgoingUserRequests.map((req) => {
                const toUser = req.toUser || {};
                const profile = toUser.profile || {};
                const nickname = profile.nickname || toUser.username || "Người dùng FitMatch";
                const avatarAbs = profile.avatarUrl ? toAbs(profile.avatarUrl) : null;
                const thumbSrc = (String(avatarAbs || "").trim() || DEFAULT_AVATAR);
                const createdAtText = formatViDateTime(req.createdAt);

                return (
                  <article key={req._id} className="cn-request-row">
                    <div className="cn-request-thumb">
                      <img
                        src={thumbSrc}
                        alt={nickname}
                        onClick={()=>openUserModal(toUser)}
                        style={{cursor:"pointer"}}
                        onError={(e)=>{e.currentTarget.onerror=null;e.currentTarget.src=DEFAULT_AVATAR;}}
                      />
                    </div>
                    <div className="cn-request-main-col">
                      <div className="cn-request-type">Lời mời bạn gửi đi</div>
                      <h4 className="cn-request-title">
                        Gửi lời mời kết nối với người dùng <strong style={{cursor:"pointer"}} onClick={()=>openUserModal(toUser)}>{nickname}</strong>
                      </h4>
                      <div className="cn-request-footer">
                        <span className="cn-request-meta">Gửi {createdAtText}</span>
                        <span className="cn-request-status-pill cn-request-status-pending">Đang chờ người dùng đồng ý</span>
                      </div>
                      <div className="cn-request-actions">
                        <button type="button" className="cn-btn-cancel" onClick={() => openConfirm("cancel_duo", req, nickname)}>Hủy lời mời kết nối</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!loading && !errorMsg && outgoingGroupRequests.length > 0 && (
        <div className="cn-myconnections-card">
          <div className="cn-requests-section">
            <h3 className="cn-requests-title">Bạn đã gửi lời mời tham gia nhóm</h3>

            <div className="cn-requests-list">
              {outgoingGroupRequests.map((req) => {
                const room = req.toRoom || {};
                const groupName = room.name || "Nhóm tập luyện";
                const imageUrl = toAbs(room.coverImageUrl || room.imageUrl || null);
                const createdAtText = formatViDateTime(req.createdAt);
                const note = req.message || "Bạn đã gửi lời mời tham gia nhóm, đang chờ quản lý nhóm duyệt.";
                return (
                  <article key={req._id} className="cn-request-row">
                    {imageUrl && <div className="cn-request-thumb"><img src={imageUrl} alt={groupName} /></div>}
                    <div className="cn-request-main-col">
                      <div className="cn-request-type">Lời mời bạn gửi đi</div>
                      <h4 className="cn-request-title">Gửi lời mời kết nối với Nhóm <strong>{groupName}</strong></h4>
                      <p className="cn-request-main">{note}</p>
                      <div className="cn-request-footer">
                        <span className="cn-request-meta">Gửi {createdAtText}</span>
                        <span className="cn-request-status-pill cn-request-status-pending">Đang chờ chủ nhóm duyệt</span>
                      </div>
                      <div className="cn-request-actions">
                        <button type="button" className="cn-btn-cancel" onClick={() => openConfirm("cancel_group", req, groupName)}>Hủy lời mời tham gia nhóm</button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <ConnectRequestConfirmModal open={confirmState.open} mode={confirmState.mode} targetName={confirmState.targetName} onClose={closeConfirm} onConfirm={handleConfirm} loading={confirmLoading} />

      <UserSideModal open={userModal.open} user={userModal.user} meId={currentUser?._id||currentUser?.id} onClose={closeUserModal} onViewProfile={()=>toast.info("Trang xem hồ sơ đang phát triển (button placeholder).")} onStartChat={()=>toast.info("Chức năng nhắn tin đang phát triển (button placeholder).")} />
    </section>
  );
}

function formatViDateTime(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  } catch { return "—"; }
}
