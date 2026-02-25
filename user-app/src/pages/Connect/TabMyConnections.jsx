import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getMyRequests,
  acceptMatchRequest,
  rejectMatchRequest,
  cancelMatchRequest,
  getMatchStatus,
} from "../../api/match";
import { toast } from "react-toastify";
import ConnectRequestConfirmModal from "./ConnectRequestConfirmModal";
import DuoConnect from "./DuoConnect";
import TeamConnect from "./TeamConnect";
import api from "../../lib/api";
import UserSideModal from "../UserProfile/UserSideModal";
import PremiumGateModal from "../../components/PremiumGateModal/PremiumGateModal";
import {
  PREMIUM_UPGRADE_PATH,
  isPremiumGateError,
  extractGateMessage,
  extractApiMessage,
} from "../../utils/premiumGate";


const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/,"");
const toAbs = (u) => { if(!u) return u; try{ return new URL(u,API_ORIGIN).toString() }catch{ return u } };
const normType = (t) => {
  if(!t) return null;
  const s = String(t).toLowerCase();
  if (s === "duo" || s === "one_to_one" || s === "one-to-one" || s === "1:1") return "duo";
  if (s === "group" || s === "team") return "group";
  return s;
};
const DEFAULT_AVATAR="/images/avatar.png";

const norm=(v)=>(v||"").toString().trim().toLowerCase();
const calcAge=(dob)=>{
  if(!dob) return null;
  const d=new Date(dob);
  if(Number.isNaN(d.getTime())) return null;
  const now=new Date();
  let a=now.getFullYear()-d.getFullYear();
  const m=now.getMonth()-d.getMonth();
  if(m<0||(m===0&&now.getDate()<d.getDate())) a--;
  return a>=0&&a<=120?a:null;
};
const genderKey=(g)=>{
  const v=norm(g);
  if(!v) return null;
  if(["male","nam","m","man","men"].includes(v)) return "male";
  if(["female","nu","nữ","f","woman","women"].includes(v)) return "female";
  return "other";
};
const addrLabel=(addr)=>{
  const a=addr||{};
  const parts=[a.ward,a.district,a.city].map(s=>(s||"").toString().trim()).filter(Boolean);
  return parts.join(" - ");
};

const userToCard=(u)=>{
  const p=u?.profile||{};
  const id=String(u?._id||u?.id||"");
  const nickname=p.nickname||u?.username||u?.email||"Người dùng FitMatch";
  const avatarAbs = p.avatarUrl ? toAbs(p.avatarUrl) : (u?.avatarUrl ? toAbs(u.avatarUrl) : null);

  const bio=(u?.connectBio||p.bio||p.intro||p.about||u?.bio||"").toString().trim();

  const dob=p.birthDate||p.dob||p.ngaySinh||p.birthday||u?.dob||u?.birthDate||null;
  const age=calcAge(dob);

  const gender=genderKey(p.gender??p.gioiTinh??p.sex??u?.gender??u?.sex);
  const locationLabel=(u?.connectLocationLabel||p.locationLabel||addrLabel(p.address||u?.address)||"").toString().trim();
  const goal=(u?.connectGoalLabel||p.goalLabel||p.goal||u?.goal||"").toString().trim();

  const trainingTypes=Array.isArray(p.trainingTypes)?p.trainingTypes:(Array.isArray(u?.trainingTypes)?u.trainingTypes:[]);
  const intensityLabel=(u?.connectIntensityLabel||p.intensityLabel||u?.intensityLabel||"").toString().trim();

  return { id, nickname, imageUrl: avatarAbs||"", bio, age, gender, locationLabel, goal, trainingTypes, intensityLabel, isGroup:false };
};

const pickUserPayload=(res)=>{
  const payload=res?.data ?? res;
  return payload?.user ?? payload?.data?.user ?? payload?.data ?? payload ?? null;
};

