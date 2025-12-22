import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./DuoConnect.css";

import api from "../../lib/api";
import { getMatchStatus } from "../../api/match";
import { getMe } from "../../api/account";
import { toast } from "react-toastify";

const API_ORIGIN=(api?.defaults?.baseURL||"").replace(/\/+$/,"");
const toAbs=(u)=>{if(!u)return u;try{return new URL(u,API_ORIGIN).toString()}catch{return u}};
const safeArr=(v)=>Array.isArray(v)?v:[];
const pickOkData=(res)=>{const p=res?.data??res;return p?.data??p??null;};

export default function DuoConnect({ onLeftRoom }) {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState(null);
  const [me, setMe] = useState(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const [activeTab, setActiveTab] = useState("connect"); // 'connect' | 'chat'

  // ===== STREAK (Duo) =====
  const [streakLoading,setStreakLoading]=useState(false);
  const [streakErr,setStreakErr]=useState("");
  const [streakData,setStreakData]=useState(null);

  const roomId = room?._id ? String(room._id) : null;
  const myId = me?._id || me?.id || null;

  const loadDuoStreaks=async(id)=>{
    if(!id) return;
    setStreakErr(""); setStreakLoading(true);
    try{
      const res=await api.get(`/match/rooms/${id}/streaks`);
      const data=pickOkData(res)||{};
      setStreakData(data);
    }catch(e){
      setStreakErr(e?.response?.data?.message||"Không thể tải streak của phòng ghép đôi.");
    }finally{
      setStreakLoading(false);
    }
  };

  // ===== Load room + user =====
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);

        const [stRaw, meRaw] = await Promise.all([getMatchStatus(), getMe().catch(()=>null)]);
        const statusData = stRaw?.data ?? stRaw;
        const activeRoomId = statusData?.activeRoomId;
        const activeRoomType = statusData?.activeRoomType;

        if (!activeRoomId || activeRoomType !== "duo") {
          toast.info("Hiện bạn chưa tham gia phòng kết nối 1:1 nào.");
          if (typeof onLeftRoom === "function") onLeftRoom();
          else nav("/ket-noi");
          return;
        }

        const meData = meRaw || null;

        const roomRes = await api.get(`/match/rooms/${activeRoomId}`);
        const payload = roomRes?.data ?? roomRes;
        const roomData = payload?.data ?? payload ?? null;

        if (cancelled) return;

        setRoom(roomData);
        setMe(meData);
      } catch (e) {
        console.error("Load duo room error:", e);
        if (!cancelled) {
          toast.error(e?.response?.data?.message || e?.response?.data?.error || "Không thể tải thông tin phòng ghép đôi.");
          if (typeof onLeftRoom === "function") onLeftRoom();
          else nav("/ket-noi");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [nav, onLeftRoom]);

  // Load streak khi vào tab connect và có roomId
  useEffect(()=>{ if(activeTab==="connect" && roomId) loadDuoStreaks(roomId); },[activeTab,roomId]);

  // Refresh streak khi quay lại tab (optional)
  useEffect(()=>{
    if(!roomId) return;
    const onVis=()=>{ if(document.visibilityState==="visible" && activeTab==="connect") loadDuoStreaks(roomId); };
    document.addEventListener("visibilitychange",onVis);
    return ()=>document.removeEventListener("visibilitychange",onVis);
  },[roomId,activeTab]);

  // ===== Chuẩn hoá member & tạo 2 slot =====
  const { slotMe, slotPartner } = useMemo(() => {
    const members = Array.isArray(room?.members) ? room.members : [];

    const calcAge = (dob) => { if(!dob) return null; const d=dayjs(dob); if(!d.isValid()) return null; const a=dayjs().diff(d,"year"); return a>=0&&a<=120?a:null; };
    const fmtGender = (g) => { const v=String(g||"").trim().toLowerCase(); if(!v) return null; if(["male","nam","m","men","man"].includes(v)) return "Nam"; if(["female","nu","nữ","f","women","woman"].includes(v)) return "Nữ"; if(["other","khac","khác"].includes(v)) return "Khác"; return String(g); };

    const normMember = (m) => {
      if (!m) return null;
      const u = m.user || {};
      const profile = u.profile || {};
      const name = profile.nickname || u.username || u.email || "Người dùng FitMatch";

      const genderRaw = profile.gender ?? profile.gioiTinh ?? profile.sex ?? null;
      const dobRaw = profile.birthDate ?? profile.dob ?? profile.ngaySinh ?? profile.birthday ?? null;

      return {
        id: String(u._id || u.id || ""),
        name,
        avatarUrl: toAbs(profile.avatarUrl) || toAbs(u.avatarUrl) || null,
        role: m.role || "member",
        joinedAt: m.joinedAt || null,
        gender: fmtGender(genderRaw),
        age: calcAge(dobRaw),
      };
    };

    if (!members.length) return { slotMe: null, slotPartner: null };

    if (members.length === 1) {
      const only = normMember(members[0]);
      if (myId && only.id === String(myId)) return { slotMe: only, slotPartner: null };
      return { slotMe: only, slotPartner: null };
    }

    const m1 = normMember(members[0]);
    const m2 = normMember(members[1]);

    if (!myId) return { slotMe: m1, slotPartner: m2 };
    if (m1.id === String(myId)) return { slotMe: m1, slotPartner: m2 };
    if (m2.id === String(myId)) return { slotMe: m2, slotPartner: m1 };
    return { slotMe: m1, slotPartner: m2 };
  }, [room, myId]);

    // ===== THỜI GIAN KẾT NỐI (DUO) =====
  const { duoSince, duoDays } = useMemo(() => {
    const members = Array.isArray(room?.members) ? room.members : [];
    const joined = members.map(m => m?.joinedAt).filter(Boolean).map(d => dayjs(d)).filter(d => d.isValid());
    const fallback = dayjs(room?.createdAt || room?.created_at || room?.created || null);
    const since = joined.length ? joined.sort((a,b)=>a.valueOf()-b.valueOf())[0] : (fallback.isValid() ? fallback : null); // lấy sớm nhất (ổn định)
    const days = since ? Math.max(1, dayjs().startOf("day").diff(since.startOf("day"), "day") + 1) : 0; // tính inclusive (ít nhất 1 ngày)
    return { duoSince: since, duoDays: days };
  }, [room]);

  // ===== Build streak members cho duo (merge slot info + streakData) =====
  const duoStreak = useMemo(()=>{
    const raw = safeArr(streakData?.members);
    const map = new Map(raw.map(x=>[String(x?.id||""),{
      id:String(x?.id||""),
      name:x?.name||"",
      avatarUrl:toAbs(x?.avatarUrl)||null,
      role:x?.role||"member",
      joinedAt:x?.joinedAt||null,
      hasToday:!!x?.hasToday,
      currentStreak:Number(x?.currentStreak||0),
      bestStreak:Number(x?.bestStreak||0),
    }]));

    const mkBase=(slot)=>slot?({id:String(slot.id||""),name:slot.name||"Người dùng FitMatch",avatarUrl:slot.avatarUrl||null,role:slot.role||"member"}):null;
    const merge=(base,st)=>{ if(!base && !st) return null;
      const id=String((base?.id||st?.id||"")||"");
      return {
        id,
        name: (base?.name||st?.name||"Người dùng FitMatch"),
        avatarUrl: (base?.avatarUrl||st?.avatarUrl||null),
        role: (base?.role||st?.role||"member"),
        hasToday: !!(st?.hasToday),
        currentStreak: Number(st?.currentStreak||0),
        bestStreak: Number(st?.bestStreak||0),
      };
    };

    const meBase = mkBase(slotMe);
    const paBase = mkBase(slotPartner);

    const meSt = (meBase?.id && map.get(String(meBase.id))) || (myId && map.get(String(myId))) || null;
    let paSt = (paBase?.id && map.get(String(paBase.id))) || null;
    if(!paSt){
      const other = raw.find(x=>!myId || String(x?.id||"")!==String(myId));
      paSt = other ? map.get(String(other?.id||"")) : null;
    }

    const m = merge(meBase, meSt);
    const p = merge(paBase, paSt);

    // fallback nếu BE chưa trả members: dùng slot (0 streak)
    const fb=(base)=>base?({id:base.id,name:base.name,avatarUrl:base.avatarUrl,role:base.role,hasToday:false,currentStreak:0,bestStreak:0}):null;
    return { me: m||fb(meBase), partner: p||fb(paBase) };
  },[streakData,slotMe,slotPartner,myId]);

  const handleOpenMenu = () => setMenuOpen((v) => !v);
  const handleCloseMenu = () => setMenuOpen(false);

  const handleOpenLeaveModal = () => { setLeaveModalOpen(true); setMenuOpen(false); };
  const handleCloseLeaveModal = () => { if (leaving) return; setLeaveModalOpen(false); };

  // ===== Rời khỏi phòng =====
  const handleConfirmLeave = async () => {
    if (!room?._id) return;
    try {
      setLeaving(true);
      await api.post(`/match/rooms/${room._id}/leave`);
      toast.info("Bạn đã rời khỏi phòng ghép đôi.");
      setLeaveModalOpen(false);
      if (typeof onLeftRoom === "function") onLeftRoom();
      else nav("/ket-noi");
    } catch (e) {
      console.error("leaveMatchRoom error:", e);
      toast.error(e?.response?.data?.message || e?.response?.data?.error || "Không thể rời phòng. Vui lòng thử lại.");
    } finally {
      setLeaving(false);
    }
  };

  if (loading && !room) return (<div className="cn-duo-page"><p className="cn-duo-loading">Đang tải phòng ghép đôi...</p></div>);
  if (!room) return null;

  return (
    <div className="cn-duo-page">
      {/* ===== HEADER ===== */}
      <header className="cn-duo-header">
        <div className="cn-duo-header-left"><div className="cn-duo-badge">Phòng ghép đôi 1:1</div></div>
        <div className="cn-duo-header-right">
          <button type="button" className="cn-duo-more-btn" onClick={handleOpenMenu}><i className="fa-solid fa-ellipsis-vertical" /></button>
          {menuOpen && (
            <div className="cn-duo-menu" onMouseLeave={handleCloseMenu}>
              <button type="button" className="cn-duo-menu-item cn-duo-menu-danger" onClick={handleOpenLeaveModal}>Rời khỏi phòng</button>
            </div>
          )}
        </div>
      </header>

      {/* ===== PANEL: tab + main trong 1 box ===== */}
      <div className="cn-duo-panel">
        {/* ===== TAB BAR ===== */}
        <div className="cn-duo-tabs">
          <button type="button" className={"cn-duo-tab"+(activeTab==="connect"?" is-active":"")} onClick={()=>setActiveTab("connect")}>Kết nối</button>
          <button type="button" className="cn-duo-tab is-disabled" disabled>Trò chuyện<span className="cn-duo-tab-badge">Sắp ra mắt</span></button>
        </div>

        {/* ===== MAIN (tab Kết nối) ===== */}
        {activeTab === "connect" && (
          <section className="cn-duo-main">
            <div className="cn-duo-room-card">
              {/* 2 user – căn giữa và chia đều */}
              <div className="cn-duo-members-strip">
                <DuoMemberSpot member={slotMe} label="Bạn" isMe />
                <div className="cn-duo-vs">
                  <div className="cn-duo-vs-text">VS</div>
                  <div className="cn-duo-vs-icon"><i className="fa-solid fa-bolt" /></div>
                  <div className="cn-duo-vs-since">
                    <div className="cn-duo-vs-days">{duoDays ? `${duoDays} ngày` : "-- ngày"}</div>
                    <div className="cn-duo-vs-date">( Kể từ {duoSince ? duoSince.format("DD/MM") : "--/--"} )</div>
                  </div>
                </div>
                <DuoMemberSpot member={slotPartner} label="Bạn ghép đôi" />
              </div>

              {/* ===== STREAK (2 timeline riêng) ===== */}
              <div className="cn-duo-streak-rows">
                <DuoStreakRace
                  loading={streakLoading}
                  err={streakErr}
                  myId={myId}
                  me={duoStreak.me}
                  partner={duoStreak.partner}
                  onRefresh={()=>roomId && loadDuoStreaks(roomId)}
                />
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ===== MODAL RỜI PHÒNG ===== */}
      {leaveModalOpen && (
        <div className="cn-modal-backdrop" onClick={handleCloseLeaveModal}>
          <div className="cn-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cn-modal-title">Rời khỏi phòng ghép đôi?</h3>
            <p className="cn-modal-text">
              Sau khi rời phòng, bạn sẽ không còn được hiển thị trong kết nối 1:1 này nữa.
              Nếu muốn ghép đôi lại, hai bạn cần gửi lời mời kết nối mới.
            </p>
            <div className="cn-modal-actions">
              <button type="button" className="cn-btn-ghost" onClick={handleCloseLeaveModal} disabled={leaving}>Ở lại phòng</button>
              <button type="button" className="cn-btn-reject" onClick={handleConfirmLeave} disabled={leaving}>{leaving ? "Đang xử lý..." : "Rời khỏi phòng"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== MEMBER SPOT (hàng trên) ===== */

function DuoMemberSpot({ member, label, isMe = false }) {
  const roleCls = isMe ? " is-me" : " is-partner";

  if (!member) {
    return (
      <div className={"cn-duo-member-spot is-empty" + roleCls}>
        <div className="cn-duo-member-avatar-wrap">
          <div className="cn-duo-member-avatar cn-duo-member-avatar-empty">
            <i className="fa-regular fa-circle-user" />
          </div>
          <span className={"cn-duo-member-chip" + (isMe ? " is-me" : " is-partner")}>{label}</span>
        </div>
        <div className="cn-duo-member-name">Chỗ trống</div>
        <div className="cn-duo-member-meta">--</div>
      </div>
    );
  }

  const initials = getInitials(member.name);
  const gender = member.gender || "--";
  const ageText = member.age != null ? `${member.age} tuổi` : "--";
  const meta = member.gender && member.age != null ? `${gender} ~ ${ageText}` : `${gender}${member.age != null ? ` ~ ${ageText}` : ""}`.trim() || "--";

  return (
    <div className={"cn-duo-member-spot" + roleCls}>
      <div className="cn-duo-member-avatar-wrap">
        <div className={"cn-duo-member-avatar" + roleCls}>
          {member.avatarUrl ? <img src={member.avatarUrl} alt={member.name} /> : <span>{initials}</span>}
        </div>
        <span className={"cn-duo-member-chip" + (isMe ? " is-me" : " is-partner")}>{label}</span>
      </div>

      <div className="cn-duo-member-name">{member.name}</div>
      <div className="cn-duo-member-meta">{meta}</div>
    </div>
  );
}

/* ===== DUO STREAK RACE (2 timeline riêng) ===== */

function DuoStreakRace({ me, partner, myId, loading, err, onRefresh }){
  const [helpOpen,setHelpOpen]=useState(false);
  const list=[me,partner].filter(Boolean);
  const maxBest=Math.max(0,...list.map(x=>Number(x?.bestStreak||0)));
  const rangeMax=Math.max(10,Math.ceil((maxBest||10)/10)*10);

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
  const minorTicks=rangeMax<=10?Array.from({length:rangeMax},(_,i)=>({value:i+1,label:String(i+1),major:true})):Array.from({length:10},(_,i)=>({value:Math.round((i+1)*rangeMax/10),label:"",major:false}));
  const majorTicks=rangeMax<=10?[]:buildMajors().map(v=>({value:v,label:String(v),major:true}));
  const ticks=[...minorTicks,...majorTicks].reduce((acc,t)=>{
    const k=String(t.value);
    if(!acc._seen.has(k)){acc._seen.add(k);acc.items.push(t);}
    else if(t.major){const idx=acc.items.findIndex(x=>String(x.value)===k);if(idx>-1)acc.items[idx]=t;}
    return acc;
  },{items:[],_seen:new Set()}).items.sort((a,b)=>a.value-b.value);

  const HelpBox=()=>(
    <div className="cn-duo-streak-help">
      <div className="cn-duo-streak-help-top">
        <div className="cn-duo-streak-help-title"><i className="fa-solid fa-circle-exclamation" /> Hướng dẫn đua streak (1:1)</div>
        <button type="button" className="cn-duo-streak-help-close" onClick={()=>setHelpOpen(false)} aria-label="Đóng"><i className="fa-solid fa-xmark" /></button>
      </div>
      <ul className="cn-duo-streak-help-list">
        <li>Mỗi người có <b>1 timeline riêng</b>, nhưng dùng chung thang mốc để so sánh.</li>
        <li>Avatar đứng ở vị trí <b>Cao nhất</b> (kỷ lục) nên sẽ không “tụt lại”.</li>
        <li>Muốn tăng kỷ lục, bạn cần <b>vượt kỷ lục cũ</b>.</li>
        <li>Chấm “ghost” (nếu có) là <b>streak hiện tại</b> đang chạy để đuổi kỷ lục.</li>
        <li>“Đã log hôm nay / Chưa log” giúp bạn biết ai đã hoạt động trong ngày.</li>
      </ul>
    </div>
  );

  return (
    <>
      <div className="cn-duo-streak-wrap">
        <div className="cn-duo-streak-head">
          <div>
            <div className="cn-duo-streak-title"><i className="fa-solid fa-fire" /> Đua Streak</div>
            <div className="cn-duo-streak-sub">{err?err:<>Hai người cùng đua streak. Mỗi người có timeline riêng, avatar đứng ở <b>Cao nhất</b>, muốn chạy tiếp phải vượt kỷ lục.</>}</div>
          </div>

          <div className="cn-duo-streak-right">
            <div className="cn-duo-streak-range">Mốc: 1 → {rangeMax}</div>
            <button type="button" className="cn-duo-streak-refresh" onClick={onRefresh} disabled={loading}>
              <i className={"fa-solid fa-rotate"+(loading?" fa-spin":"")} /> {loading?"Đang tải":"Làm mới"}
            </button>
            <button type="button" className={"cn-duo-streak-helpbtn"+(helpOpen?" is-on":"")} onClick={()=>setHelpOpen(v=>!v)} aria-label="Hướng dẫn">
              <span className="cn-duo-streak-help-ripple" aria-hidden="true" />
              <i className="fa-solid fa-circle-exclamation" />
            </button>
          </div>
        </div>

        <div className={"cn-duo-streak-grid"+(err?" is-error":"")}>
          <DuoStreakLine label="Bạn" member={me} isMe myId={myId} rangeMax={rangeMax} pos={pos} ticks={ticks} />
          <DuoStreakLine label="Bạn ghép đôi" member={partner} isMe={false} myId={myId} rangeMax={rangeMax} pos={pos} ticks={ticks} />
        </div>
      </div>

      {helpOpen && <HelpBox/>}
    </>
  );
}

function DuoStreakLine({ label, member, isMe, myId, rangeMax, pos, ticks }){
  const empty=!member?.id;
  const isMine=!!(member?.id && myId && String(member.id)===String(myId));
  const best=Number(member?.bestStreak||0);
  const cur=Number(member?.currentStreak||0);
  const hasToday=!!member?.hasToday;
  const ava=member?.avatarUrl||"/images/avatar.png";
  const name=member?.name||"Người dùng FitMatch";

  const bestLeft=`calc(var(--pad) + (100% - (var(--pad) * 2)) * ${pos(best)})`;
  const curLeft=`calc(var(--pad) + (100% - (var(--pad) * 2)) * ${pos(cur)})`;

  return (
    <div className={"cn-duo-streak-linebox"+(empty?" is-empty":"")+(isMine||isMe?" is-me":"")}>
      <div className="cn-duo-streak-linehead">
        <div className="cn-duo-streak-lbl">{label}</div>
        <div className="cn-duo-streak-name" title={name}>{name}</div>
      </div>

      <div className="cn-duo-streak-canvas">
        <div className="cn-duo-streak-inner" style={{["--pad"]:"18px",["--barTop"]:"28px"}}>
          <div className="cn-duo-streak-bar" />
          {ticks.map(t=>{
            const left=`calc(var(--pad) + (100% - (var(--pad) * 2)) * ${pos(t.value)})`;
            return (
              <div key={`${label}-${t.value}-${t.major?"M":"m"}`} className={"cn-duo-streak-tick"+(t.major?" is-major":"")} style={{left}}>
                <span className="tri" />
                {!!t.label && <span className="lbl">{t.label}</span>}
              </div>
            );
          })}

          {!empty && cur>0 && cur<best && (
            <div className="cn-duo-streak-ghost" style={{left:curLeft}} title={`${name} • Hiện tại: ${cur} • Cao nhất: ${best}`} />
          )}

          {!empty && (
            <div className={"cn-duo-streak-runner"+(isMe||isMine?" is-me":"")+(hasToday?" is-ok":"")} style={{left:bestLeft}} title={`${name} • Hiện tại: ${cur} • Cao nhất: ${best}${hasToday?" • Đã log hôm nay":" • Chưa log hôm nay"}`}>
              <img src={ava} alt={name} onError={(e)=>{e.currentTarget.src="/images/avatar.png";}} />
            </div>
          )}
        </div>

        <div className="cn-duo-streak-pills">
          <span className="pill">Hiện tại: {empty?0:cur}</span>
          <span className="pill">Cao nhất: {empty?0:best}</span>
          <span className={"pill"+(hasToday?" ok":"")}>{hasToday?"Đã log hôm nay":"Chưa log hôm nay"}</span>
        </div>
      </div>
    </div>
  );
}

function getInitials(name) {
  if (!name) return "FM";
  return String(name).trim().split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}
