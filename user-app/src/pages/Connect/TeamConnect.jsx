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
import TeamManageMembersModal from "./TeamManageMembersModal";
import UserSideModal from "../UserProfile/UserSideModal";
import ChatBox from "./ChatBox";

const API_ORIGIN=(api?.defaults?.baseURL||"").replace(/\/+$/,"");
const toAbs=(u)=>{if(!u)return u;try{return new URL(u,API_ORIGIN).toString()}catch{return u}};
const AGE_LABELS={all:"Tất cả","18-21":"18-21","22-27":"22-27","28-35":"28-35","36-45":"36-45","45+":"Trên 45"};
const GENDER_LABELS={all:"Tất cả",male:"Nam",female:"Nữ"};
const FREQ_LABELS={"1-2":"1-2 buổi/tuần","2-3":"2-3 buổi/tuần","3-5":"3-5 buổi/tuần","5+":"Trên 5 buổi/tuần"};
const INTENSITY_LABELS={level_1:"Không tập luyện, ít vận động",level_2:"Vận động nhẹ nhàng",level_3:"Chăm chỉ tập luyện",level_4:"Rất năng động"};
const norm=(v)=>(v||"").toString().trim().toLowerCase();
const genderKey=(g)=>{
  const v=norm(g);
  if(!v) return null;
  if(["male","nam","m","man","men"].includes(v)) return "male";
  if(["female","nu","nữ","f","woman","women"].includes(v)) return "female";
  return "other";
};

// Map mọi kiểu object (raw user / member normalized / req.user) -> user card giống TabNearby
function toUserSideCard(x){
  if(!x) return null;

  // Case: raw user doc (có profile)
  if(x?.profile || x?.username || x?.email || x?._id){
    const u=x||{};
    const p=u.profile||{};
    const id=String(u._id||u.id||"");
    const nickname=p.nickname||u.username||u.email||"Người dùng FitMatch";
    const imageUrl=toAbs(p.avatarUrl)||toAbs(u.avatarUrl)||"";
    const bio=String(u.connectBio||p.bio||p.intro||p.about||u.bio||"").trim();

    const age=calcAge(p.dob||p.birthDate||p.ngaySinh||u.dob||u.birthDate);
    const gender=genderKey(p.sex||p.gender||p.gioiTinh||u.sex||u.gender);

    const locationLabel=String(u.connectLocationLabel||p.locationLabel||buildFullLocationFromProfile(p)||u.locationLabel||"").trim();
    const goal=String(u.connectGoalLabel||p.goalLabel||p.goal||u.goal||"").trim();

    const trainingTypes=Array.isArray(p.trainingTypes)?p.trainingTypes:(Array.isArray(u.trainingTypes)?u.trainingTypes:[]);
    const intensityKey=p.trainingIntensity||u.trainingIntensity||null;
    const intensityLabel=(INTENSITY_LABELS[intensityKey]||String(intensityKey||"").trim()||"")||"";

    return { id, nickname, imageUrl, bio, age, gender, locationLabel, goal, trainingTypes, intensityLabel, isGroup:false };
  }

  // Case: member normalized hoặc req.user
  const id=String(x.id||x.userId||x._id||"");
  const nickname=x.nickname||x.name||"Người dùng FitMatch";
  const imageUrl=toAbs(x.avatarUrl||x.imageUrl||"")||"";
  const bio=String(x.bio||"").trim();
  const age=typeof x.age==="number"?x.age:null;
  const gender=genderKey(x.gender||x.sex);
  const locationLabel=String(x.locationLabel||"").trim();
  const goal=String(x.goalLabel||x.goal||"").trim();
  const trainingTypes=Array.isArray(x.trainingTypes)?x.trainingTypes:[];
  const intensityLabel=String(x.intensityLabel||"").trim();

  return { id, nickname, imageUrl, bio, age, gender, locationLabel, goal, trainingTypes, intensityLabel, isGroup:false };
}


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

  const gender=genderKey(p?.sex||p?.gender||u?.sex||u?.gender);
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

// Helper tạo mã nhóm 6 ký tự cuối từ id
function getShortRoomCode(id){
  const raw=String(id||"").trim();
  if(!raw) return "";
  return raw.slice(-6);
}

