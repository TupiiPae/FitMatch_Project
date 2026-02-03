import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listNearby, createMatchRequest, getMyRequests, acceptMatchRequest, cancelMatchRequest, getMatchStatus, getRoomDetail, createConnectReport } from "../../api/match";
import { toast } from "react-toastify";
import ConnectRequestConfirmModal from "./ConnectRequestConfirmModal";
import ReportSideModal from "./ReportSideModal";
import UserSideModal from "../UserProfile/UserSideModal";

const AGE_RANGE_LABELS={all:"Tất cả","18-21":"18-21","22-27":"22-27","28-35":"28-35","36-45":"36-45","45+":"Trên 45"};
const GENDER_LABELS={all:"Tất cả",male:"Nam",female:"Nữ"};
const norm=(v)=>(v||"").toString().trim().toLowerCase();
const areaLabelFromKey=(k)=>k==="same_ward"?"Rất gần bạn":k==="same_district"?"Trong quận của bạn":k==="same_city"?"Cùng thành phố":k==="other"?"Ngoài khu vực":"";
const getAddrParts=(u)=>{const a=u?.profile?.address||{};return{country:norm(a.country),city:norm(a.city),district:norm(a.district),ward:norm(a.ward)};};
const LOC_RANGE_LABELS = {
  any: "Không giới hạn",
  same_city: "Cùng thành phố",
  same_district: "Trong quận",
  same_ward: "Rất gần",
};

const MODE_LABELS = {
  one_to_one: "1:1",
  group: "Nhóm",
};


function computeGroupArea(meAddr, groupLocationLabel){
  const gl=norm(groupLocationLabel);
  if(!meAddr?.city||!gl) return { areaKey:null, areaLabel:"" };
  const hasCity=meAddr.city && gl.includes(meAddr.city);
  if(!hasCity) return { areaKey:"other", areaLabel:areaLabelFromKey("other") };
  const hasDistrict=meAddr.district && gl.includes(meAddr.district);
  const hasWard=meAddr.ward && gl.includes(meAddr.ward);
  const key=hasWard?"same_ward":hasDistrict?"same_district":"same_city";
  return { areaKey:key, areaLabel:areaLabelFromKey(key) };
}
function passLocationRangeByKey(range, key){
  if(range==="any") return true;
  if(!key) return false;
  if(range==="same_city") return ["same_city","same_district","same_ward"].includes(key);
  if(range==="same_district") return ["same_district","same_ward"].includes(key);
  if(range==="same_ward") return key==="same_ward";
  return true;
}

function splitLocParts(label){return String(label||"").split(/[-,|/]+/).map(s=>s.trim()).filter(Boolean);}
function isDistrictPart(s){const t=norm(s);return /(^| )quận( |$)|(^| )huyện( |$)|(^| )thị xã( |$)|district/.test(t);}
function isWardPart(s){const t=norm(s);return /(^| )phường( |$)|(^| )xã( |$)|ward/.test(t);}
function shortDistrictCity(label){
  const raw=String(label||"").trim();
  if(!raw) return "";
  const parts=splitLocParts(raw);
  if(parts.length<=1) return raw;
  let di=-1;for(let i=parts.length-1;i>=0;i--){if(isDistrictPart(parts[i])){di=i;break;}}
  let cleaned=parts;
  if(cleaned.length>=2 && isWardPart(cleaned[cleaned.length-1])) cleaned=cleaned.slice(0,-1);
  if(di>=0){
    const district=parts[di];
    const city=parts[di-1] || cleaned[cleaned.length-1] || "";
    if(city && city!==district) return `${district} - ${city}`;
    return district;
  }
  const last=cleaned[cleaned.length-1], prev=cleaned[cleaned.length-2]||"";
  if(isDistrictPart(last) && prev) return `${last} - ${prev}`;
  if(isDistrictPart(prev) && last) return `${prev} - ${last}`;
  return prev ? `${last} - ${prev}` : last;
}

