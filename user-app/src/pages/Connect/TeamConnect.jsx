// user-app/src/pages/Connect/TeamConnect.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Connect.css";
import "./TeamConnect.css";
import api from "../../lib/api";
import { getMatchStatus } from "../../api/match";
import { getMe } from "../../api/account";
import { toast } from "react-toastify";
import TeamEditModal from "./TeamEditModal";

const API_ORIGIN=(api?.defaults?.baseURL||"").replace(/\/+$/,"");
const toAbs=(u)=>{if(!u)return u;try{return new URL(u,API_ORIGIN).toString()}catch{return u}};
const AGE_LABELS={all:"Tất cả","18-21":"18-21","22-27":"22-27","28-35":"28-35","36-45":"36-45","45+":"Trên 45"};
const GENDER_LABELS={all:"Tất cả",male:"Nam",female:"Nữ"};
const FREQ_LABELS={"1-2":"1-2 buổi/tuần","2-3":"2-3 buổi/tuần","3-5":"3-5 buổi/tuần","5+":"Trên 5 buổi/tuần"};
const INTENSITY_LABELS={level_1:"Không tập luyện, ít vận động",level_2:"Vận động nhẹ nhàng",level_3:"Chăm chỉ tập luyện",level_4:"Rất năng động"};

function getInitials(name){if(!name)return"FM";return String(name).trim().split(/\s+/).map(p=>p?.[0]).join("").slice(0,2).toUpperCase();}
const safeArr=(v)=>Array.isArray(v)?v:[];

function pickRoomData(res){const payload=res?.data ?? res; return payload?.data ?? payload ?? null;}
function pickOkData(res){const payload=res?.data ?? res; return payload?.data ?? payload ?? null;}

function calcAge(dob){if(!dob)return null;const d=new Date(dob);if(Number.isNaN(d.getTime()))return null;const now=new Date();let age=now.getFullYear()-d.getFullYear();const m=now.getMonth()-d.getMonth();if(m<0||(m===0&&now.getDate()<d.getDate()))age--;return age;}
function timeAgo(iso){const t=iso?new Date(iso).getTime():0;if(!t)return"";let s=Math.floor((Date.now()-t)/1000);if(s<0)s=0;if(s<15)return"Vừa xong";if(s<60)return`${s}s trước`;const m=Math.floor(s/60);if(m<60)return`${m} phút trước`;const h=Math.floor(m/60);if(h<24)return`${h} giờ trước`;const d=Math.floor(h/24);return`${d} ngày trước`;}
function buildFullLocationFromProfile(p){const a=p?.address||{};return [a.country,a.city,a.district,a.ward].filter(Boolean).join(" - ");}

function normReqItem(x){
  const u=x?.fromUser||x?.user||x?.requester||{};
  const p=u?.profile||{};
  const name=p?.nickname||u?.username||u?.email||"Người dùng FitMatch";
  const avatarUrl=toAbs(p?.avatarUrl)||toAbs(u?.avatarUrl)||null;

  const gender=p?.sex||u?.sex||null;
  const age=calcAge(p?.dob||u?.dob);

  const goalLabel=(u?.connectGoalLabel||x?.meta?.fromGoalLabel||"")?.trim()||"";
  const goalKey=u?.connectGoalKey||x?.meta?.fromGoalKey||p?.goal||null;

  const intensityKey=p?.trainingIntensity||u?.trainingIntensity||null;
  const intensityLabel=(INTENSITY_LABELS[intensityKey]||String(intensityKey||"").trim()||"")||"";

  const locationLabel=(u?.connectLocationLabel||"")?.trim()||buildFullLocationFromProfile(p)||"";
  const bio=(u?.connectBio||"")?.trim()||"";

  return {
    id:String(x?._id||x?.id||""),
    status:String(x?.status||"pending"),
    message:x?.message||"",
    createdAt:x?.createdAt||null,
    resolvedAt:x?.resolvedAt||null,
    meta:x?.meta||null,
    user:{
      id:String(u?._id||u?.id||""),
      name,
      avatarUrl,
      goalLabel,
      goalKey,
      locationLabel,
      age,
      gender,
      intensityLabel,
      bio,
    }
  };
}