const mergeReqMetaToCard=(card, meta, side)=>{
  if(!card || !meta) return card;
  const pre=side==="to"?"to":"from";
  const g=(...keys)=>{for(const k of keys){const v=meta?.[k]; if(v!=null && String(v).trim()!=="") return v;} return null;};

  const goalLabel=g(`${pre}GoalLabel`,`fromGoalLabel`,`toGoalLabel`,"goalLabel");
  const locationLabel=g(`${pre}LocationLabel`,`fromLocationLabel`,`toLocationLabel`,"locationLabel");
  const bio=g(`${pre}Bio`,`fromBio`,`toBio`,"bio");
  const intensityLabel=g(`${pre}IntensityLabel`,`fromIntensityLabel`,`toIntensityLabel`,"intensityLabel");
  const types=g(`${pre}TrainingTypes`,`fromTrainingTypes`,`toTrainingTypes`,"trainingTypes");

  return {
    ...card,
    goal: (card.goal||goalLabel||"").toString().trim(),
    locationLabel: (card.locationLabel||locationLabel||"").toString().trim(),
    bio: (card.bio||bio||"").toString().trim(),
    intensityLabel: (card.intensityLabel||intensityLabel||"").toString().trim(),
    trainingTypes: Array.isArray(card.trainingTypes)&&card.trainingTypes.length
      ? card.trainingTypes
      : (Array.isArray(types)?types:card.trainingTypes||[]),
  };
};

const cardLooksEmpty=(c)=>{
  if(!c) return true;
  const hasText = (s)=>!!String(s||"").trim();
  return !hasText(c.bio) && !hasText(c.locationLabel) && !hasText(c.goal) && !hasText(c.intensityLabel)
    && !(Array.isArray(c.trainingTypes)&&c.trainingTypes.length) && !c.age && !c.gender;
};

