import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import api from "../../lib/api";
import { createConnectReport } from "../../api/match";
import ReportSideModal from "../Connect/ReportSideModal";
import "./UserSideModal.css";
import { useNavigate } from "react-router-dom";



const API_ORIGIN=(api?.defaults?.baseURL||"").replace(/\/+$/,"");
const toAbs=(u)=>{if(!u)return"";try{return new URL(u,API_ORIGIN).toString()}catch{return u}};
const pick=(...v)=>v.find(x=>x!==undefined&&x!==null&&x!=="");
const getId=(u)=>String(pick(u?._id,u?.id,u?.userId,u?.uid,u?.user?._id,u?.user?.id)||"");
const getProfile=(u)=>u?.profile||u?.user?.profile||u?.userProfile||{};
const getName=(u)=>pick(getProfile(u)?.nickname,u?.nickname,u?.name,u?.fullName,u?.username,u?.email,"Người dùng FitMatch");
const getAvatar=(u)=>toAbs(pick(getProfile(u)?.avatarUrl,getProfile(u)?.avatar,u?.avatarUrl,u?.avatar,u?.photoUrl,u?.imageUrl))||"/images/avatar.png";
const getGoal=(u)=>pick(u?.goal,u?.goalLabel,u?.connectGoalLabel,getProfile(u)?.goalLabel,getProfile(u)?.goal,"");
const getLoc=(u)=>pick(u?.locationLabel,u?.locationText,u?.connectLocationLabel,getProfile(u)?.locationLabel,getProfile(u)?.locationText,"");
const getBio=(u)=>pick(u?.bio,u?.connectBio,getProfile(u)?.bio,"");
const getSex=(u)=>pick(u?.sex,u?.gender,getProfile(u)?.sex,u?.user?.sex,u?.user?.gender,getProfile(u?.user)?.sex)||"";
const getDob=(u)=>pick(getProfile(u)?.dob,u?.dob,getProfile(u?.user)?.dob,u?.user?.dob)||"";
const calcAge=(dob)=>{
  const d=new Date(dob); if(!dob||Number.isNaN(d.getTime())) return null;
  const now=new Date(); let a=now.getFullYear()-d.getFullYear();
  const m=now.getMonth()-d.getMonth(); if(m<0||(m===0&&now.getDate()<d.getDate())) a--;
  return a>0?a:null;
};
const sexLabel=(s)=>s==="male"?"Nam":s==="female"?"Nữ":s? "Khác":"";