export default function TeamConnect({ onLeftRoom }){
  const nav=useNavigate();
  const [loading,setLoading]=useState(true);
  const [room,setRoom]=useState(null);
  const [me,setMe]=useState(null);

  const [menuOpen,setMenuOpen]=useState(false);
  const [leaveModalOpen,setLeaveModalOpen]=useState(false);
  const [leaving,setLeaving]=useState(false);

  const [topTab,setTopTab]=useState("setup"); // setup | guidelines | chat
  const [reqTab,setReqTab]=useState("pending"); // pending | accepted | rejected

  const [reqLoading,setReqLoading]=useState(false);
  const [reqErr,setReqErr]=useState("");

  const [pendingReqs,setPendingReqs]=useState([]);
  const [acceptedReqs,setAcceptedReqs]=useState([]);
  const [rejectedReqs,setRejectedReqs]=useState([]);
  const [reqCounts,setReqCounts]=useState({pending:0,accepted:0,rejected:0});

  const [editOpen,setEditOpen]=useState(false);
  const [savingEdit,setSavingEdit]=useState(false);
  const [editForm,setEditForm]=useState({name:"",description:"",coverImageUrl:"",ageRange:"all",gender:"all",trainingFrequency:"1-2",maxMembers:5,locationLabel:""});

  const [viewCount,setViewCount]=useState(0);
  const viewedOnceRef=useRef(false);

  const [imgOpen,setImgOpen]=useState(false);

  const [confirm,setConfirm]=useState({open:false,mode:null,req:null}); // mode: accept|reject
  const [confirming,setConfirming]=useState(false);

  const myId=me?._id||me?.id||null;

  const loadRoom=async()=>{
    const [stRaw,meRaw]=await Promise.all([getMatchStatus(),getMe().catch(()=>null)]);
    const statusData=stRaw?.data ?? stRaw;
    const activeRoomId=statusData?.activeRoomId;
    const activeRoomType=statusData?.activeRoomType;

    if(!activeRoomId || activeRoomType!=="group"){
      toast.info("Hiện bạn chưa tham gia phòng kết nối nhóm nào.");
      if(typeof onLeftRoom==="function") onLeftRoom(); else nav("/ket-noi");
      return null;
    }

    const roomRes=await api.get(`/match/rooms/${activeRoomId}`);
    const roomData=pickRoomData(roomRes);
    setRoom(roomData);
    setMe(meRaw||null);
    return roomData;
  };

  useEffect(()=>{let cancelled=false;
    (async()=>{
      try{ setLoading(true); const rd=await loadRoom(); if(cancelled) return; if(!rd) return; }
      catch(e){ console.error(e); toast.error(e?.response?.data?.message||e?.response?.data?.error||"Không thể tải phòng nhóm."); if(typeof onLeftRoom==="function") onLeftRoom(); else nav("/ket-noi"); }
      finally{ if(!cancelled) setLoading(false); }
    })();
    return()=>{cancelled=true;};
  },[nav,onLeftRoom]);

  const members=useMemo(()=>{
    const arr=safeArr(room?.members);
    return arr.map(m=>{
      const u=m.user||{};
      const p=u.profile||{};
      const name=p.nickname||u.username||u.email||"Người dùng FitMatch";
      return { id:String(u._id||u.id||""), name, avatarUrl:toAbs(p.avatarUrl)||null, role:m.role||"member" };
    });
  },[room]);

  const isOwner=useMemo(()=>{
    if(!myId) return false;
    return members.some(m=>String(m.id)===String(myId) && m.role==="owner");
  },[members,myId]);

  const team=useMemo(()=>{
    if(!room) return null;
    return {
      id: room._id,
      name: room.name||"Nhóm tập luyện",
      imageUrl: toAbs(room.coverImageUrl)||null,
      locationText: room.locationLabel||"Chưa có địa chỉ",
      maxMembers: room.maxMembers||5,
      joinPolicy: room.joinPolicy||"request",
      ageRange: room.ageRange||"all",
      gender: room.gender||"all",
      trainingFrequency: room.trainingFrequency||"1-2",
      ageRangeLabel: AGE_LABELS[room.ageRange]||room.ageRange||"--",
      genderLabel: room.gender==="male"?"Nam":room.gender==="female"?"Nữ":"Tất cả",
      trainingLabel: FREQ_LABELS[room.trainingFrequency]||room.trainingFrequency||"--",
      description: room.description||"",
    };
  },[room]);

  const roomId=team?.id||null;

  const slots=useMemo(()=>{
    const max=Math.max(2,Math.min(10,Number(team?.maxMembers||5)));
    const owner=members.find(m=>m.role==="owner")||null;
    const rest=members.filter(m=>m!==owner);
    const filled=[...(owner?[owner]:[]),...rest];
    return Array.from({length:max},(_,i)=>filled[i]||null);
  },[members,team]);

  useEffect(()=>{
    if(!roomId) return;
    const k=`fm_team_views_${roomId}`;
    try{ setViewCount(Number(localStorage.getItem(k)||0)||0); }catch{}
  },[roomId]);

  const bumpView=()=>{
    if(!roomId || viewedOnceRef.current) return;
    viewedOnceRef.current=true;
    const k=`fm_team_views_${roomId}`;
    try{ const next=(Number(localStorage.getItem(k)||0)||0)+1; localStorage.setItem(k,String(next)); setViewCount(next); }catch{}
  };

  const loadRequests=async(id)=>{
    if(!id) return;
    setReqErr(""); setReqLoading(true);
    try{
      const res=await api.get(`/match/rooms/${id}/requests`);
      const data=pickOkData(res) || {};
      const pending=safeArr(data.pending).map(normReqItem);
      const accepted=safeArr(data.accepted).map(normReqItem);
      const rejected=safeArr(data.rejected).map(normReqItem);
      setPendingReqs(pending); setAcceptedReqs(accepted); setRejectedReqs(rejected);
      setReqCounts(data.counts||{pending:pending.length,accepted:accepted.length,rejected:rejected.length});
    }catch(e){
      const code=e?.response?.status;
      if(code===403){ setPendingReqs([]); setAcceptedReqs([]); setRejectedReqs([]); setReqCounts({pending:0,accepted:0,rejected:0}); setReqErr("Chỉ chủ phòng mới xem/duyệt yêu cầu tham gia nhóm."); }
      else setReqErr(e?.response?.data?.message||"Không thể tải danh sách yêu cầu.");
    }finally{ setReqLoading(false); }
  };

  useEffect(()=>{ if(roomId) loadRequests(roomId); },[roomId]);

  const onAccept=async(r)=>{
    try{ await api.patch(`/match/requests/${r.id}/accept`); toast.success("Đã duyệt yêu cầu."); await Promise.all([loadRequests(roomId), loadRoom()]); }
    catch(e){ toast.error(e?.response?.data?.message||e?.response?.data?.error||"Không thể duyệt yêu cầu."); await Promise.all([loadRequests(roomId), loadRoom()]); }
  };
  const onReject=async(r)=>{
    try{ await api.patch(`/match/requests/${r.id}/reject`); toast.info("Đã từ chối yêu cầu."); await loadRequests(roomId); }
    catch(e){ toast.error(e?.response?.data?.message||e?.response?.data?.error||"Không thể từ chối yêu cầu."); await loadRequests(roomId); }
  };

  const openConfirm=(mode,r)=>{ if(!isOwner) return toast.info("Chỉ chủ phòng mới có thể duyệt yêu cầu."); setConfirm({open:true,mode,req:r}); };
  const closeConfirm=()=>{ if(confirming) return; setConfirm({open:false,mode:null,req:null}); };
  const handleConfirm=async()=>{
    if(!confirm.open || !confirm.mode || !confirm.req) return;
    try{
      setConfirming(true);
      if(confirm.mode==="accept") await onAccept(confirm.req);
      else await onReject(confirm.req);
      setConfirm({open:false,mode:null,req:null});
    }finally{ setConfirming(false); }
  };

  const [joinPolicy,setJoinPolicy]=useState("request");
  useEffect(()=>{ if(team?.joinPolicy) setJoinPolicy(team.joinPolicy); },[team?.joinPolicy]);

  const updateJoinPolicy=async(next)=>{
    if(!roomId) return;
    if(!isOwner){ toast.info("Chỉ chủ phòng mới được đổi chế độ tham gia."); return; }
    setJoinPolicy(next);
    try{ await api.patch(`/match/rooms/${roomId}`, { joinPolicy: next }); toast.success("Đã cập nhật chế độ tham gia."); await loadRoom(); }
    catch(e){ toast.error(e?.response?.data?.message||"Không thể cập nhật chế độ."); setJoinPolicy(team?.joinPolicy||"request"); }
  };

  const openEdit=()=>{
    if(!isOwner){ toast.info("Chỉ chủ phòng mới chỉnh sửa được nhóm."); return; }
    setEditForm({
      name: team?.name||"",
      description: team?.description||"",
      coverImageUrl: team?.imageUrl||"",
      ageRange: team?.ageRange||"all",
      gender: team?.gender||"all",
      trainingFrequency: team?.trainingFrequency||"1-2",
      maxMembers: team?.maxMembers||5,
      locationLabel: team?.locationText||"",
    });
    setEditOpen(true);
  };
  const closeEdit=()=>{ if(!savingEdit) setEditOpen(false); };

  const saveEdit=async()=>{
    if(!roomId) return;
    if(!String(editForm.name||"").trim()) return toast.error("Tên nhóm không được để trống.");
    if(!String(editForm.description||"").trim()) return toast.error("Mô tả nhóm không được để trống.");
    if(!String(editForm.coverImageUrl||"").trim()) return toast.error("Ảnh nhóm (URL) không được để trống.");
    try{
      setSavingEdit(true);
      await api.patch(`/match/rooms/${roomId}`, {
        name:String(editForm.name||"").trim(),
        description:String(editForm.description||"").trim(),
        coverImageUrl:String(editForm.coverImageUrl||"").trim(),
        ageRange:editForm.ageRange,
        gender:editForm.gender,
        trainingFrequency:editForm.trainingFrequency,
        maxMembers:Number(editForm.maxMembers)||5,
        locationLabel:String(editForm.locationLabel||"").trim(),
      });
      toast.success("Đã cập nhật thông tin nhóm.");
      setEditOpen(false);
      await loadRoom();
    }catch(e){ toast.error(e?.response?.data?.message||"Không thể cập nhật nhóm."); }
    finally{ setSavingEdit(false); }
  };

  const shareLink=async(e)=>{
    e?.stopPropagation?.();
    const link=`${window.location.origin}/ket-noi?room=${roomId}`;
    try{ await navigator.clipboard.writeText(link); toast.success("Đã copy link nhóm."); }
    catch{ toast.info(link); }
  };

  const handleConfirmLeave=async()=>{
    if(!roomId) return;
    try{
      setLeaving(true);
      await api.post(`/match/rooms/${roomId}/leave`);
      toast.info("Bạn đã rời khỏi nhóm.");
      setLeaveModalOpen(false);
      if(typeof onLeftRoom==="function") onLeftRoom(); else nav("/ket-noi");
    }catch(e){ toast.error(e?.response?.data?.message||e?.response?.data?.error||"Không thể rời nhóm."); }
    finally{ setLeaving(false); }
  };

  const coverSrc=team?.imageUrl||"/images/avatar.png";
  useEffect(()=>{
    if(!imgOpen) return;
    const onKey=(e)=>{ if(e.key==="Escape") setImgOpen(false); };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[imgOpen]);

  if(loading && !room) return <div className="tc-page"><p className="tc-loading">Đang tải phòng nhóm...</p></div>;
  if(!room || !team) return null;

  const pendingCount=(reqCounts?.pending ?? pendingReqs.length);
  const acceptedCount=(reqCounts?.accepted ?? acceptedReqs.length);
  const rejectedCount=(reqCounts?.rejected ?? rejectedReqs.length);

  return (
    <div className="tc-page">
      <header className="tc-header">
        <div className="tc-header-left"><div className="tc-badge">Phòng kết nối nhóm</div></div>
        <div className="tc-header-right">
          <button type="button" className="tc-more-btn" onClick={()=>setMenuOpen(v=>!v)}><i className="fa-solid fa-ellipsis-vertical"/></button>
          {menuOpen && (
            <div className="tc-menu" onMouseLeave={()=>setMenuOpen(false)}>
              <button type="button" className="tc-menu-item tc-menu-danger" onClick={()=>{setLeaveModalOpen(true);setMenuOpen(false);}}>Rời khỏi nhóm</button>
            </div>
          )}
        </div>
      </header>

      <div className="tc-stack">
        <section className="tc-box tc-box-top">
          <div className="tc-top-tabs">
            <button type="button" className={"tc-top-tab"+(topTab==="setup"?" is-active":"")} onClick={()=>setTopTab("setup")}>Thiết lập nhóm</button>
            <button type="button" className={"tc-top-tab"+(topTab==="guidelines"?" is-active":"")} onClick={()=>setTopTab("guidelines")}>Hướng dẫn</button>
            <button type="button" className={"tc-top-tab"+(topTab==="chat"?" is-active":"")} onClick={()=>setTopTab("chat")}>Trò chuyện</button>
          </div>

          {topTab!=="setup" ? (
            <div className="tc-empty-tab">Nội dung tab này sẽ cập nhật sau.</div>
          ) : (
            <div className="tc-box-body">
              <div className="tc-slots">
                {slots.map((m,idx)=>{
                  const isMe=!!(m && myId && String(myId)===String(m.id));
                  const isOwnerSlot=!!(m && m.role==="owner");
                  const title=m ? m.name : "Chưa có thành viên";
                  const roleText=isOwnerSlot ? "Chủ phòng" : "Thành viên";
                  const roleCls=isOwnerSlot ? " is-owner" : " is-member";
                  return (
                    <div key={m?.id||`empty-${idx}`} className={"tc-slot"+(!m?" is-empty":"")+(isMe?" is-me":"")}>
                      <div className="tc-slot-row">
                        <div className={"tc-slot-ava"+(isOwnerSlot?" is-owner":"")}>
                          {m?.avatarUrl
                            ? <img src={m.avatarUrl} alt={title}/>
                            : (!m ? <img src="/images/avatar.png" alt="empty"/> : <span>{getInitials(title)}</span>)
                          }
                        </div>
                        <div className="tc-slot-meta">
                          <div className="tc-slot-topline">
                            <span className={"tc-slot-role"+roleCls}>{roleText}</span>
                          </div>
                          <div className="tc-slot-name" title={title}>{title}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="tc-timeline">
                <div className="tc-timeline-bar" />
                <div className="tc-timeline-days" style={{gridTemplateColumns:`repeat(${slots.length}, minmax(0,1fr))`}}>
                  {slots.map((_,i)=>(
                    <div key={i} className="tc-timeline-day">
                      <span className="tc-timeline-tri" />
                      <span className="tc-timeline-label">DAY {i+1}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {topTab==="setup" && (
          <section className="tc-box tc-box-bottom" onClick={bumpView}>
            <div className="tc-sec2-head">
              <div className="tc-head-left">
                <div className="tc-joinbox">
                  <div className="tc-join-title-row">
                    <div className="tc-join-title">{joinPolicy==="request"?"Yêu cầu gửi lời mời tham gia":"Không yêu cầu gửi lời mời"}</div>
                    <button type="button" className={"tc-switch"+(joinPolicy==="request"?" is-on":"")} onClick={(e)=>{e.stopPropagation();updateJoinPolicy(joinPolicy==="request"?"open":"request");}} disabled={!isOwner}>
                      <span className="tc-switch-knob"/>
                    </button>
                  </div>
                  <div className="tc-join-desc">
                    {joinPolicy==="request"
                      ? "Người dùng muốn tham gia sẽ gửi yêu cầu. Chủ nhóm duyệt thì mới vào nhóm."
                      : "Người dùng có thể tham gia trực tiếp ngay khi thấy nhóm."}
                  </div>
                </div>
              </div>

              <div className="tc-head-right">
                <div className="tc-stat"><div className="tc-stat-k">Lượt xem</div><div className="tc-stat-v">{viewCount}</div></div>
                <div className="tc-stat"><div className="tc-stat-k">Yêu cầu</div><div className="tc-stat-v">{pendingCount}</div></div>
              </div>
            </div>

            <div className="tc-group-row">
              <button type="button" className="tc-cover-btn" onClick={(e)=>{e.stopPropagation();setImgOpen(true);}} aria-label="Xem ảnh nhóm">
                <img src={coverSrc} alt={team.name}/>
                <span className="tc-cover-hover"><i className="fa-solid fa-magnifying-glass-plus"/></span>
              </button>

              <div className="tc-group-body">
                <div className="tc-group-top">
                  <div className="tc-group-titles">
                    <div className="tc-group-name">{team.name}</div>
                    <div className="tc-group-sub">{members.length} thành viên đã tham gia</div>
                  </div>

                  <div className="tc-group-actions" onClick={(e)=>e.stopPropagation()}>
                    <button type="button" className="tc-act-btn" onClick={shareLink}><i className="fa-solid fa-share-nodes"/> Chia sẻ link</button>
                    <button type="button" className="tc-act-btn tc-act-outline" onClick={openEdit} disabled={!isOwner}><i className="fa-solid fa-pen-to-square"/> Chỉnh sửa</button>
                  </div>
                </div>

                <div className="tc-group-chips">
                  <span className="tc-chip tc-chip-loc">{team.locationText||"Vị trí"}</span>
                  <span className="tc-chip tc-chip-age">Độ tuổi: {team.ageRangeLabel||"Độ tuổi"}</span>
                  <span className="tc-chip tc-chip-gender">Giới tính: {team.genderLabel||"Giới tính"}</span>
                  <span className="tc-chip tc-chip-level">{team.trainingLabel||"Mức độ"}</span>
                </div>
              </div>
            </div>

            {!!(team.description||"").trim() && <div className="tc-group-desc">{team.description}</div>}

            <div className="tc-req-tabs">
              <button type="button" className={"tc-req-tab"+(reqTab==="pending"?" is-active":"")} onClick={()=>setReqTab("pending")}>
                <span className="tc-req-title">Chờ duyệt</span>
                <span className="tc-req-count">{pendingCount ?? "-"}</span>
              </button>
              <button type="button" className={"tc-req-tab"+(reqTab==="accepted"?" is-active":"")} onClick={()=>setReqTab("accepted")}>
                <span className="tc-req-title">Đã duyệt</span>
                <span className="tc-req-count">{acceptedCount ?? "-"}</span>
              </button>
              <button type="button" className={"tc-req-tab"+(reqTab==="rejected"?" is-active":"")} onClick={()=>setReqTab("rejected")}>
                <span className="tc-req-title">Từ chối</span>
                <span className="tc-req-count">{rejectedCount ?? "-"}</span>
              </button>
            </div>

            <div className="tc-req-body">
              {reqLoading && <div className="tc-empty-state"><div className="tc-empty-title">Đang tải yêu cầu...</div></div>}
              {!reqLoading && !!reqErr && <div className="tc-empty-state"><div className="tc-empty-title">{reqErr}</div></div>}

              {!reqLoading && !reqErr && reqTab==="pending" && (
                pendingReqs.length ? (
                  <div className="tc-req-list">
                    {pendingReqs.map(r=>(
                      <PendingTeamReqCard
                        key={r.id}
                        r={r}
                        isOwner={isOwner}
                        onOpenAccept={()=>openConfirm("accept",r)}
                        onOpenReject={()=>openConfirm("reject",r)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="tc-empty-state">
                    <div className="tc-empty-icon"><i className="fa-regular fa-face-smile" /></div>
                    <div className="tc-empty-title">Bạn chưa có yêu cầu nào</div>
                    <div className="tc-empty-sub">Khi có người gửi yêu cầu tham gia nhóm, sẽ hiển thị tại đây để bạn duyệt.</div>
                  </div>
                )
              )}

              {!reqLoading && !reqErr && reqTab==="accepted" && (
                acceptedReqs.length ? (
                  <div className="tc-req-list">
                    {acceptedReqs.map(r=>(
                      <div key={r.id} className="tc-req-card">
                        <div className="tc-req-ava">{r.user.avatarUrl?<img src={r.user.avatarUrl} alt={r.user.name}/>:<span>{getInitials(r.user.name)}</span>}</div>
                        <div className="tc-req-main">
                          <div className="tc-req-name">{r.user.name}</div>
                          <div className="tc-req-note tc-req-note-muted">Đã duyệt</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="tc-empty-state">
                    <div className="tc-empty-icon"><i className="fa-regular fa-circle-check" /></div>
                    <div className="tc-empty-title">Chưa có ai được duyệt</div>
                    <div className="tc-empty-sub">Những người đã được duyệt sẽ được lưu tại tab này.</div>
                  </div>
                )
              )}

              {!reqLoading && !reqErr && reqTab==="rejected" && (
                rejectedReqs.length ? (
                  <div className="tc-req-list">
                    {rejectedReqs.map(r=>(
                      <div key={r.id} className="tc-req-card">
                        <div className="tc-req-ava">{r.user.avatarUrl?<img src={r.user.avatarUrl} alt={r.user.name}/>:<span>{getInitials(r.user.name)}</span>}</div>
                        <div className="tc-req-main">
                          <div className="tc-req-name">{r.user.name}</div>
                          <div className="tc-req-note tc-req-note-muted">Đã từ chối</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="tc-empty-state">
                    <div className="tc-empty-icon"><i className="fa-regular fa-circle-xmark" /></div>
                    <div className="tc-empty-title">Chưa có ai bị từ chối</div>
                    <div className="tc-empty-sub">Những người bị từ chối sẽ được lưu tại tab này.</div>
                  </div>
                )
              )}
            </div>
          </section>
        )}
      </div>

      {imgOpen && (
        <div className="tc-img-backdrop" onClick={()=>setImgOpen(false)}>
          <div className="tc-img-modal" onClick={(e)=>e.stopPropagation()}>
            <button type="button" className="tc-img-close" onClick={()=>setImgOpen(false)} aria-label="Đóng">&times;</button>
            <img src={coverSrc} alt={team.name}/>
            <div className="tc-img-cap">{team.name}</div>
          </div>
        </div>
      )}

      {leaveModalOpen && (
        <div className="tc-modal-backdrop" onClick={()=>{if(!leaving)setLeaveModalOpen(false);}}>
          <div className="tc-modal" onClick={(e)=>e.stopPropagation()}>
            <h3 className="tc-modal-title">Rời khỏi nhóm?</h3>
            <p className="tc-modal-text">Sau khi rời nhóm, bạn sẽ không còn trong phòng kết nối nhóm này nữa.</p>
            <div className="tc-modal-actions">
              <button type="button" className="tc-btn-ghost" onClick={()=>setLeaveModalOpen(false)} disabled={leaving}>Ở lại</button>
              <button type="button" className="tc-btn-reject" onClick={handleConfirmLeave} disabled={leaving}>{leaving?"Đang xử lý...":"Rời nhóm"}</button>
            </div>
          </div>
        </div>
      )}

      {confirm.open && (
        <div className="tc-modal-backdrop" onClick={closeConfirm}>
          <div className="tc-modal" onClick={(e)=>e.stopPropagation()}>
            <h3 className="tc-modal-title">{confirm.mode==="accept"?"Duyệt vào nhóm?":"Từ chối yêu cầu?"}</h3>
            <p className="tc-modal-text">
              {confirm.mode==="accept"
                ? <>Bạn muốn duyệt <b>{confirm.req?.user?.name||"người dùng"}</b> vào nhóm này?</>
                : <>Bạn muốn từ chối yêu cầu của <b>{confirm.req?.user?.name||"người dùng"}</b>?</>
              }
            </p>
            <div className="tc-modal-actions">
              <button type="button" className="tc-btn-ghost" onClick={closeConfirm} disabled={confirming}>Hủy</button>
              {confirm.mode==="accept"
                ? <button type="button" className="tc-btn-accept" onClick={handleConfirm} disabled={confirming}>{confirming?"Đang xử lý...":"Duyệt vào nhóm"}</button>
                : <button type="button" className="tc-btn-reject" onClick={handleConfirm} disabled={confirming}>{confirming?"Đang xử lý...":"Từ chối"}</button>
              }
            </div>
          </div>
        </div>
      )}

      <TeamEditModal open={editOpen} onClose={closeEdit} saving={savingEdit} form={editForm} setForm={setEditForm} onSave={saveEdit} AGE_LABELS={AGE_LABELS} GENDER_LABELS={GENDER_LABELS} FREQ_LABELS={FREQ_LABELS}/>
    </div>
  );
}

function PendingTeamReqCard({ r, isOwner, onOpenAccept, onOpenReject }){
  const nav=useNavigate();
  const u=r?.user||{};
  const name=u.name||"Người dùng FitMatch";
  const avatar=u.avatarUrl||"/images/avatar.png";

  const goal=u.goalLabel||"—";
  const location=u.locationLabel||"—";
  const ageTxt=typeof u.age==="number"?`${u.age} tuổi`:"—";
  const genderTxt=(u.gender && (GENDER_LABELS[u.gender]||""))||"—";
  const intensity=u.intensityLabel||"—";
  const bio=u.bio||"";

  return (
    <article className="tc-pr-card">
      <div className="tc-pr-head">
        <div className="tc-pr-title"><span className="tc-pr-name">{name}</span> đã yêu cầu kết nối nhóm</div>
        <div className="tc-pr-time">{r?.createdAt?`Gửi ${timeAgo(r.createdAt)}`:""}</div>
      </div>
      <div className="tc-pr-divider" />

      <div className="tc-pr-body">
        <div className="tc-pr-left">
          <div className="tc-pr-userrow">
            <div className="tc-pr-ava">
              <img src={avatar} alt={name} onError={(e)=>{e.currentTarget.src="/images/avatar.png";}} />
            </div>

            <div className="tc-pr-usertext">
              <div className="tc-pr-left-name" title={name}>{name}</div>
              <div className="tc-pr-left-chips">
                <span className="tc-chip tc-chip-goal">{goal}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="tc-pr-right">
          <div className="tc-pr-facts">
            <div className="tc-pr-fact">
              <div className="tc-pr-k">Vị trí</div>
              <div className="tc-pr-v tc-chip tc-chip-loc" title={location}>{location}</div>
            </div>
            <div className="tc-pr-fact">
              <div className="tc-pr-k">Tuổi</div>
              <div className="tc-pr-v tc-chip tc-chip-age">{ageTxt}</div>
            </div>
            <div className="tc-pr-fact">
              <div className="tc-pr-k">Giới tính</div>
              <div className="tc-pr-v tc-chip tc-chip-gender">{genderTxt}</div>
            </div>
            <div className="tc-pr-fact">
              <div className="tc-pr-k">Mức độ tập luyện</div>
              <div className="tc-pr-v tc-chip tc-chip-level">{intensity}</div>
            </div>
          </div>

          {!!bio && <div className="tc-pr-bio">{bio}</div>}
        </div>
      </div>

      <div className="tc-pr-foot">
        <button type="button" className="tc-pr-msg" onClick={()=>nav(`/ket-noi/ho-so/${u.id}`)}>
          <i className="fa-regular fa-paper-plane" />
          <span>Gửi tin nhắn cho <b className="tc-pr-msg-name">{name}</b></span>
        </button>

        <div className="tc-pr-actions">
          <button type="button" className="tc-pr-reject" onClick={onOpenReject} disabled={!isOwner}>Từ chối</button>
          <button type="button" className="tc-pr-accept" onClick={onOpenAccept} disabled={!isOwner}>Duyệt vào nhóm</button>
        </div>
      </div>
    </article>
  );
}