export default function TabMyConnections({
  currentUser,
  activeRoomId,
  activeRoomType,
  onEnteredRoom,
  onLeftRoom,
  navIntent,
  onConsumeNavIntent,
}) {
  const nav = useNavigate();
  const loc = useLocation();

  const meId = useMemo(
    ()=>String(currentUser?._id||currentUser?.id||currentUser?.user?._id||currentUser?.user?.id||""),
    [currentUser]
  );

  const [pg, setPg] = useState({ open: false, title: "", message: "" });
  const openGate = (message, title = "Cần nâng cấp Premium") =>
    setPg({ open: true, title, message: String(message || "").trim() });
  const closeGate = () => setPg((p) => ({ ...p, open: false }));
  const goUpgrade = () => {
    closeGate();
    nav(PREMIUM_UPGRADE_PATH);
  };

  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [confirmState, setConfirmState] = useState({ open: false, mode: null, requestId: null, targetName: "" });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [userModalOpen,setUserModalOpen]=useState(false);
  const [userModalTarget,setUserModalTarget]=useState(null);
  const [userFetching,setUserFetching]=useState(false);

  const requestsAnchorRef = useRef(null);
  const [focusReqId, setFocusReqId] = useState(null);
  const [flashReqId, setFlashReqId] = useState(null);

  // --- NEW STATES FOR STATUS & VIEWS ---
  const [ms, setMs] = useState(null);
  const [msLoading, setMsLoading] = useState(true);
  const [roomView, setRoomView] = useState(null); // "duo" | "group"
  const [plusOpen, setPlusOpen] = useState(false);

  const unwrap = (r) => {
    const p = r?.data ?? r;
    return p?.data ?? p;
  };

  async function loadStatus() {
    try {
      setMsLoading(true);
      const r = await getMatchStatus();
      const s = unwrap(r) || {};
      setMs(s);

      setRoomView((cur) => {
        if (cur === "duo" && s?.duoRoomId) return "duo";
        if (cur === "group" && s?.groupRoomId) return "group";
        if (s?.duoRoomId) return "duo";
        if (s?.groupRoomId) return "group";
        return null;
      });
    } finally {
      setMsLoading(false);
    }
  }

  useEffect(() => { loadStatus(); }, []);

  useEffect(()=>{
    const qs = new URLSearchParams(loc?.search || "");
    const qTab = (qs.get("tab") || "").toLowerCase();
    const qReq = qs.get("requestId") || qs.get("request") || null;

    if(qReq) {
      setFocusReqId(String(qReq));
      return;
    }
    if(qTab.includes("request")) {
      setFocusReqId(null);
    }
  },[loc?.search]);

  useEffect(()=>{
    if(!navIntent) return;
    if(navIntent?.requestId){
      setFocusReqId(String(navIntent.requestId));
    } else if (navIntent?.tab === "requests") {
      setFocusReqId(null);
    }
    onConsumeNavIntent?.();
  }, [navIntent, onConsumeNavIntent]);

  const openUserModal=async(rawUser, req=null, side="from")=>{
    const uid=String(rawUser?._id||rawUser?.id||"");
    if(!uid) return;
    if(meId && uid===String(meId)) return;

    let card=userToCard(rawUser);
    card=mergeReqMetaToCard(card, req?.meta, side);

    setUserModalTarget(card);
    setUserModalOpen(true);
    if(!cardLooksEmpty(card)) return;

    try{
      setUserFetching(true);
      let res=null;
      try{ res=await api.get(`/user/${uid}`); }
      catch{
        try{ res=await api.get(`/users/${uid}`); }
        catch{ res=await api.get(`/user/public/${uid}`); }
      }

      const full=pickUserPayload(res);
      if(!full) return;

      let fullCard=userToCard(full);
      fullCard=mergeReqMetaToCard(fullCard, req?.meta, side);

      setUserModalTarget(fullCard);
    }catch(e){
      console.error("openUserModal fetch full user error:", e);
    }finally{
      setUserFetching(false);
    }
  };

  const closeUserModal=()=>setUserModalOpen(false);
  const handleViewPublicProfile=(uid)=>{ setUserModalOpen(false); toast.info("Tính năng xem hồ sơ public của người dùng đang phát triển."); };
  const handleStartChat=(uid)=>{ setUserModalOpen(false); toast.info("Chức năng nhắn tin riêng đang phát triển."); };

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
      if (isPremiumGateError(e)) {
        openGate(extractGateMessage(e, "Bạn cần nâng cấp Premium để xem danh sách yêu cầu kết nối."));
        setIncoming([]);
        setOutgoing([]);
        return;
      }
      const msg = extractApiMessage(e, "Không thể tải danh sách lời mời.");
      setErrorMsg(msg);
      setIncoming([]);
      setOutgoing([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const handleLeftRoomInternal = () => { onLeftRoom && onLeftRoom(); load(); loadStatus(); };

  useEffect(()=>{
    if(loading) return;
    if(errorMsg) return;

    if(focusReqId){
      const el = document.getElementById(`req-${focusReqId}`);
      if(el){
        el.scrollIntoView({ behavior:"smooth", block:"center" });
        setFlashReqId(String(focusReqId));
        const t = setTimeout(()=>setFlashReqId(null), 4500);
        return ()=>clearTimeout(t);
      }
    }

    const qs = new URLSearchParams(loc?.search || "");
    const qTab = (qs.get("tab") || "").toLowerCase();
    const wantsRequests = (navIntent?.tab === "requests") || qTab.includes("request");
    if(wantsRequests && requestsAnchorRef.current){
      requestsAnchorRef.current.scrollIntoView({ behavior:"smooth", block:"start" });
    }
  }, [loading, errorMsg, focusReqId, incoming, outgoing, loc?.search]); // eslint-disable-line

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
      if (isPremiumGateError(e)) {
        openGate(extractGateMessage(e, "Tính năng này yêu cầu nâng cấp Premium để tiếp tục."));
        return;
      }
      toast.error(extractApiMessage(e, "Không thể thực hiện thao tác. Vui lòng thử lại."));
    } finally {
      setConfirmLoading(false);
    }
  }

  const incomingRequests = incoming.filter((r) => normType(r.type) === "duo");
  const outgoingUserRequests = outgoing.filter((r) => normType(r.type) === "duo");
  const outgoingGroupRequests = outgoing.filter((r) => normType(r.type) === "group");
  const hasRequests = incomingRequests.length + outgoingUserRequests.length + outgoingGroupRequests.length > 0;

  const handleOpenPlus = () => {
    if (!ms?.isPremium) {
      openGate("Tài khoản miễn phí chỉ được kết nối 1 người hoặc 1 nhóm. Nâng cấp Premium để kết nối cả hai.");
      return;
    }
    setPlusOpen(true);
    load(); // load request list để hiện trong modal
  };

  const highlightStyle = (id) => {
    if(!id) return null;
    return (flashReqId && String(flashReqId) === String(id))
      ? { outline: "2px solid rgba(69,195,154,0.75)", outlineOffset: 4, borderRadius: 14 }
      : null;
  };

  const hasAnyRoom = !!(ms?.duoRoomId || ms?.groupRoomId);

  // --- RENDERING LOGIC ---
  if (msLoading) {
    return <section className="cn-myconnections"><div className="cn-empty"><p>Đang tải...</p></div></section>;
  }

  if (hasAnyRoom) {
    return (
      <section className="cn-myconnections">
        {roomView === "duo" && ms?.duoRoomId && (
          <DuoConnect
            onLeftRoom={() => { onLeftRoom?.(); loadStatus(); load(); }}
            onSwitchRoomType={(t) => setRoomView(t)}
            onOpenSecondSlot={handleOpenPlus}
          />
        )}

        {roomView === "group" && ms?.groupRoomId && (
          <TeamConnect
            onLeftRoom={() => { onLeftRoom?.(); loadStatus(); load(); }}
            onSwitchRoomType={(t) => setRoomView(t)}
            onOpenSecondSlot={handleOpenPlus}
          />
        )}

        {plusOpen && (
          <div className="cn-modal-backdrop" onClick={() => setPlusOpen(false)}>
            <div className="cn-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="cn-modal-title">Thêm kết nối</h3>

              <div className="cn-plus-body">
                {roomView === "duo" && (
                  <>
                    <p className="cn-modal-text">Danh sách yêu cầu kết nối nhóm bạn đã gửi.</p>

                    {outgoingGroupRequests.length ? (
                      <div className="cn-plus-list">
                        {outgoingGroupRequests.map((req) => {
                          const room = req.toRoom || {};
                          const groupName = room.name || "Nhóm tập luyện";
                          const imageUrl = toAbs(room.coverImageUrl || room.imageUrl || null);
                          const thumbSrc = String(imageUrl || "").trim();

                          return (
                            <article key={req._id} className="cn-plus-item">
                              <div className="cn-plus-avatar is-square">
                                {thumbSrc ? (
                                  <img
                                    src={thumbSrc}
                                    alt={groupName}
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = DEFAULT_AVATAR;
                                    }}
                                  />
                                ) : (
                                  <span>{String(groupName).slice(0, 1)}</span>
                                )}
                              </div>

                              <div className="cn-plus-meta">
                                <div className="cn-plus-name">{groupName}</div>
                                <div className="cn-plus-sub">Đang chờ chủ nhóm duyệt</div>
                              </div>

                              <div className="cn-plus-actions">
                                <button
                                  type="button"
                                  className="cn-plus-btn danger"
                                  onClick={() => openConfirm("cancel_group", req, groupName)}
                                >
                                  Hủy yêu cầu
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="cn-myconnections-placeholder">Bạn chưa gửi yêu cầu tham gia nhóm nào.</p>
                    )}
                  </>
                )}

                {roomView === "group" && (
                  <>
                    <p className="cn-modal-text">Các lời mời ghép đôi 1:1 đang chờ xử lý.</p>

                    {incomingRequests.length ? (
                      <>
                        <div className="cn-plus-section-title">Lời mời đến</div>
                        <div className="cn-plus-list">
                          {incomingRequests.map((req) => {
                            const fromUser = req.fromUser || {};
                            const profile = fromUser.profile || {};
                            const nickname = profile.nickname || fromUser.username || "Người dùng FitMatch";
                            const avatarAbs = profile.avatarUrl ? toAbs(profile.avatarUrl) : null;
                            const thumbSrc = String(avatarAbs || "").trim() || DEFAULT_AVATAR;

                            return (
                              <article key={req._id} className="cn-plus-item">
                                <div
                                  className="cn-plus-avatar"
                                  onClick={() => openUserModal(fromUser, req, "from")}
                                  style={{ cursor: "pointer" }}
                                >
                                  <img
                                    src={thumbSrc}
                                    alt={nickname}
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = DEFAULT_AVATAR;
                                    }}
                                  />
                                </div>

                                <div className="cn-plus-meta">
                                  <div className="cn-plus-name">{nickname}</div>
                                  <div className="cn-plus-sub">Muốn kết nối 1:1 với bạn</div>
                                </div>

                                <div className="cn-plus-actions">
                                  <button
                                    type="button"
                                    className="cn-plus-btn success"
                                    onClick={() => openConfirm("accept_duo", req, nickname)}
                                  >
                                    Xác nhận
                                  </button>
                                  <button
                                    type="button"
                                    className="cn-plus-btn neutral"
                                    onClick={() => openConfirm("reject_duo", req, nickname)}
                                  >
                                    Từ chối
                                  </button>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </>
                    ) : null}

                    {outgoingUserRequests.length ? (
                      <>
                        <div className="cn-plus-section-title" style={{ marginTop: 10 }}>
                          Bạn đã gửi
                        </div>
                        <div className="cn-plus-list">
                          {outgoingUserRequests.map((req) => {
                            const toUser = req.toUser || {};
                            const profile = toUser.profile || {};
                            const nickname = profile.nickname || toUser.username || "Người dùng FitMatch";
                            const avatarAbs = profile.avatarUrl ? toAbs(profile.avatarUrl) : null;
                            const thumbSrc = String(avatarAbs || "").trim() || DEFAULT_AVATAR;

                            return (
                              <article key={req._id} className="cn-plus-item">
                                <div
                                  className="cn-plus-avatar"
                                  onClick={() => openUserModal(toUser, req, "to")}
                                  style={{ cursor: "pointer" }}
                                >
                                  <img
                                    src={thumbSrc}
                                    alt={nickname}
                                    onError={(e) => {
                                      e.currentTarget.onerror = null;
                                      e.currentTarget.src = DEFAULT_AVATAR;
                                    }}
                                  />
                                </div>

                                <div className="cn-plus-meta">
                                  <div className="cn-plus-name">{nickname}</div>
                                  <div className="cn-plus-sub">Bạn đã gửi lời mời 1:1</div>
                                </div>

                                <div className="cn-plus-actions">
                                  <button
                                    type="button"
                                    className="cn-plus-btn danger"
                                    onClick={() => openConfirm("cancel_duo", req, nickname)}
                                  >
                                    Hủy lời mời
                                  </button>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </>
                    ) : null}

                    {!incomingRequests.length && !outgoingUserRequests.length && (
                      <p className="cn-myconnections-placeholder">Hiện chưa có lời mời 1:1 nào.</p>
                    )}
                  </>
                )}
              </div>

              <div className="cn-modal-actions">
                <button type="button" className="cn-modal-btn ghost" onClick={() => setPlusOpen(false)}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}

        <ConnectRequestConfirmModal
          open={confirmState.open}
          mode={confirmState.mode}
          targetName={confirmState.targetName}
          onClose={closeConfirm}
          onConfirm={async () => {
            await handleConfirm();
            await loadStatus();
            await load();
            if (confirmState.mode === "accept_duo") setRoomView("duo");
          }}
          loading={confirmLoading}
        />

        <PremiumGateModal
          open={pg.open}
          title={pg.title}
          message={pg.message}
          onClose={closeGate}
          onUpgrade={goUpgrade}
        />
      </section>
    );
  }

  // --- RENDER FALLBACK: NO ROOMS (Hiển thị danh sách requests) ---
  return (
    <section className="cn-myconnections">
      <header className="cn-main-header">
        <h1>Các yêu cầu của bạn</h1>
        <p>Tìm kiếm những người có cùng mục tiêu và lịch tập, tạo nhóm tối đa 5 người để cùng nhau hoàn thành mục tiêu.</p>
      </header>

      <div ref={requestsAnchorRef} />

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
                  <article
                    key={req._id}
                    id={`req-${req._id}`}
                    className="cn-request-row"
                    style={highlightStyle(req._id)}
                  >
                    <div className="cn-request-thumb" onClick={()=>openUserModal(fromUser, req, "from")} style={{cursor:"pointer"}}>
                      <img src={thumbSrc} alt={nickname} onError={(e)=>{e.currentTarget.onerror=null;e.currentTarget.src=DEFAULT_AVATAR;}} />
                    </div>

                    <div className="cn-request-main-col">
                      <div className="cn-request-type">Lời mời đến</div>
                      <h4 className="cn-request-title">
                        <button type="button" className="cn-name-link" onClick={()=>openUserModal(fromUser, req, "from")} style={{padding:0,background:"transparent",border:0,cursor:"pointer"}}>
                          <strong>{nickname}</strong>
                        </button>{" "}
                        muốn kết nối 1:1 với bạn
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
                  <article
                    key={req._id}
                    id={`req-${req._id}`}
                    className="cn-request-row"
                    style={highlightStyle(req._id)}
                  >
                    <div className="cn-request-thumb" onClick={()=>openUserModal(toUser, req, "to")} style={{cursor:"pointer"}}>
                      <img src={thumbSrc} alt={nickname} onError={(e)=>{e.currentTarget.onerror=null;e.currentTarget.src=DEFAULT_AVATAR;}} />
                    </div>

                    <div className="cn-request-main-col">
                      <div className="cn-request-type">Lời mời bạn gửi đi</div>
                      <h4 className="cn-request-title">
                        Gửi lời mời kết nối với người dùng{" "}
                        <button type="button" className="cn-name-link" onClick={()=>openUserModal(toUser, req, "to")} style={{padding:0,background:"transparent",border:0,cursor:"pointer"}}>
                          <strong>{nickname}</strong>
                        </button>
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
                  <article
                    key={req._id}
                    id={`req-${req._id}`}
                    className="cn-request-row"
                    style={highlightStyle(req._id)}
                  >
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

      <ConnectRequestConfirmModal
        open={confirmState.open}
        mode={confirmState.mode}
        targetName={confirmState.targetName}
        onClose={closeConfirm}
        onConfirm={async () => {
          await handleConfirm();
          await loadStatus();
          await load();
          if (confirmState.mode === "accept_duo") setRoomView("duo");
        }}
        loading={confirmLoading}
      />

      <UserSideModal
        open={userModalOpen}
        user={userModalTarget}
        meId={meId}
        onClose={closeUserModal}
        onViewProfile={handleViewPublicProfile}
        onStartChat={handleStartChat}
      />

      <PremiumGateModal
        open={pg.open}
        title={pg.title}
        message={pg.message}
        onClose={closeGate}
        onUpgrade={goUpgrade}
      />
    </section>
  );
}

function formatViDateTime(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("vi-VN", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false
    });
  } catch { return "—"; }
}