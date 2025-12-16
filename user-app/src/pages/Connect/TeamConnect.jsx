// user-app/src/pages/Connect/TeamConnect.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Connect.css";
import "./TeamConnect.css";
import api from "../../lib/api";
import { getMatchStatus } from "../../api/match";
import { getMe } from "../../api/account";
import { toast } from "react-toastify";

const API_ORIGIN=(api?.defaults?.baseURL||"").replace(/\/+$/,"");
const toAbs=(u)=>{if(!u)return u;try{return new URL(u,API_ORIGIN).toString()}catch{return u}};
const AGE_LABELS={all:"Tất cả","18-21":"18-21","22-27":"22-27","28-35":"28-35","36-45":"36-45","45+":"Trên 45"};
const FREQ_LABELS={"1-2":"1-2 buổi/tuần","2-3":"2-3 buổi/tuần","3-5":"3-5 buổi/tuần","5+":"Trên 5 buổi/tuần"};

function getInitials(name){ if(!name) return "FM"; return name.split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase(); }

export default function TeamConnect({ onLeftRoom }){
  const nav=useNavigate();
  const [loading,setLoading]=useState(true);
  const [room,setRoom]=useState(null);
  const [me,setMe]=useState(null);

  const [menuOpen,setMenuOpen]=useState(false);
  const [leaveOpen,setLeaveOpen]=useState(false);
  const [leaving,setLeaving]=useState(false);

  useEffect(()=>{ let cancelled=false;
    (async()=>{
      try{
        setLoading(true);
        const [statusData, meRaw]=await Promise.all([getMatchStatus(), getMe().catch(()=>null)]);
        const activeRoomId=statusData?.activeRoomId;
        const activeRoomType=statusData?.activeRoomType;

        // ✅ BE dùng "group", không phải "team"
        if(!activeRoomId || activeRoomType!=="group"){
          toast.info("Hiện bạn chưa tham gia phòng kết nối nhóm nào.");
          if(typeof onLeftRoom==="function") onLeftRoom(); else nav("/ket-noi");
          return;
        }

        const roomRes=await api.get(`/match/rooms/${activeRoomId}`);
        const payload=roomRes?.data ?? roomRes;
        const roomData=payload?.data ?? payload ?? null;

        if(cancelled) return;
        setRoom(roomData);
        setMe(meRaw||null);
      }catch(e){
        console.error(e);
        toast.error(e?.response?.data?.message||"Không thể tải phòng nhóm.");
        if(typeof onLeftRoom==="function") onLeftRoom(); else nav("/ket-noi");
      }finally{ if(!cancelled) setLoading(false); }
    })();
    return ()=>{ cancelled=true; };
  },[nav,onLeftRoom]);

  const myId=me?._id || me?.id || null;

  const members=useMemo(()=>{
    const arr=Array.isArray(room?.members)?room.members:[];
    return arr.map(m=>{
      const u=m.user||{};
      const p=u.profile||{};
      const name=p.nickname||u.username||u.email||"Người dùng FitMatch";
      return { id:String(u._id||u.id||""), name, avatarUrl:toAbs(p.avatarUrl)||null, role:m.role||"member" };
    });
  },[room]);

  const team=useMemo(()=>{
    if(!room) return null;
    return {
      name: room.name||"Nhóm tập luyện",
      imageUrl: toAbs(room.coverImageUrl)||null,
      locationText: room.locationLabel||"Chưa có địa chỉ",
      maxMembers: room.maxMembers||5,
      joinPolicy: room.joinPolicy||"request",
      ageRangeLabel: AGE_LABELS[room.ageRange]||room.ageRange||"--",
      genderLabel: room.gender==="male"?"Nam":room.gender==="female"?"Nữ":"Tất cả",
      trainingLabel: FREQ_LABELS[room.trainingFrequency]||room.trainingFrequency||"--",
      goalLabel: room.goalLabel||"Chưa thiết lập",
      description: room.description||"--",
    };
  },[room]);

  const handleLeave=async()=>{
    if(!room?._id) return;
    try{
      setLeaving(true);
      await api.post(`/match/rooms/${room._id}/leave`);
      toast.info("Bạn đã rời khỏi nhóm.");
      setLeaveOpen(false);
      if(typeof onLeftRoom==="function") onLeftRoom(); else nav("/ket-noi");
    }catch(e){
      toast.error(e?.response?.data?.message||"Không thể rời nhóm.");
    }finally{ setLeaving(false); }
  };

  if(loading && !room) return <div className="tc-wrap"><p className="tc-loading">Đang tải phòng nhóm...</p></div>;
  if(!room || !team) return null;

  return (
    <div className="tc-wrap">
      <header className="tc-header">
        <div className="tc-badge">Phòng kết nối nhóm</div>
        <div className="tc-header-right">
          <button type="button" className="tc-more" onClick={()=>setMenuOpen(v=>!v)}><i className="fa-solid fa-ellipsis-vertical"/></button>
          {menuOpen && (
            <div className="tc-menu" onMouseLeave={()=>setMenuOpen(false)}>
              <button type="button" className="tc-menu-item tc-danger" onClick={()=>{ setLeaveOpen(true); setMenuOpen(false); }}>Rời nhóm</button>
            </div>
          )}
        </div>
      </header>

      <section className="tc-card">
        <div className="tc-banner">
          <div className="tc-teamimg">
            {team.imageUrl ? <img src={team.imageUrl} alt={team.name}/> : <div className="tc-teamimg-fallback">{getInitials(team.name)}</div>}
          </div>
          <div className="tc-banner-main">
            <div className="tc-teamname">{team.name}</div>
            <div className="tc-teamsub">
              <span><i className="fa-solid fa-location-dot"/> {team.locationText}</span>
              <span className="tc-dot">•</span>
              <span><i className="fa-solid fa-users"/> {members.length}/{team.maxMembers} thành viên</span>
              <span className="tc-dot">•</span>
              <span className="tc-pill">{team.joinPolicy==="request"?"Yêu cầu duyệt":"Vào trực tiếp"}</span>
            </div>
          </div>
        </div>

        <div className="tc-info">
          <div className="tc-info-grid">
            <div className="tc-info-item"><div className="tc-info-k">Độ tuổi</div><div className="tc-info-v">{team.ageRangeLabel}</div></div>
            <div className="tc-info-item"><div className="tc-info-k">Giới tính</div><div className="tc-info-v">{team.genderLabel}</div></div>
            <div className="tc-info-item"><div className="tc-info-k">Mức độ</div><div className="tc-info-v">{team.trainingLabel}</div></div>
            <div className="tc-info-item"><div className="tc-info-k">Mục tiêu</div><div className="tc-info-v">{team.goalLabel}</div></div>
          </div>

          <div className="tc-desc">
            <div className="tc-desc-k">Mô tả nhóm</div>
            <div className="tc-desc-v">{team.description}</div>
          </div>

          <div className="tc-members">
            <div className="tc-section-title">Thành viên</div>
            <div className="tc-members-grid">
              {members.map(m=>{
                const isMe=myId && String(myId)===m.id;
                const isOwner=m.role==="owner";
                return (
                  <div key={m.id} className={"tc-member"+(isMe?" is-me":"")}>
                    <div className={"tc-ava"+(isOwner?" is-owner":"")}>
                      {m.avatarUrl ? <img src={m.avatarUrl} alt={m.name}/> : <span>{getInitials(m.name)}</span>}
                      {isMe && <span className="tc-chip tc-chip-me">Bạn</span>}
                      {!isMe && <span className="tc-chip tc-chip-other">Thành viên</span>}
                    </div>
                    <div className="tc-mname">{m.name}</div>
                    {isOwner && <div className="tc-role">Quản lý</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="tc-footer">
          <button type="button" className="tc-btn tc-btn-disabled" disabled>Chat nhóm (Sắp ra mắt)</button>
          <button type="button" className="tc-btn tc-btn-outline" onClick={()=>setLeaveOpen(true)}>Rời nhóm</button>
        </div>
      </section>

      {leaveOpen && (
        <div className="cn-modal-backdrop" onClick={()=>{ if(!leaving) setLeaveOpen(false); }}>
          <div className="cn-modal" onClick={(e)=>e.stopPropagation()}>
            <h3 className="cn-modal-title">Rời khỏi nhóm?</h3>
            <p className="cn-modal-text">Sau khi rời nhóm, bạn sẽ không còn trong phòng kết nối nhóm này nữa.</p>
            <div className="cn-modal-actions">
              <button type="button" className="cn-btn-ghost" onClick={()=>setLeaveOpen(false)} disabled={leaving}>Ở lại</button>
              <button type="button" className="cn-btn-reject" onClick={handleLeave} disabled={leaving}>{leaving?"Đang xử lý...":"Rời nhóm"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