export default function UserSideModal({ open, user, meId, onClose, onViewProfile, onStartChat }){
  const nav = useNavigate();
  const [reportOpen,setReportOpen]=useState(false);
  const [reportLoading,setReportLoading]=useState(false);

  // ===== FETCH USER PUBLIC =====
  const [detail,setDetail]=useState(null);
  const [loading,setLoading]=useState(false);
  const [avatarZoomOpen,setAvatarZoomOpen]=useState(false);
  const cacheRef=useRef(new Map());

  const targetId=useMemo(()=>getId(user),[user]);
  const isSelfTarget=!!(targetId && meId && String(targetId)===String(meId));

  useEffect(()=>{
    if(!open){ setDetail(null); setLoading(false); return; }
    if(!targetId || isSelfTarget){ setDetail(null); setLoading(false); return; }

    const cached=cacheRef.current.get(String(targetId));
    if(cached){ setDetail(cached); setLoading(false); return; }

    let cancelled=false;
    (async()=>{
      try{
        setLoading(true);
        const res=await api.get(`/api/user/public/${targetId}`);
        const u=res?.data?.user ?? res?.data?.data?.user ?? res?.data?.data ?? null;
        if(cancelled) return;
        if(u){ cacheRef.current.set(String(targetId),u); setDetail(u); }
        else setDetail(null);
      }catch(e){
        if(cancelled) return;
        console.error("getUserPublic error:", e);
        setDetail(null);
      }finally{ if(!cancelled) setLoading(false); }
    })();

    return ()=>{ cancelled=true; };
  },[open,targetId,isSelfTarget]);

  const srcUser=detail||user;

  const info=useMemo(()=>{
    const id=getId(user);
    const name=getName(user);
    const avatar=getAvatar(user);
    const goal=String(getGoal(user)||"").trim();
    const loc=String(getLoc(user)||"").trim();
    const bio=String(getBio(user)||"").trim();

    const sex=getSex(user);
    const age=Number.isFinite(Number(user?.age)) ? Number(user.age) : calcAge(getDob(user));
    const sexText=sexLabel(sex);

    return { id,name,avatar,goal,loc,bio,sex,sexText,age,isSelf:!!(id&&meId&&String(id)===String(meId)) };
  },[user,meId]);


  // nếu lỡ open nhầm self -> đóng luôn
  useEffect(()=>{ if(open && info.isSelf) onClose?.(); },[open,info.isSelf,onClose]);

  useEffect(()=>{
    if(!open) return;
    const onKey=(e)=>{
      if(e.key!=="Escape") return;
      if(reportOpen) return;
      if(avatarZoomOpen) setAvatarZoomOpen(false);
      else onClose?.();
    };
    window.addEventListener("keydown",onKey);
    const prev=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return ()=>{ window.removeEventListener("keydown",onKey); document.body.style.overflow=prev; };
  },[open,onClose,reportOpen,avatarZoomOpen]);

  useEffect(()=>{ if(!open){ setReportOpen(false); setAvatarZoomOpen(false); } },[open]);
  useEffect(()=>{ if(open) setReportOpen(false); },[targetId,open]);

  const close=()=>{ if(reportOpen) return; onClose?.(); };

  const handleViewProfile=()=>{
    if(info.isSelf) return toast.info("Đây là hồ sơ của bạn.");
    if(onViewProfile) return onViewProfile(info.id);
    toast.info("Trang xem hồ sơ đang phát triển (button placeholder).");
  };

  const handleChat = () => {
    if (info.isSelf) return toast.info("Bạn không thể nhắn tin cho chính mình.");
    if (onStartChat) return onStartChat(info.id);

    nav(`/tin-nhan?u=${encodeURIComponent(info.id)}`);
  };

  const openReport=()=>{
    if(info.isSelf) return toast.info("Bạn không thể báo cáo chính mình.");
    setReportOpen(true);
  };

  async function handleSubmitReport(payload){
    if(!info.id) return;
    try{
      setReportLoading(true);
      const res=await createConnectReport({
        targetType:"user",
        targetUserId:info.id,
        reasons:Array.isArray(payload?.reasons)?payload.reasons:[],
        otherReason:String(payload?.otherReason||""),
        note:String(payload?.note||""),
      });
      if(res?.duplicated) toast.info("Bạn đã báo cáo người dùng này gần đây.");
      else toast.success("Đã gửi báo cáo. Cảm ơn bạn!");
      setReportOpen(false);
    }catch(e){
      console.error(e);
      toast.error(e?.response?.data?.message||e?.response?.data?.error||"Không thể gửi báo cáo. Vui lòng thử lại.");
    }finally{ setReportLoading(false); }
  }

  if(!open || info.isSelf) return null;

  return (
    <>
      <div className="usp-overlay" onMouseDown={(e)=>{ if(e.target===e.currentTarget) close(); }}>
        <aside className="usp-panel" role="dialog" aria-modal="true" onMouseDown={(e)=>e.stopPropagation()}>
          <div className="usp-head">
            <div className="usp-head-left">
              <h3 className="usp-title">Hồ sơ người dùng</h3>
              <p className="usp-sub">Xem nhanh thông tin và thao tác.</p>
            </div>
            <button className="usp-close" type="button" onClick={close} disabled={reportOpen}><i className="fa-solid fa-xmark"/></button>
          </div>

          <div className="usp-target">
            <button type="button" className="usp-avatar-btn" onClick={()=>setAvatarZoomOpen(true)} title="Xem ảnh lớn">
              <img className="usp-target-img" src={info.avatar} alt={info.name} onError={(e)=>{e.currentTarget.src="/images/avatar.png";}}/>
              <span className="usp-avatar-zoomicon"><i className="fa-solid fa-magnifying-glass-plus"/></span>
            </button>
            <div className="usp-target-info">
              <div className="usp-target-name" title={info.name}>{info.name}</div>
              {info.loc ? <div className="usp-target-meta"><i className="fa-solid fa-location-dot"/> {info.loc}</div> : null}
              {loading && <div className="usp-target-meta"><i className="fa-solid fa-spinner fa-spin"/> Đang tải...</div>}
              {(info.age || info.sexText) ? (
                <div className="usp-target-meta">
                  <i className="fa-solid fa-user"/> {info.age ? `${info.age} tuổi` : "—"}{info.sexText ? ` · ${info.sexText}` : ""}
                </div>
              ) : null}
            </div>
          </div>

          <div className="usp-body">
            {(info.goal||info.bio) ? (
              <>
                <div className="usp-section-title">Thông tin</div>
                <div className="usp-info">
                  {!!info.goal && <div className="usp-row"><div className="usp-k">Mục tiêu</div><div className="usp-v">{info.goal}</div></div>}
                  {!!info.bio && <div className="usp-row usp-row-bio"><div className="usp-k">Giới thiệu</div><div className="usp-v usp-bio">{info.bio}</div></div>}
                </div>
              </>
            ) : (
              <div className="usp-empty">{loading ? "Đang tải thông tin..." : "Người dùng chưa cập nhật thêm thông tin."}</div>
            )}
          </div>

          <div className="usp-actions">
            <button className="usp-btn usp-btn-ghost" type="button" onClick={handleViewProfile} disabled={!info.id||info.isSelf}>
              <i className="fa-regular fa-user"/> Xem hồ sơ
            </button>
            <button className="usp-btn usp-btn-ghost" type="button" onClick={handleChat} disabled={!info.id||info.isSelf}>
              <i className="fa-regular fa-comment-dots"/> Nhắn tin riêng
            </button>
            <button className="usp-btn usp-btn-danger" type="button" onClick={openReport} disabled={!info.id||info.isSelf}>
              <i className="fa-solid fa-flag"/> Báo cáo
            </button>
          </div>
        </aside>
        {avatarZoomOpen && (
          <div className="usp-avatar-zoom-overlay" onMouseDown={(e)=>{ if(e.target===e.currentTarget) setAvatarZoomOpen(false); }}>
            <button className="usp-avatar-zoom-close" type="button" onClick={()=>setAvatarZoomOpen(false)} aria-label="Đóng ảnh">
              <i className="fa-solid fa-xmark"/>
            </button>
            <img
              className="usp-avatar-zoom-img"
              src={info.avatar}
              alt={info.name}
              onError={(e)=>{e.currentTarget.src="/images/avatar.png";}}
              draggable={false}
            />
          </div>
        )}
      </div>

      <ReportSideModal
        open={reportOpen}
        target={{ id: info.id, _id: info.id, nickname: info.name, imageUrl: info.avatar, isGroup:false, locationLabel: info.loc }}
        loading={reportLoading}
        onClose={()=>setReportOpen(false)}
        onSubmit={handleSubmitReport}
      />
    </>
  );
}