export default function TeamConnect({ onLeftRoom }){
  const nav=useNavigate();
  const [loading,setLoading]=useState(true);
  const [room,setRoom]=useState(null);
  const roomId=room?._id?String(room._id):null;
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
  const [editForm,setEditForm]=useState({name:"",description:"",coverImageUrl:"",coverFile:null,ageRange:"all",gender:"all",trainingFrequency:"1-2",maxMembers:5,locationLabel:""});

  const [viewCount,setViewCount]=useState(0);
  const viewedOnceRef=useRef(false);

  const [imgOpen,setImgOpen]=useState(false);

  const [confirm,setConfirm]=useState({open:false,mode:null,req:null}); // mode: accept|reject
  const [confirming,setConfirming]=useState(false);

  const [manageOpen,setManageOpen]=useState(false);
  const [manageSaving,setManageSaving]=useState(false);

  const [streakLoading,setStreakLoading]=useState(false);
  const [streakErr,setStreakErr]=useState("");
  const [streakData,setStreakData]=useState(null);

  // state cho copy mã nhóm
  const [copiedCode,setCopiedCode]=useState(false);

  const loadTeamStreaks=async(id)=>{
    if(!id) return;
    setStreakErr(""); setStreakLoading(true);
    try{
      const res=await api.get(`/match/rooms/${id}/streaks`);
      const data=pickOkData(res)||{};
      setStreakData(data);
    }catch(e){
      setStreakErr(e?.response?.data?.message||"Không thể tải streak của nhóm.");
    }finally{ setStreakLoading(false); }
  };

  useEffect(()=>{ if(topTab==="setup" && roomId) loadTeamStreaks(roomId); },[topTab,roomId]);

  const myId=me?._id||me?.id||null;
    // ===== USER SIDE MODAL =====
  const [userModalOpen,setUserModalOpen]=useState(false);
  const [userModalTarget,setUserModalTarget]=useState(null);

  const openUserModal=(anyUser)=>{
    const card=toUserSideCard(anyUser);
    if(!card?.id) return;
    if(myId && String(card.id)===String(myId)) return; // không mở hồ sơ của chính mình
    setUserModalTarget(card);
    setUserModalOpen(true);
  };
  const closeUserModal=()=>setUserModalOpen(false);

  const handleViewPublicProfile=(uid)=>{ setUserModalOpen(false); toast.info("Tính năng xem hồ sơ public của người dùng đang phát triển."); };
  const handleStartChat=(uid)=>{ setUserModalOpen(false); toast.info("Chức năng nhắn tin riêng đang phát triển."); };

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

      const avatarUrl=toAbs(p.avatarUrl)||toAbs(u.avatarUrl)||null;

      const gender=genderKey(p.sex||p.gender||p.gioiTinh||u.sex||u.gender);
      const age=calcAge(p.dob||p.birthDate||p.ngaySinh||u.dob||u.birthDate);

      const goal=String(u.connectGoalLabel||p.goalLabel||p.goal||u.goal||"").trim();
      const locationLabel=String(u.connectLocationLabel||p.locationLabel||buildFullLocationFromProfile(p)||u.locationLabel||"").trim();
      const bio=String(u.connectBio||p.bio||p.intro||p.about||u.bio||"").trim();

      const trainingTypes=Array.isArray(p.trainingTypes)?p.trainingTypes:(Array.isArray(u.trainingTypes)?u.trainingTypes:[]);
      const intensityKey=p.trainingIntensity||u.trainingIntensity||null;
      const intensityLabel=(INTENSITY_LABELS[intensityKey]||String(intensityKey||"").trim()||"")||"";

      return {
        id:String(u._id||u.id||""),
        name,
        nickname:name,
        avatarUrl,
        imageUrl:avatarUrl||"",
        role:m.role||"member",

        gender,
        age,
        goal,
        locationLabel,
        bio,
        trainingTypes,
        intensityLabel,

        rawUser:u, // giữ lại nếu cần
      };
    });
  },[room]);

  const streakMembers=useMemo(()=>{
    const list=safeArr(streakData?.members);
    if(list.length) return list.map(x=>({
      id:String(x?.id||""),
      name:x?.name||"Người dùng FitMatch",
      avatarUrl:toAbs(x?.avatarUrl)||null,
      role:x?.role||"member",
      joinedAt:x?.joinedAt||null,
      hasToday:!!x?.hasToday,
      currentStreak:Number(x?.currentStreak||0),
      bestStreak:Number(x?.bestStreak||0),
    }));
    return members.map(m=>({
      id:String(m?.id||""),
      name:m?.name||"Người dùng FitMatch",
      avatarUrl:m?.avatarUrl||null,
      role:m?.role||"member",
      joinedAt:null,
      hasToday:false,
      currentStreak:0,
      bestStreak:0,
    }));
  },[streakData,members]);

  const ownerUser=useMemo(()=>{
    const m=safeArr(room?.members).find(x=>x?.role==="owner")||safeArr(room?.members)[0]||null;
    const u=m?.user||{}; const p=u?.profile||{};
    return { id:String(u._id||u.id||""), name:p.nickname||u.username||u.email||"Chủ nhóm", avatarUrl:toAbs(p.avatarUrl)||null, sex:p.sex||null, dob:p.dob||null };
  },[room]);

  const isOwner=useMemo(()=>{
    if(!myId) return false;
    return members.some(m=>String(m.id)===String(myId) && m.role==="owner");
  },[members,myId]);

  const team=useMemo(()=>{
    if(!room) return null;
    const createdAtRaw = room.createdAt || null;
    let createdAt = null;
    let createdDays = 0;
    let createdDateLabel = "";

    if (createdAtRaw) {
      const d = new Date(createdAtRaw);
      if (!Number.isNaN(d.getTime())) {
        createdAt = d;
        const today = new Date();
        const startCreated = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const diffMs = startToday.getTime() - startCreated.getTime();
        const diffDays = Math.floor(diffMs / (1000*60*60*24)) + 1;
        createdDays = diffDays > 0 ? diffDays : 1;

        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        createdDateLabel = `${dd}/${mm}/${yyyy}`;
      }
    }

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
      updatedAt: room.updatedAt || room.createdAt || null,
      goalLabel: room.goalLabel || "",
      createdAt,
      createdDays,
      createdDateLabel,
    };
  },[room]);

  const teamCode = useMemo(()=>getShortRoomCode(roomId),[roomId]);

  const slots=useMemo(()=>{
    const max=Math.max(2,Math.min(10,Number(team?.maxMembers||5)));
    const owner=members.find(m=>m.role==="owner")||null;
    const rest=members.filter(m=>m!==owner);
    const filled=[...(owner?[owner]:[]),...rest];
    return Array.from({length:max},(_,i)=>filled[i]||null);
  },[members,team]);

  const loadMyViews=async(id)=>{
    if(!id) return;
    try{
      const res=await api.get(`/match/rooms/${id}/views/me`);
      const data=pickOkData(res)||{};
      setViewCount(Number(data.count||0)||0);
    }catch{}
  };

  useEffect(()=>{ if(roomId) loadMyViews(roomId); },[roomId]);

  // migrate localStorage cũ -> DB (chạy 1 lần khi có roomId)
  useEffect(()=>{
    if(!roomId) return;
    const k=`fm_team_views_${roomId}`;
    let local=0;
    try{ local=Number(localStorage.getItem(k)||0)||0; }catch{}
    if(local<=0) return;
    (async()=>{
      try{
        await api.post(`/match/rooms/${roomId}/views/sync`,{count:local});
        try{ localStorage.removeItem(k); }catch{}
        await loadMyViews(roomId);
      }catch{}
    })();
  },[roomId]);

  const bumpView=async()=>{
    if(!roomId||viewedOnceRef.current) return;
    viewedOnceRef.current=true;
    try{
      const res=await api.post(`/match/rooms/${roomId}/views/bump`);
      const data=pickOkData(res)||{};
      if(data?.count!=null) setViewCount(Number(data.count||0)||0);
      else await loadMyViews(roomId);
    }catch{}
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
      coverFile: null,
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
    const n=String(editForm.name||"").trim();
    const d=String(editForm.description||"").trim();
    const l=String(editForm.locationLabel||"").trim();
    const hasFile=!!editForm.coverFile;
    const hasUrl=!!String(editForm.coverImageUrl||"").trim();
    if(!n) return toast.error("Tên nhóm không được để trống.");
    if(!d) return toast.error("Mô tả nhóm không được để trống.");
    if(!l) return toast.error("Vị trí hiển thị không được để trống.");
    if(!hasFile && !hasUrl) return toast.error("Ảnh nhóm không được để trống.");
    const curCnt=members.length;
    const nextMax=Number(editForm.maxMembers)||5;
    if(nextMax<curCnt) return toast.error(`Số thành viên tối đa không thể nhỏ hơn ${curCnt} (số thành viên hiện tại).`);

    try{
      setSavingEdit(true);

      const fd=new FormData();
      fd.append("name",n);
      fd.append("description",d);
      fd.append("ageRange",editForm.ageRange||"all");
      fd.append("gender",editForm.gender||"all");
      fd.append("trainingFrequency",editForm.trainingFrequency||"1-2");
      fd.append("maxMembers",String(Number(editForm.maxMembers)||5));
      fd.append("locationLabel",l);

      if(hasFile) fd.append("cover",editForm.coverFile);
      else fd.append("coverImageUrl",String(editForm.coverImageUrl||"").trim());

      await api.patch(`/match/rooms/${roomId}`,fd,{headers:{ "Content-Type":"multipart/form-data" }});

      toast.success("Đã cập nhật thông tin nhóm.");
      setEditOpen(false);
      setEditForm(s=>({...s,coverFile:null}));
      await loadRoom();
    }catch(e){
      toast.error(e?.response?.data?.message||"Không thể cập nhật nhóm.");
    }finally{
      setSavingEdit(false);
    }
  };

  // copy mã nhóm 6 số
  const copyTeamCode=async(e)=>{
    e?.stopPropagation?.();
    if(!teamCode) return;
    try{
      await navigator.clipboard.writeText(teamCode);
      setCopiedCode(true);
      toast.success("Đã copy mã nhóm.");
      setTimeout(()=>setCopiedCode(false),3000);
    }catch{
      toast.info(`Mã nhóm: ${teamCode}`);
    }
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

  const leaveDisabled=isOwner && members.length>1;
  const leaveTip="Bạn không thể rời khỏi nhóm này trừ khi bạn \nchỉ định vai trò chủ phòng cho thành viên khác.";

  const applyManageMembers=async({ makeOwnerId, removeIds })=>{
    if(!roomId) return;
    if(!isOwner) return toast.info("Chỉ chủ nhóm mới được quản lý thành viên.");
    const rIds=Array.isArray(removeIds)?removeIds:[];
    if(!makeOwnerId && !rIds.length) return;

    try{
      setManageSaving(true);
      await api.patch(`/match/rooms/${roomId}/members/manage`, { makeOwnerId: makeOwnerId||null, removeIds: rIds });
      toast.success("Đã cập nhật thành viên nhóm.");
      setManageOpen(false);
      await Promise.all([loadRoom(), loadRequests(roomId).catch(()=>null)]);
    }catch(e){
      toast.error(e?.response?.data?.message||e?.response?.data?.error||"Không thể cập nhật thành viên.");
    }finally{
      setManageSaving(false);
    }
  };

  const vKey=team?.updatedAt?new Date(team.updatedAt).getTime():Date.now();
  const coverSrc=team?.imageUrl?`${team.imageUrl}${team.imageUrl.includes("?")?"&":"?"}v=${vKey}`:"/images/avatar.png";

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
  const totalReqCount=(Number(pendingCount)||0)+(Number(acceptedCount)||0)+(Number(rejectedCount)||0);

  return (
    <div className="tc-page">
      <header className="tc-header">
        <div className="tc-header-left"><div className="tc-badge">Phòng kết nối nhóm</div></div>
        <div className="tc-header-right">
          <button type="button" className="tc-more-btn" onClick={()=>setMenuOpen(v=>!v)}><i className="fa-solid fa-ellipsis-vertical"/></button>
            {menuOpen && (
              <div className="tc-menu" onMouseLeave={()=>setMenuOpen(false)}>
                <button
                  type="button"
                  className={"tc-menu-item"+(!isOwner?" is-disabled":"")}
                  title={!isOwner?"Chỉ chủ nhóm mới được quản lý thành viên.":""}
                  onClick={()=>{ if(!isOwner) return; setManageOpen(true); setMenuOpen(false); }}
                >
                  Quản lý
                </button>

                <button
                  type="button"
                  className={"tc-menu-item tc-menu-danger"+(leaveDisabled?" is-disabled":"")}
                  title={leaveDisabled?leaveTip:""}
                  aria-disabled={leaveDisabled}
                  onClick={()=>{
                    if(leaveDisabled){ toast.info(leaveTip); return; }
                    setLeaveModalOpen(true);
                    setMenuOpen(false);
                  }}
                >
                  Rời nhóm
                </button>
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

          {topTab==="setup" ? (
            <div className="tc-box-body">
              <div className="tc-slots">
                {slots.map((m,idx)=>{
                  const isMe=!!(m && myId && String(myId)===String(m.id));
                  const isOwnerSlot=idx===0;
                  const filled=!!m;
                  const title=filled?m.name:"Chưa tham gia";
                  const roleText=isOwnerSlot?"Chủ nhóm":(filled?"Thành viên":"Chưa tham gia");
                  const roleCls=isOwnerSlot?" is-owner":(filled?" is-member":" is-vacant");
                  const avaSrc=filled?(m.avatarUrl||"/images/avatar.png"):"/images/avatar.png";
                  const canOpen=filled && !(myId && String(myId)===String(m.id));
                  return (
                    <div
                      key={m?.id||`empty-${idx}`}
                      className={"tc-slot"+(!filled?" is-empty":"")+(isMe?" is-me":"")}
                      onClick={()=>canOpen && openUserModal(m)}
                      style={canOpen?{cursor:"pointer"}:undefined}
                    >
                      <div className="tc-slot-row">
                        <div className={"tc-slot-ava"+(isOwnerSlot?" is-owner":"")}>
                          <img src={avaSrc} alt={title} onError={(e)=>{e.currentTarget.src="/images/avatar.png";}} />
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
                <TeamStreakTimeline
                  loading={streakLoading}
                  err={streakErr}
                  members={streakMembers}
                  myId={myId}
                  onRefresh={()=>loadTeamStreaks(roomId)}
                />
              </div>
            </div>
          ) : topTab==="chat" ? (
            <div className="tc-box-body tc-chat-body">
              <ChatBox
                conversationId={roomId}
                meId={String(myId||"")}
                members={members}
                onOpenUser={openUserModal}
                height={666}
              />
            </div>
          ) : (
            <div className="tc-empty-tab">Nội dung tab này sẽ cập nhật sau.</div>
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
                <div className="tc-stat"><div className="tc-stat-k">Yêu cầu</div><div className="tc-stat-v">{totalReqCount}</div></div>
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
                    <div className="tc-group-meta">
                      {team.createdDateLabel ? (
                        <>
                          <span className="tc-group-created">Tạo ngày {team.createdDateLabel}</span>
                          {team.createdDays ? (
                            <span className="tc-group-days"> · Đã hoạt động {team.createdDays} ngày</span>
                          ) : null}
                        </>
                      ) : (
                        <span className="tc-group-created">Ngày tạo nhóm: đang cập nhật...</span>
                      )}
                    </div>

                    <div className="tc-group-sub">{members.length} thành viên đã tham gia</div>
                  </div>

                  <div className="tc-group-actions" onClick={(e)=>e.stopPropagation()}>
                    {teamCode && (
                      <button
                        type="button"
                        className="tc-act-btn tc-act-code"
                        onClick={copyTeamCode}
                      >
                        <span className="tc-act-code-text">Mã nhóm: {teamCode}</span>
                        <i className={copiedCode ? "fa-solid fa-check" : "fa-regular fa-copy"} />
                      </button>
                    )}
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
                        onOpenUser={openUserModal} onStartChat={handleStartChat}
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
                      <ResolvedTeamReqCard key={r.id} r={r} variant="accepted" onOpenUser={openUserModal} onStartChat={handleStartChat}/>
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
                      <ResolvedTeamReqCard key={r.id} r={r} variant="rejected" onOpenUser={openUserModal} onStartChat={handleStartChat}/>
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
                ? <>Bạn muốn duyệt kết nối cho <b>{confirm.req?.user?.name||"người dùng"}</b> vào nhóm này?</>
                : <>Bạn muốn từ chối yêu cầu kêt nối của <b>{confirm.req?.user?.name||"người dùng"}</b>?</>
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

      <TeamEditModal
        open={editOpen}
        onClose={closeEdit}
        saving={savingEdit}
        form={editForm}
        setForm={setEditForm}
        onSave={saveEdit}
        AGE_LABELS={AGE_LABELS}
        GENDER_LABELS={GENDER_LABELS}
        FREQ_LABELS={FREQ_LABELS}
        ownerUser={ownerUser}
        goalLabel={team?.goalLabel}
        baseLocationLabel={team?.locationText}
        currentMembersCount={members.length}
      />

      <TeamManageMembersModal
        open={manageOpen}
        saving={manageSaving}
        members={members}
        myId={myId}
        onClose={()=>{ if(!manageSaving) setManageOpen(false); }}
        onApply={applyManageMembers}
      />

      <UserSideModal
        open={userModalOpen}
        user={userModalTarget}
        meId={String(myId||"")}
        onClose={closeUserModal}
        onViewProfile={handleViewPublicProfile}
        onStartChat={handleStartChat}
      />
    </div>
  );
}

function PendingTeamReqCard({ r, isOwner, onOpenAccept, onOpenReject, onOpenUser, onStartChat }){
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
            <div className="tc-pr-ava" onClick={()=>canOpen && onOpenUser(u)} style={canOpen?{cursor:"pointer"}:undefined}>
              <img src={avatar} alt={name} onError={(e)=>{e.currentTarget.src="/images/avatar.png";}} />
            </div>

            <div className="tc-pr-usertext">
              <div className="tc-pr-left-name" title={name} onClick={()=>canOpen && onOpenUser(u)} style={canOpen?{cursor:"pointer"}:undefined}>{name}</div>
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
          <button type="button" className="tc-rq-btn tc-pr-reject" onClick={onOpenReject} disabled={!isOwner}>Từ chối</button>
          <button type="button" className="tc-rq-btn tc-pr-accept" onClick={onOpenAccept} disabled={!isOwner}>Duyệt vào nhóm</button>
        </div>
      </div>
    </article>
  );
}

function ResolvedTeamReqCard({ r, variant="accepted",onOpenUser }){
  const nav=useNavigate();
  const u=r?.user||{};
  const canOpen=!!onOpenUser && !!u?.id;
  const name=u.name||"Người dùng FitMatch";
  const avatar=u.avatarUrl||"/images/avatar.png";
  const goal=u.goalLabel||"—";
  const location=u.locationLabel||"—";
  const ageTxt=typeof u.age==="number"?`${u.age} tuổi`:"—";
  const genderTxt=(u.gender && (GENDER_LABELS[u.gender]||""))||"—";
  const intensity=u.intensityLabel||"—";
  const bio=u.bio||"";
  const when=r?.resolvedAt||r?.createdAt||null;
  const verb=variant==="accepted"?"đã được duyệt vào nhóm":"đã bị từ chối";
  const pill=variant==="accepted"?"Đã duyệt":"Từ chối";

  return (
    <article className="tc-pr-card">
      <div className="tc-pr-head">
        <div className="tc-pr-title"><span className="tc-pr-name">{name}</span> {verb}</div>
        <div className="tc-pr-time">{when?`${pill} ${timeAgo(when)}`:""}</div>
      </div>
      <div className="tc-pr-divider" />

      <div className="tc-pr-body">
        <div className="tc-pr-left">
          <div className="tc-pr-userrow">
            <div className="tc-pr-ava" onClick={()=>canOpen && onOpenUser(u)} style={canOpen?{cursor:"pointer"}:undefined}>
              <img src={avatar} alt={name} onError={(e)=>{e.currentTarget.src="/images/avatar.png";}} />
            </div>
            <div className="tc-pr-usertext">
              <div className="tc-pr-left-name" title={name} onClick={()=>canOpen && onOpenUser(u)} style={canOpen?{cursor:"pointer"}:undefined}>{name}</div>
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

        <span className={"tc-pr-status "+(variant==="accepted"?"is-accepted":"is-rejected")}>{pill}</span>
      </div>
    </article>
  );
}

function TeamStreakTimeline({ members, myId, loading, err, onRefresh }){
  const [helpOpen,setHelpOpen]=useState(false);
  const list=Array.isArray(members)?members:[];
  const maxBest=Math.max(0,...list.map(x=>Number(x?.bestStreak||0)));
  const rangeMax=Math.max(10,Math.ceil((maxBest||10)/10)*10);

  const lanes=Math.max(1,list.length);
  const laneH=44;
  const barTop=lanes*laneH+18;
  const height=barTop+54;

  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const pos=(v)=>rangeMax?clamp(Number(v||0),0,rangeMax)/rangeMax:0;

  const roundNice=(v)=>{if(rangeMax<=20)return Math.round(v/5)*5;return Math.round(v/10)*10;};
  const buildMajors=()=>{
    const raw=[1,rangeMax*0.25,rangeMax*0.5,rangeMax*0.75,rangeMax].map(v=>clamp(roundNice(v),1,rangeMax));
    const seen=new Set();const arr=[];
    for(const v of raw){if(!seen.has(v)){seen.add(v);arr.push(v);}}
    arr.sort((a,b)=>a-b);
    if(arr[0]!==1)arr.unshift(1);
    if(arr[arr.length-1]!==rangeMax)arr.push(rangeMax);
    return arr;
  };

  const minorTicks=rangeMax<=10?Array.from({length:10},(_,i)=>({value:i+1,label:String(i+1),major:true})):Array.from({length:10},(_,i)=>({value:Math.round((i+1)*rangeMax/10),label:"",major:false}));
  const majorTicks=rangeMax<=10?[]:buildMajors().map(v=>({value:v,label:String(v),major:true}));

  const ticks=[...minorTicks,...majorTicks].reduce((acc,t)=>{
    const k=String(t.value);
    if(!acc._seen.has(k)){acc._seen.add(k);acc.items.push(t);}
    else if(t.major){const idx=acc.items.findIndex(x=>String(x.value)===k);if(idx>-1)acc.items[idx]=t;}
    return acc;
  },{items:[],_seen:new Set()}).items.sort((a,b)=>a.value-b.value);

  const me=list.find(x=>myId&&String(x?.id)===String(myId))||null;
  const myBest=Number(me?.bestStreak||0);
  const myBestPos=pos(myBest);
  const hueFromId=(id)=>{const s=String(id||"");let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%360;return h;};
  const myColor=me?.role==="owner"?"rgba(239,68,68,.95)":`hsl(${hueFromId(myId)} 85% 60%)`;

  const HelpBox=() => (
    <div className="tc-streak-help">
      <div className="tc-streak-help-top">
        <div className="tc-streak-help-title"><i className="fa-solid fa-circle-exclamation" /> Hướng dẫn đua streak</div>
        <button type="button" className="tc-streak-help-close" onClick={()=>setHelpOpen(false)} aria-label="Đóng"><i className="fa-solid fa-xmark" /></button>
      </div>
      <ul className="tc-streak-help-list">
        <li><b>Streak</b> tính từ ngày bạn tham gia nhóm và có log hoạt động trong ngày.</li>
        <li>Avatar đứng ở vị trí <b>kỷ lục cao nhất (Cao nhất)</b> nên sẽ “không bị rớt”.</li>
        <li>Muốn chạy tiếp, bạn cần <b>vượt kỷ lục cũ</b> để kỷ lục tăng lên.</li>
        <li>Chấm “ghost” (nếu có) là <b>streak hiện tại</b> đang chạy để đuổi kỷ lục.</li>
        <li>Trong danh sách bên dưới: <b>Đã log hôm nay</b> / <b>Chưa log hôm nay</b> để biết ai đã hoạt động.</li>
      </ul>
    </div>
  );

  if(err) return (
    <>
      <div className="tc-streak-wrap">
        <div className="tc-streak-head">
          <div>
            <div className="tc-streak-title"><i className="fa-solid fa-fire" /> Đua Streak</div>
            <div className="tc-streak-sub">{err}</div>
          </div>
          <div className="tc-streak-right">
            <button type="button" className="tc-streak-refresh" onClick={onRefresh}><i className="fa-solid fa-rotate" /> Thử lại</button>
            <button type="button" className={"tc-streak-helpbtn"+(helpOpen?" is-on":"")} onClick={()=>setHelpOpen(v=>!v)} aria-label="Hướng dẫn">
              <span className="tc-streak-help-ripple" aria-hidden="true" />
              <i className="fa-solid fa-circle-exclamation" />
            </button>
          </div>
        </div>
      </div>
      {helpOpen && <HelpBox/>}
    </>
  );

  return (
    <>
      <div className="tc-streak-wrap">
        <div className="tc-streak-head">
          <div>
            <div className="tc-streak-title"><i className="fa-solid fa-fire" /> Đua Streak</div>
            <div className="tc-streak-sub">Streak tính từ lúc tham gia nhóm. Avatar đứng ở <b>Streak cao nhất</b> (không bị rớt), muốn chạy tiếp phải vượt kỷ lục cũ.</div>
          </div>
          <div className="tc-streak-right">
            <div className="tc-streak-range">Mốc: 1 → {rangeMax}</div>
            <button type="button" className="tc-streak-refresh" onClick={onRefresh} disabled={loading}>
              <i className={"fa-solid fa-rotate"+(loading?" fa-spin":"")} /> {loading?"Đang tải":"Làm mới"}
            </button>
            <button type="button" className={"tc-streak-helpbtn"+(helpOpen?" is-on":"")} onClick={()=>setHelpOpen(v=>!v)} aria-label="Hướng dẫn">
              <span className="tc-streak-help-ripple" aria-hidden="true" />
              <i className="fa-solid fa-circle-exclamation" />
            </button>
          </div>
        </div>

        <div className="tc-streak-canvas">
          <div className="tc-streak-inner" style={{height,["--barTop"]:`${barTop}px`}}>
            <div className="tc-streak-bar">
              {!!me && myBestPos>0 && (
                <div className="tc-streak-bar-fill" style={{width:`${myBestPos*100}%`,background:myColor}} />
              )}
            </div>

            {ticks.map(t=>{
              const left=`calc(var(--pad) + (100% - (var(--pad) * 2)) * ${pos(t.value)})`;
              return (
                <div key={`${t.value}-${t.major?"M":"m"}`} className={"tc-streak-tick"+(t.major?" is-major":"")} style={{left}}>
                  <span className="tri" />
                  {!!t.label && <span className="lbl">{t.label}</span>}
                </div>
              );
            })}

            {list.map((m,i)=>{
              const isMe=!!(myId&&String(myId)===String(m.id));
              const bestLeft=`calc(var(--pad) + (100% - (var(--pad) * 2)) * ${pos(m.bestStreak)})`;
              const curLeft=`calc(var(--pad) + (100% - (var(--pad) * 2)) * ${pos(m.currentStreak)})`;
              const top=i*laneH;
              const connTop=top+34;
              const connH=Math.max(0,barTop-connTop);
              const ava=m.avatarUrl||"/images/avatar.png";

              return (
                <div key={m.id||i}>
                  <div className="tc-streak-conn" style={{left:bestLeft,top:connTop,height:connH}} />
                  {Number(m.currentStreak||0)>0 && Number(m.currentStreak||0)<Number(m.bestStreak||0) && (
                    <div className="tc-streak-ghost" style={{left:curLeft,top:top+12}} title={`${m.name} • Streak hiện tại: ${m.currentStreak} • Kỷ lục: ${m.bestStreak}`} />
                  )}
                  <div className={"tc-streak-runner"+(m.role==="owner"?" is-owner":"")+(isMe?" is-me":"")} style={{left:bestLeft,top}} title={`${m.name}${m.role==="owner"?" • Chủ nhóm":""} • Hiện tại: ${m.currentStreak} • Cao nhất: ${m.bestStreak}${m.hasToday?" • Đã log hôm nay":" • Chưa log hôm nay"}`}>
                    <img src={ava} alt={m.name} onError={(e)=>{e.currentTarget.src="/images/avatar.png";}} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="tc-streak-legend">
            {list.map(m=>{
              const isMe=!!(myId&&String(myId)===String(m.id));
              const hot=Number(m.currentStreak||0)>=2;
              return (
                <div key={m.id} className={"tc-streak-item"+(isMe?" is-me":"")}>
                  <img src={m.avatarUrl||"/images/avatar.png"} onError={(e)=>{e.currentTarget.src="/images/avatar.png";}} alt={m.name}/>
                  <div className="tc-streak-item-main">
                    <div className="tc-streak-item-name">{m.name}{m.role==="owner"?" (Chủ nhóm)":""}</div>
                    <div className="tc-streak-item-meta">
                      <span className={"pill"+(hot?" hot":"")}>Hiện tại: {m.currentStreak||0}</span>
                      <span className="pill">Cao nhất: {m.bestStreak||0}</span>
                      <span className={"pill"+(m.hasToday?" ok":"")}>{m.hasToday?"Đã log hôm nay":"Chưa log hôm nay"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {helpOpen && <HelpBox/>}
    </>
  );
}