function roomToGroupCard(room){
  if(!room) return null;
  const rawId=room._id || room.id || "";
  const membersCount=Array.isArray(room.members)?room.members.length:0;
  return {
    id: rawId,
    nickname: room.name || "Nhóm tập luyện",
    isGroup: true,
    membersCount,
    gender: room.gender || "all",
    ageRange: room.ageRange || "all",
    trainingFrequency: room.trainingFrequency || "",
    frequency: room.trainingFrequency ? `${room.trainingFrequency} buổi/tuần` : "",
    joinPolicy: room.joinPolicy || "request",
    goal: room.goalLabel || "",
    goalKey: room.goalKey || null,
    trainingTypes: room.trainingTypes || [],
    locationLabel: room.locationLabel || "",
    bio: room.description || "",
    imageUrl: room.coverImageUrl || "",
    areaKey: null,
    areaLabel: "",
  };
}

// Helper lấy 6 ký tự cuối id để dùng làm mã nhóm
function getShortRoomCode(id){
  const raw=String(id||"").trim();
  if(!raw) return "";
  return raw.slice(-6);
}

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
  onOpenCreateTeam,
  onOpenFilters,
}) {
  const nav = useNavigate();

  const meId=useMemo(()=>String(currentUser?._id||currentUser?.id||currentUser?.user?._id||currentUser?.user?.id||""),[currentUser]);

  const [viewMode, setViewMode] = useState("grid");
  const [search, setSearch] = useState("");

  const [selfCard, setSelfCard] = useState(null);
  const [items, setItems] = useState([]);
  const [myGroupCard, setMyGroupCard] = useState(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [requestMaps, setRequestMaps] = useState({ incomingFromUser: {}, outgoingToUser: {}, outgoingToRoom: {} });

  const [confirmState, setConfirmState] = useState({ open: false, mode: null, target: null, requestId: null });
  const [confirmLoading, setConfirmLoading] = useState(false);
  const openConfirm=(mode,target,requestId)=>setConfirmState({ open:true, mode, target, requestId:requestId||null });
  const closeConfirm=()=>setConfirmState({ open:false, mode:null, target:null, requestId:null });

  // ===== REPORT STATE =====
  const [reportState,setReportState]=useState({ open:false, target:null });
  const [reportLoading,setReportLoading]=useState(false);
  const openReport=(target)=>setReportState({ open:true, target: target||null });
  const closeReport=()=>setReportState({ open:false, target:null });

  // ===== USER SIDE MODAL =====
  const [userModalOpen,setUserModalOpen]=useState(false);
  const [userModalTarget,setUserModalTarget]=useState(null);
  const openUserModal=(u)=>{
    if(!u || u.isGroup) return;
    const id=String(u?.id||u?._id||u?.userId||u?.uid||"");
    if(!id) return;
    if(meId && id===String(meId)) return; // tự bấm bản thân -> không mở
    setUserModalTarget(u);
    setUserModalOpen(true);
  };
  const closeUserModal=()=>setUserModalOpen(false);

  const handleViewPublicProfile=(uid)=>{
    setUserModalOpen(false);
    toast.info("Tính năng xem hồ sơ public của người dùng đang phát triển.");
  };
  const handleStartChat = (uid) => {
    setUserModalOpen(false);

    const id = String(uid || "").trim();
    if (!id) return;

    if (meId && id === String(meId)) {
      toast.info("Bạn không thể nhắn tin cho chính mình.");
      return;
    }

    nav(`/tin-nhan?u=${encodeURIComponent(id)}`);
  };


  async function handleSubmitReport(payload){
    const t=reportState.target;
    if(!t) return;
    const isGroup=!!t.isGroup;
    const tid=String(t?.id||t?._id||"");
    try{
      setReportLoading(true);
      const res=await createConnectReport({
        targetType: isGroup ? "group" : "user",
        targetUserId: isGroup ? undefined : tid,
        targetRoomId: isGroup ? tid : undefined,
        reasons: Array.isArray(payload?.reasons)?payload.reasons:[],
        otherReason: (payload?.otherReason||"").toString(),
        note: (payload?.note||"").toString(),
      });
      if(res?.duplicated) toast.info("Bạn đã báo cáo đối tượng này gần đây.");
      else toast.success("Đã gửi báo cáo. Cảm ơn bạn!");
      closeReport();
    }catch(e){
      console.error("createConnectReport error:",e);
      const msg=e?.response?.data?.message||e?.response?.data?.error||"Không thể gửi báo cáo. Vui lòng thử lại.";
      toast.error(msg);
    }finally{ setReportLoading(false); }
  }

  useEffect(() => {
    let cancelled=false;
    async function load(){
      try{
        setLoading(true); setErrorMsg("");
        const [nearby, reqs] = await Promise.all([
          listNearby(connectionMode),
          getMyRequests().catch((err)=>{ console.error("getMyRequests error:", err); return null; }),
        ]);
        if(cancelled) return;

        setSelfCard(nearby?.self || null);
        setItems(Array.isArray(nearby?.items) ? nearby.items : []);

        if(reqs){
          const incoming = Array.isArray(reqs.incoming) ? reqs.incoming : [];
          const outgoing = Array.isArray(reqs.outgoing) ? reqs.outgoing : [];

          const incomingFromUser={};
          incoming.forEach((r)=>{ if(r.type==="duo" && r.fromUser?._id) incomingFromUser[r.fromUser._id]=r._id; });

          const outgoingToUser={}, outgoingToRoom={};
          outgoing.forEach((r)=>{
            if(r.type==="duo" && r.toUser?._id) outgoingToUser[r.toUser._id]=r._id;
            else if(r.type==="group"){
              const rid=r.toRoom?._id || r.toRoom?.id || r.toRoom;
              if(rid) outgoingToRoom[String(rid)]=r._id;
            }
          });

          setRequestMaps({ incomingFromUser, outgoingToUser, outgoingToRoom });
        }else setRequestMaps({ incomingFromUser:{}, outgoingToUser:{}, outgoingToRoom:{} });
      }catch(e){
        if(cancelled) return;
        console.error("listNearby error:", e);
        const msg=e?.response?.data?.message||e?.response?.data?.error||"Không thể tải danh sách gợi ý xung quanh.";
        setErrorMsg(msg); setSelfCard(null); setItems([]);
      }finally{ if(!cancelled) setLoading(false); }
    }
    load();
    return ()=>{ cancelled=true; };
  }, [connectionMode, discoverable]);

  useEffect(()=>{
    let cancelled=false;
    async function loadMyGroup(){
      try{
        if(connectionMode!=="group"){ setMyGroupCard(null); return; }
        const st = await getMatchStatus().catch(()=>null);
        const rid = st?.activeRoomId, rtype = st?.activeRoomType;
        if(!rid || rtype!=="group"){ setMyGroupCard(null); return; }
        const room = await getRoomDetail(rid).catch(()=>null);
        if(cancelled) return;
        const card = roomToGroupCard(room);
        if(!card){ setMyGroupCard(null); return; }
        const meAddr=getAddrParts(currentUser);
        const area=computeGroupArea(meAddr, card.locationLabel);
        setMyGroupCard({ ...card, ...area });
      }catch(e){
        console.error("loadMyGroup error:", e);
        setMyGroupCard(null);
      }
    }
    loadMyGroup();
    return ()=>{ cancelled=true; };
  }, [connectionMode, currentUser]);

  const filteredList = useMemo(() => {
    const meAddr=getAddrParts(currentUser);
    let base = Array.isArray(items) ? items : [];

    // Tính lại areaKey/areaLabel cho nhóm dựa trên địa chỉ của currentUser
    base = base.map((x)=>{
      if(!x?.isGroup) return x;
      const area=computeGroupArea(meAddr, x.locationLabel);
      return { ...x, ...area };
    });

    // Loại nhóm mà user đang là thành viên (đã ghim riêng ở trên)
    const myId = myGroupCard?.id ? String(myGroupCard.id) : null;
    if(myId) base = base.filter((x)=>String(x?.id||x?._id||"")!==myId);

    const rawSearch=(search||"").trim();
    const searchText=rawSearch.toLowerCase();
    const isGroupIdSearch=/^\d{6}$/.test(rawSearch); // nhập đúng 6 số => ưu tiên search mã nhóm

    return base.filter((u) => {
      const isGroup=!!u.isGroup;
      const rawId=String(u.id || u._id || "");
      const shortCode=getShortRoomCode(rawId);

      // Lọc theo chế độ kết nối
      if(connectionMode==="one_to_one" && isGroup) return false;
      if(connectionMode==="group" && !isGroup) return false;

      // Nếu đang search mã nhóm 6 số: chỉ giữ nhóm có shortCode trùng, bỏ qua các filter khác
      if(isGroupIdSearch){
        if(!isGroup) return false;
        if(!shortCode || shortCode.toLowerCase()!==searchText) return false;
        return true;
      }

      // Lọc theo mục tiêu
      if(goalFilter){
        const userGoal=(u.goal||"").trim().toLowerCase();
        const myGoal=goalFilter.trim().toLowerCase();
        if(!userGoal || userGoal!==myGoal) return false;
      }

      // Lọc theo phạm vi vị trí
      if(locationRange!=="any"){
        if(!passLocationRangeByKey(locationRange, u.areaKey)) return false;
      }

      // Lọc theo độ tuổi
      if(ageRange!=="all"){
        if(isGroup){
          const gr = (u.ageRange||"all").toString();
          if(gr!=="all" && gr!==ageRange) return false;
        }else if(typeof u.age==="number"){
          const age=u.age;
          if(ageRange==="18-21" && !(age>=18 && age<=21)) return false;
          if(ageRange==="22-27" && !(age>=22 && age<=27)) return false;
          if(ageRange==="28-35" && !(age>=28 && age<=35)) return false;
          if(ageRange==="36-45" && !(age>=36 && age<=45)) return false;
          if(ageRange==="45+" && age<45) return false;
        }
      }

      // Lọc theo giới tính
      if(genderFilter!=="all"){
        if(isGroup){
          const gg=(u.gender||"all").toString();
          if(gg!=="all" && gg!==genderFilter) return false;
        }else if(u.gender && u.gender!==genderFilter) return false;
      }

      // Search text thường
      if(searchText){
        const haystack=[
          u.nickname||"",
          u.goal||"",
          (u.trainingTypes||[]).join(" "),
          u.locationLabel||"",
          u.bio||"",
          u.ageRange||"",
          u.gender||"",
          u.trainingFrequency||"",
          u.frequency||"",
          rawId,
          shortCode,
        ].join(" ").toLowerCase();
        if(!haystack.includes(searchText)) return false;
      }

      return true;
    });
  }, [items, myGroupCard, currentUser, connectionMode, locationRange, ageRange, genderFilter, search, goalFilter]);

  const resultCount = filteredList.length;

  const getInviteStateFor = (u) => {
    const uid = String(u?.id || u?._id || "");
    if(u.isGroup){
      const reqId = requestMaps.outgoingToRoom[uid];
      return reqId ? { type:"cancel_group", requestId:reqId } : { type:"send_group" };
    }else{
      const incomingId = requestMaps.incomingFromUser[uid];
      if(incomingId) return { type:"accept_duo", requestId:incomingId };
      const outgoingId = requestMaps.outgoingToUser[uid];
      if(outgoingId) return { type:"cancel_duo", requestId:outgoingId };
      return { type:"send_duo" };
    }
  };

  async function handleConfirm(){
    if(!confirmState.open || !confirmState.mode || !confirmState.target) return;
    const { mode, target, requestId } = confirmState;
    const tid = String(target?.id || target?._id || "");

    try{
      setConfirmLoading(true);

      if(mode==="send_duo"){
        if(!discoverable) toast.info("Hãy bật 'Cho phép mọi người tìm kiếm bạn' để kết nối dễ dàng hơn.");
        const res = await createMatchRequest({ type:"duo", targetUserId: tid });
        const reqDoc = res?.request || res?.data?.request || null;
        const newId = reqDoc?._id || reqDoc?.id;
        if(newId) setRequestMaps((p)=>({ ...p, outgoingToUser:{ ...p.outgoingToUser, [tid]: newId } }));
        toast.success("Đã gửi lời mời kết nối.");
      }

      else if(mode==="send_group"){
        if(!discoverable) toast.info("Hãy bật 'Cho phép mọi người tìm kiếm bạn' để kết nối dễ dàng hơn.");
        const res = await createMatchRequest({ type:"group", targetRoomId: tid });

        const roomId = res?.roomId || res?.data?.roomId || null;
        const joined = !!(res?.joined || res?.data?.joined);
        if(roomId && joined){
          toast.success("Đã tham gia nhóm.");
          closeConfirm();
          onCreatedRequest && onCreatedRequest();
          if(onEnteredRoom) onEnteredRoom(roomId, "group");
          return;
        }

        const reqDoc = res?.request || res?.data?.request || null;
        const newId = reqDoc?._id || reqDoc?.id;
        if(newId) setRequestMaps((p)=>({ ...p, outgoingToRoom:{ ...p.outgoingToRoom, [tid]: newId } }));
        toast.success("Đã gửi yêu cầu xin tham gia nhóm.");
      }

      else if(mode==="cancel_duo"){
        if(!requestId) return;
        await cancelMatchRequest(requestId);
        setRequestMaps((p)=>{ const m={...p.outgoingToUser}; delete m[tid]; return { ...p, outgoingToUser:m }; });
        toast.success("Đã hủy lời mời kết nối.");
      }

      else if(mode==="cancel_group"){
        if(!requestId) return;
        await cancelMatchRequest(requestId);
        setRequestMaps((p)=>{ const m={...p.outgoingToRoom}; delete m[tid]; return { ...p, outgoingToRoom:m }; });
        toast.success("Đã hủy yêu cầu tham gia nhóm.");
      }

      else if(mode==="accept_duo"){
        if(!requestId) return;
        const res = await acceptMatchRequest(requestId);
        const payload = res?.data ?? res;
        const roomId = payload?.roomId || payload?.data?.roomId || null;
        const roomType = payload?.roomType || payload?.data?.roomType || "duo";
        setRequestMaps((p)=>{ const m={...p.incomingFromUser}; delete m[tid]; return { ...p, incomingFromUser:m }; });
        toast.success("Đã xác nhận lời mời kết nối.");
        if(onEnteredRoom && roomId) onEnteredRoom(roomId, roomType);
      }

      onCreatedRequest && onCreatedRequest();
      closeConfirm();
    }catch(e){
      console.error("Confirm connect action error:", e);
      const msg=e?.response?.data?.message||e?.response?.data?.error||"Không thể thực hiện thao tác. Vui lòng thử lại.";
      toast.error(msg);
    }finally{
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
            <span className="cn-result-text">{loading ? "Đang tìm gợi ý quanh bạn..." : `${resultCount} kết quả phù hợp quanh bạn`}</span>
          </div>

          <div className="cn-main-toolbar-right">
            <button className="cn-create-group-btn" type="button" onClick={() => onOpenCreateTeam?.()}>
              <span className="cn-create-group-icon">＋</span>
              <span>Tạo nhóm của tôi</span>
            </button>

            <div className="cn-view-toggle">
              <button type="button" className={"cn-view-toggle-btn" + (viewMode === "grid" ? " is-active" : "")} onClick={() => setViewMode("grid")}><i className="fa-solid fa-table-cells-large" /></button>
              <button type="button" className={"cn-view-toggle-btn" + (viewMode === "list" ? " is-active" : "")} onClick={() => setViewMode("list")}><i className="fa-solid fa-list" /></button>
            </div>
          </div>
        </div>

        <div className="cn-main-search">
          <div className="cn-search-input">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              type="text"
              placeholder="Tìm kiếm người dùng/nhóm theo tên, mã nhóm, mức độ tập luyện..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="cn-filter-chips">
          <button type="button" className="cn-chip cn-chip-sum" onClick={() => onOpenFilters?.()}>
            <i className="fa-solid fa-link" /> {MODE_LABELS[connectionMode] || "—"}
          </button>

          <button type="button" className="cn-chip cn-chip-sum" onClick={() => onOpenFilters?.()}>
            <i className="fa-solid fa-location-dot" /> {LOC_RANGE_LABELS[locationRange] || "—"}
          </button>

          <button type="button" className="cn-chip cn-chip-sum" onClick={() => onOpenFilters?.()}>
            <i className="fa-solid fa-cake-candles" /> {AGE_RANGE_LABELS[ageRange] || "—"}
          </button>

          <button type="button" className="cn-chip cn-chip-sum" onClick={() => onOpenFilters?.()}>
            <i className="fa-solid fa-venus-mars" /> {GENDER_LABELS[genderFilter] || "—"}
          </button>
        </div>

        {errorMsg && <div className="cn-error"><p>{errorMsg}</p></div>}

        <div className={"cn-card-list " + (viewMode === "grid" ? "cn-card-list--grid" : "cn-card-list--list")}>
          {connectionMode==="one_to_one" && selfCard && (
            <ConnectCard
              key="self"
              user={selfCard}
              viewMode={viewMode}
              inviteState={null}
              onOpenConfirm={null}
              onOpenReport={null}
              onOpenUser={null}
              meId={meId}
              isSelf={true}
              isPinned={true}
              pinText="Hồ sơ của bạn"
            />
          )}

          {connectionMode==="group" && myGroupCard && (
            <ConnectCard
              key="my-group"
              user={myGroupCard}
              viewMode={viewMode}
              inviteState={null}
              onOpenConfirm={null}
              onOpenReport={openReport}
              onOpenUser={null}
              meId={meId}
              isSelf={false}
              isPinned={true}
              pinText="Nhóm của bạn"
            />
          )}

          {filteredList.map((u) => (
            <ConnectCard
              key={String(u?.id || u?._id || Math.random())}
              user={u}
              viewMode={viewMode}
              inviteState={getInviteStateFor(u)}
              onOpenConfirm={openConfirm}
              onOpenReport={openReport}
              onOpenUser={openUserModal}
              meId={meId}
              isSelf={false}
              isPinned={false}
            />
          ))}
        </div>

        {!loading && filteredList.length === 0 && (
          <div className="cn-empty" style={{ marginTop: 8 }}>
            <p>Chưa tìm thấy kết quả phù hợp với bộ lọc hiện tại. Thử nới rộng phạm vi hoặc thay đổi chế độ kết nối nhé.</p>
          </div>
        )}
      </section>

      <ConnectRequestConfirmModal open={confirmState.open} mode={confirmState.mode} targetName={confirmState.target?.nickname || ""} onClose={closeConfirm} onConfirm={handleConfirm} loading={confirmLoading} />

      <ReportSideModal open={reportState.open} target={reportState.target} loading={reportLoading} onClose={closeReport} onSubmit={handleSubmitReport} />

      <UserSideModal
        open={userModalOpen}
        user={userModalTarget}
        meId={meId}
        onClose={closeUserModal}
        onViewProfile={handleViewPublicProfile}
        onStartChat={handleStartChat}
      />
    </>
  );
}

/* ===== Card: Grid & List ===== */
function ConnectCard({ user, viewMode, inviteState, onOpenConfirm, onOpenReport, onOpenUser, meId, isSelf=false, isPinned=false, pinText="" }) {
  const { id,_id,nickname,age,gender,goal,trainingTypes=[],intensityLabel,locationLabel,bio,isGroup,membersCount,imageUrl,areaLabel,ageRange,trainingFrequency } = user || {};
  const uid=id||_id;

  const userGenderLabel=!isGroup&&gender==="male"?"Nam":!isGroup&&gender==="female"?"Nữ":!isGroup&&gender?"Khác":"";
  const groupGenderLabel=isGroup?(GENDER_LABELS[gender]||"Tất cả"):"";
  const groupAgeLabel=isGroup?(AGE_RANGE_LABELS[ageRange]||"Tất cả"):"";
  const groupFreqText=isGroup?(trainingFrequency?`${trainingFrequency} buổi/tuần`:""):"";
  const groupLocShort=isGroup?shortDistrictCity(locationLabel):(locationLabel||"");
  const DEFAULT_AVATAR="/images/avatar.png";
  const thumbSrc=(()=>{const s=String(imageUrl||"").trim();return s?s:DEFAULT_AVATAR;})();

  const membersNum=(()=>{const n=Number(membersCount||0);return Number.isFinite(n)&&n>0?n:1;})();
  const membersChip=isGroup?(<span className="cn-card-img-members-chip"><i className="fa-solid fa-users" /> {membersNum} / 5</span>):null;

  const areaText=isSelf?"Nhà":(areaLabel||"");

  const metaLine=!isGroup?(()=>{
    const parts=[];
    if(locationLabel) parts.push(`📍 ${locationLabel}`);
    if(age) parts.unshift(`${age} tuổi`);
    if(userGenderLabel) parts.unshift(userGenderLabel);
    return parts.join(" · ");
  })():"";

  const groupMetaOneLine=isGroup?`Độ tuổi: ${groupAgeLabel} · Giới tính: ${groupGenderLabel}${groupLocShort?` · 📍 ${groupLocShort}`:""}`:"";

  const inviteType=inviteState?.type||null;
  const inviteReqId=inviteState?.requestId||null;

  // ⚠️ pinned group (myGroupCard) -> không có invite, nhưng vẫn có report
  const canInvite = !!inviteType && !!onOpenConfirm && (!isPinned || !isGroup);
  const canReport = !!onOpenReport && !isSelf;

  let primaryLabel="", primaryClass="cn-btn-primary";
  if(inviteType==="accept_duo"){primaryLabel="Xác nhận lời mời kết nối";primaryClass="cn-btn-success";}
  else if(inviteType==="cancel_duo"){primaryLabel="Hủy lời mời kết nối";primaryClass="cn-btn-cancel";}
  else if(inviteType==="cancel_group"){primaryLabel="Hủy yêu cầu tham gia nhóm";primaryClass="cn-btn-cancel";}
  else if(inviteType==="send_group"){primaryLabel="Xin tham gia nhóm";primaryClass="cn-btn-primary";}
  else if(inviteType==="send_duo"){primaryLabel="Gửi lời mời kết nối";primaryClass="cn-btn-primary";}

  const handlePrimaryClick=()=>{if(!inviteType||!onOpenConfirm) return; onOpenConfirm(inviteType,user,inviteReqId);};
  const handleReportClick=()=>{if(!onOpenReport) return; onOpenReport(user);};

  const handleOpenUser=()=>{
    if(!onOpenUser || isGroup || isSelf) return;
    const idStr=String(uid||"");
    if(!idStr) return;
    if(meId && idStr===String(meId)) return;
    onOpenUser(user);
  };

  if(viewMode==="grid"){
    return (
      <article className="cn-card cn-card--grid">
        {isPinned && <div className="cn-card-pin" title={pinText||"Đã ghim"}><i className="fa-solid fa-thumbtack" /></div>}

        <div className="cn-card-img-wrap">
          <img
            src={thumbSrc}
            alt={nickname}
            className="cn-card-img"
            onError={(e)=>{e.currentTarget.src=DEFAULT_AVATAR;}}
            onClick={handleOpenUser}
            style={!isGroup&&!isSelf?{cursor:"pointer"}:undefined}
          />
          <div className="cn-card-img-overlay">
            <div className="cn-card-img-title-row">
              <div className="cn-card-img-title-left">
                {isSelf||!onOpenUser||isGroup
                  ? <div className="cn-card-img-name-btn cn-card-img-name-static">{nickname}</div>
                  : <button type="button" className="cn-card-img-name-btn" onClick={handleOpenUser}>{nickname}</button>}
              </div>
            </div>

            {(areaText || membersChip) && (
              <div className="cn-card-img-subrow">
                {areaText && <div className="cn-card-img-distance">{areaText}</div>}
                {membersChip}
              </div>
            )}
          </div>
        </div>

        <div className="cn-card-body">
          {!isGroup && metaLine && <div className="cn-card-meta-line">{metaLine}</div>}
          {isGroup && groupMetaOneLine && <div className="cn-card-meta-line cn-card-meta-line--one" title={groupMetaOneLine}>{groupMetaOneLine}</div>}

          <div className="cn-card-chip-row">
            {goal && <span className="cn-chip cn-chip-goal">{goal}</span>}
            {!isGroup && intensityLabel && <span className="cn-chip cn-chip-level">{intensityLabel}</span>}
            {isGroup && groupFreqText && <span className="cn-chip cn-chip-level">{groupFreqText}</span>}
          </div>

          {!isGroup && trainingTypes.length>0 && <p className="cn-frequency">Ưu tiên: {trainingTypes.join(" · ")}</p>}
          {bio && <p className="cn-card-bio-text">{bio}</p>}

          {(!isSelf && (canInvite || canReport)) && (
            <div className="cn-card-actions">
              {canInvite && (
                <button type="button" className={primaryClass} onClick={handlePrimaryClick}>
                  {primaryLabel}
                </button>
              )}

              {canReport && (
                <button
                  type="button"
                  className="cn-btn-ghost cn-btn-report"
                  onClick={handleReportClick}
                  title="Báo cáo"
                  style={{ marginLeft: "auto" }}   
                >
                  <i className="fa-solid fa-triangle-exclamation"></i>
                </button>
              )}
            </div>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="cn-card cn-card--list">
      {isPinned && <div className="cn-card-pin" title={pinText||"Đã ghim"}><i className="fa-solid fa-thumbtack" /></div>}

      <div className="cn-avatar" onClick={handleOpenUser} style={!isGroup&&!isSelf?{cursor:"pointer"}:undefined}>
        <img src={thumbSrc} alt={nickname} className="cn-avatar-img" onError={(e)=>{e.currentTarget.src=DEFAULT_AVATAR;}} />
      </div>

      <div className="cn-card-main">
        <div className="cn-card-header">
          <div style={{minWidth:0,width:"100%"}}>
            <div className="cn-nickname-row" style={isGroup?{justifyContent:"space-between",gap:10}:{}}>
              <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
                {isSelf||!onOpenUser||isGroup
                  ? <span className="cn-name-static">{nickname}</span>
                  : <button type="button" className="cn-name-link" onClick={handleOpenUser}>{nickname}</button>}
              </div>
              {isGroup && membersChip}
            </div>

            {!isGroup ? (
              <div className="cn-meta-row">
                {!isGroup && age && <span className="cn-meta">{age} tuổi · {userGenderLabel || "—"}</span>}
                {areaText && <span className="cn-meta">{areaText}</span>}
                {locationLabel && <span className="cn-meta">📍 {locationLabel}</span>}
              </div>
            ) : (
              <div className="cn-meta-row" style={{minWidth:0}}>
                {groupMetaOneLine && <span className="cn-meta" title={groupMetaOneLine} style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%", display: "block"}}>{groupMetaOneLine}</span>}
              </div>
            )}
          </div>
        </div>

        <div className="cn-goal-row">
          {goal && <span className="cn-badge cn-badge-goal">{goal}</span>}
          {!isGroup && intensityLabel && <span className="cn-badge cn-badge-level">{intensityLabel}</span>}
          {isGroup && groupFreqText && <span className="cn-badge cn-badge-level">{groupFreqText}</span>}
        </div>

        {!isGroup && trainingTypes.length>0 && <p className="cn-frequency">Ưu tiên: {trainingTypes.join(" · ")}</p>}
        {bio && <p className="cn-bio">{bio}</p>}

        {(!isSelf && (canInvite || canReport)) && (
          <div className="cn-card-actions">
            {canInvite && (
              <button type="button" className={primaryClass} onClick={handlePrimaryClick}>
                {primaryLabel}
              </button>
            )}

            {canReport && (
              <button
                type="button"
                className="cn-btn-ghost cn-btn-report"
                onClick={handleReportClick}
                style={{ marginLeft: "auto" }} 
              >
                Báo cáo
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
