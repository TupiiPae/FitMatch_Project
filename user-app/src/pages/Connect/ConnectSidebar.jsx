import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./Connect.css";
import TabNearby from "./TabNearby";
import TabMyConnections from "./TabMyConnections";
import CreateTeam from "./CreateTeam";
import { toast } from "react-toastify";
import { getMe } from "../../api/account";
import { getMatchStatus, updateDiscoverable } from "../../api/match";
import api from "../../lib/api";

const API_ORIGIN=(api?.defaults?.baseURL||"").replace(/\/+$/,"");
const toAbs=(u)=>{if(!u)return u;try{return new URL(u,API_ORIGIN).toString()}catch{return u}};
function calcAge(dob){if(!dob)return null;const[yStr,mStr,dStrRaw]=String(dob).split("-");const y=Number(yStr),m=Number(mStr||1),d=Number((dStrRaw||"1").slice(0,2));const b=new Date(y,m-1,d);if(Number.isNaN(b.getTime()))return null;const t=new Date();let a=t.getFullYear()-b.getFullYear();const md=t.getMonth()-b.getMonth();if(md<0||(md===0&&t.getDate()<b.getDate()))a--;return a;}
const LOCATION_RANGE_OPTIONS=[{value:"any",label:"Không giới hạn khu vực"},{value:"same_city",label:"Cùng thành phố"},{value:"same_district",label:"Trong quận của bạn"},{value:"same_ward",label:"Rất gần bạn (cùng phường)"}];
const AGE_RANGE_OPTIONS=[{value:"all",label:"Tất cả"},{value:"18-21",label:"18–21"},{value:"22-27",label:"22–27"},{value:"28-35",label:"28–35"},{value:"36-45",label:"36–45"},{value:"45+",label:"Trên 45"}];
const GOAL_LABELS={giam_can:"Giảm cân",duy_tri:"Duy trì",tang_can:"Tăng cân",giam_mo:"Giảm mỡ",tang_co:"Tăng cơ"};
function getInitials(name){if(!name)return"FM";return name.split(" ").map((p)=>p[0]).join("").slice(0,2).toUpperCase();}
function getGenderLabel(g){if(g==="male")return"Nam";if(g==="female")return"Nữ";if(!g)return"Chưa cập nhật";return"Khác";}

export default function ConnectSidebar(){
  const nav=useNavigate();
  const loc=useLocation();

  const [user,setUser]=useState(null);
  const [discoverable,setDiscoverable]=useState(false);
  const [hasAddressForConnect,setHasAddressForConnect]=useState(false);
  const [hasRequestsTabEnabled,setHasRequestsTabEnabled]=useState(false);

  const [activeTab,setActiveTab]=useState("nearby"); // nearby | my-connections
  const [connectionMode,setConnectionMode]=useState("one_to_one"); // one_to_one | group
  const [locationRange,setLocationRange]=useState("any");
  const [ageRange,setAgeRange]=useState("all");
  const [genderFilter,setGenderFilter]=useState("all");

  const [loading,setLoading]=useState(true);
  const [updatingDiscoverable,setUpdatingDiscoverable]=useState(false);
  const [showConfirmModal,setShowConfirmModal]=useState(false);

  const [activeRoomId,setActiveRoomId]=useState(null);
  const [activeRoomType,setActiveRoomType]=useState(null);

  const [showCreateTeam,setShowCreateTeam]=useState(false);
  const [nearbyReloadKey,setNearbyReloadKey]=useState(0);

  const [filtersOpen, setFiltersOpen] = useState(false);

  const openFilters = () => setFiltersOpen(true);
  const closeFilters = () => setFiltersOpen(false);

  const resetFilters = () => {
    setLocationRange("any");
    setAgeRange("all");
    setGenderFilter("all");
  };

  const activeFiltersCount =
    (connectionMode !== "one_to_one" ? 1 : 0) +
    (locationRange !== "any" ? 1 : 0) +
    (ageRange !== "all" ? 1 : 0) +
    (genderFilter !== "all" ? 1 : 0);

  const [navIntent, setNavIntent] = useState(null);

  const normMode = (m) => {
    const s = String(m || "").trim().toLowerCase();
    if (s === "group") return "group";
    if (s === "duo" || s === "one_to_one" || s === "one-to-one" || s === "1:1") return "duo";
    return null;
  };

  const normTab = (t) => {
    const s = String(t || "").trim().toLowerCase();
    if (!s) return null;
    if (s.includes("request")) return "requests";
    if (s.includes("nearby")) return "nearby";
    if (s.includes("team")) return "team";
    if (s.includes("duo")) return "duo";
    return s; // fallback
  };

  const parseConnectIntent = (locationObj) => {
    const search = locationObj?.search || "";
    const qs = new URLSearchParams(search);

    // state có thể là {data:{...}} hoặc {...}
    const stRaw = locationObj?.state;
    const st = stRaw?.data && typeof stRaw.data === "object" ? stRaw.data : stRaw;

    const fromState =
      st && (st.screen || st.tab || st.mode || st.roomId || st.requestId) ? st : null;

    const fromQuery = {
      screen: qs.get("screen") || null,
      tab: qs.get("tab") || null,
      mode: qs.get("mode") || null,
      roomId: qs.get("roomId") || qs.get("room") || null,
      requestId: qs.get("requestId") || qs.get("request") || null,
    };
    const hasQuery =
      fromQuery.screen || fromQuery.tab || fromQuery.mode || fromQuery.roomId || fromQuery.requestId;

    const raw = fromState || (hasQuery ? fromQuery : null);
    if (!raw) return null;

    if (raw.screen && String(raw.screen).toLowerCase() !== "connect") return null;

    const tab = normTab(raw.tab);
    const mode = normMode(raw.mode);

    const roomId = raw.roomId ? String(raw.roomId) : null;
    const requestId = raw.requestId ? String(raw.requestId) : null;

    return {
      screen: "Connect",
      tab,
      mode,
      roomId,
      requestId,
      _fromState: !!fromState,
    };
  };

  const buildCanonicalSearch = (intent) => {
    const qs = new URLSearchParams();
    qs.set("screen", "Connect");
    if (intent?.tab) qs.set("tab", intent.tab);
    if (intent?.mode) qs.set("mode", intent.mode);
    if (intent?.roomId) qs.set("roomId", intent.roomId);
    if (intent?.requestId) qs.set("requestId", intent.requestId);
    const s = qs.toString();
    return s ? `?${s}` : "";
  };

  // ✅ route /ket-noi/duo | /ket-noi/nhom -> mở tab "Kết nối của tôi" + sync connectionMode
  useEffect(()=>{
    const p=loc?.pathname||"";
    if(p.includes("/ket-noi/duo")){setActiveTab("my-connections");setConnectionMode("one_to_one");}
    if(p.includes("/ket-noi/nhom")){setActiveTab("my-connections");setConnectionMode("group");}
  },[loc?.pathname]);

    // ✅ Điều hướng theo notification intent (state/query) + canonicalize URL để refresh vẫn đúng
  useEffect(() => {
    const intent = parseConnectIntent(loc);
    if (!intent) return;

    // suy ra mode nếu thiếu nhưng tab gợi ý
    const inferredMode =
      intent.mode ||
      (intent.tab === "team" ? "group" : intent.tab === "duo" ? "duo" : null);

    // quyết định path mục tiêu
    const desiredPath =
      inferredMode === "group"
        ? "/ket-noi/nhom"
        : inferredMode === "duo"
        ? "/ket-noi/duo"
        : loc.pathname || "/ket-noi";

    // mở đúng tab UI
    if (intent.tab === "nearby") {
      setActiveTab("nearby");
      setShowCreateTeam(false);
    } else {
      setActiveTab("my-connections");
      setShowCreateTeam(false);
      // bật tab "Kết nối của tôi" nếu đi từ noti/request
      if (intent.tab === "requests" || intent.requestId || intent.roomId) {
        setHasRequestsTabEnabled(true);
      }
    }

    // sync connectionMode (chỉ ảnh hưởng filter UI)
    if (inferredMode === "group") setConnectionMode("group");
    if (inferredMode === "duo") setConnectionMode("one_to_one");

    // nếu intent có roomId thì prefill room để TabMyConnections render đúng (trước khi getMatchStatus về)
    if (intent.roomId) {
      setActiveRoomId(intent.roomId);
      setActiveRoomType(inferredMode === "group" ? "group" : "duo");
    }

    // đẩy intent xuống TabMyConnections (để mở đúng sub-tab Requests/Room nếu bạn muốn)
    setNavIntent({ ...intent, mode: inferredMode, targetPath: desiredPath });

    // canonicalize URL (đặc biệt để refresh vẫn mở đúng)
    const canonicalSearch = buildCanonicalSearch({ ...intent, mode: inferredMode });
    const needReplace =
      desiredPath !== (loc.pathname || "") ||
      canonicalSearch !== (loc.search || "") ||
      !!intent._fromState; // có state thì replace để xoá state

    if (needReplace) {
      nav({ pathname: desiredPath, search: canonicalSearch }, { replace: true, state: null });
    }
  }, [loc?.key]); // chạy mỗi lần location đổi

  useEffect(()=>{let cancelled=false;(async()=>{
    try{
      setLoading(true);
      const [me,statusPayload]=await Promise.all([
        getMe().catch(()=>null),
        getMatchStatus().catch((e)=>{console.error("getMatchStatus error:",e);return null;}),
      ]);
      if(cancelled) return;

      if(me&&typeof me==="object"){
        setUser(me);
        const p=me.profile||{};
        if(p.sex==="male"||p.sex==="female") setGenderFilter(p.sex); else setGenderFilter("all");
      }

      if(statusPayload){
        const data=statusPayload?.data??statusPayload;
        setDiscoverable(!!data.discoverable);
        setHasAddressForConnect(!!data.hasAddressForConnect);

        const roomId=data.activeRoomId||null;
        const roomType=data.activeRoomType||null;
        setActiveRoomId(roomId);
        setActiveRoomType(roomType);

        if((data.pendingRequestsCount&&data.pendingRequestsCount>0)||roomId) setHasRequestsTabEnabled(true);

        // ✅ nếu đang ở phòng duo/group -> mở TabMyConnections + sync mode + sync url
        if(roomId && (roomType==="duo"||roomType==="group")){
          setActiveTab("my-connections");
          setShowCreateTeam(false);
          setConnectionMode(roomType==="group"?"group":"one_to_one");
          const path=loc?.pathname||"";
          if(roomType==="duo" && !path.includes("/ket-noi/duo")) nav("/ket-noi/duo",{replace:true});
          if(roomType==="group" && !path.includes("/ket-noi/nhom")) nav("/ket-noi/nhom",{replace:true});
        }
      }
    }catch(e){
      console.error("ConnectSidebar init error:",e);
      toast.error("Không thể tải dữ liệu kết nối.");
    }finally{if(!cancelled) setLoading(false);}
  })();return()=>{cancelled=true;};},[nav,loc?.pathname]);

  const p=user?.profile||{};
  const avatarUrl=p.avatarUrl?toAbs(p.avatarUrl):null;
  const displayName=p.nickname||p.fullName||user?.username||user?.email||"Người dùng FitMatch";
  const displayGender=p.sex||null;
  const displayAge=calcAge(p.dob);
  const goalKey=user?.connectGoalKey||p.goal||null;
  const goalLabel=user?.connectGoalLabel||(goalKey&&GOAL_LABELS[goalKey])||"";
  const displayUser={name:displayName,gender:displayGender,age:displayAge,goalLabel};

  const applyDiscoverable=async(value)=>{
    try{
      setUpdatingDiscoverable(true);
      const res=await updateDiscoverable(value);
      const payload=res?.data??res;
      const serverVal=payload&&typeof payload.discoverable==="boolean"?payload.discoverable:value;
      setDiscoverable(serverVal);
      serverVal?toast.success("Đã bật cho phép mọi người tìm kiếm bạn."):toast.info("Đã tắt hiển thị hồ sơ trong kết quả tìm kiếm.");
    }catch(e){
      console.error("updateDiscoverable error:",e);
      const msg=e?.response?.data?.message||e?.response?.data?.error||"Không thể cập nhật trạng thái kết nối.";
      toast.error(msg);
    }finally{setUpdatingDiscoverable(false);}
  };

  const handleToggleDiscoverable=()=>{
    if(updatingDiscoverable) return;
    if(discoverable){applyDiscoverable(false);return;}
    if(!hasAddressForConnect){toast.warn("Bạn cần cập nhật địa chỉ trong Thông tin tài khoản trước khi bật.");nav("/tai-khoan/tai-khoan");return;}
    setShowConfirmModal(true);
  };
  const handleConfirmEnable=()=>{setShowConfirmModal(false);applyDiscoverable(true);};
  const handleCancelEnable=()=>setShowConfirmModal(false);

  // ✅ vào phòng: duo/group đều chuyển sang tab my-connections + sync mode + sync url
  const handleEnteredRoom=(roomId,roomType="duo")=>{
    if(!roomId) return;
    setActiveRoomId(roomId);setActiveRoomType(roomType);
    setHasRequestsTabEnabled(true);
    setShowCreateTeam(false);
    setActiveTab("my-connections");
    setConnectionMode(roomType==="group"?"group":"one_to_one");
    if(roomType==="duo") nav("/ket-noi/duo");
    if(roomType==="group") nav("/ket-noi/nhom");
  };

  const handleLeftRoom=()=>{setActiveRoomId(null);setActiveRoomType(null);};

  const openCreateTeam=()=>{
    if(activeRoomId && activeRoomType==="duo"){toast.info("Bạn đang ở phòng 1:1. Hãy rời phòng trước khi tạo/tham gia nhóm.");setActiveTab("my-connections");nav("/ket-noi/duo");return;}
    if(activeRoomId && activeRoomType==="group"){toast.info("Bạn đang ở phòng nhóm. Hãy rời nhóm trước khi tạo nhóm mới.");setActiveTab("my-connections");nav("/ket-noi/nhom");return;}
    setActiveTab("nearby");setShowCreateTeam(true);setConnectionMode("group");
  };
  const closeCreateTeam=()=>setShowCreateTeam(false);

  const handleCreatedTeam=async(createdPayload)=>{
    setShowCreateTeam(false);
    setConnectionMode("group");
    setNearbyReloadKey((k)=>k+1);
    try{
      const p=createdPayload?.data??createdPayload;
      const rid=p?.roomId||p?.data?.roomId||p?.room?._id||p?.room?.id||null;
      const rtype=p?.roomType||p?.data?.roomType||"group";
      if(rid){handleEnteredRoom(rid,rtype);return;}
      const st=await getMatchStatus();
      const data=st?.data??st;
      const roomId=data?.activeRoomId||null;
      const roomType=data?.activeRoomType||null;
      setActiveRoomId(roomId);setActiveRoomType(roomType);
      if(roomId && (roomType==="group"||roomType==="duo")){setHasRequestsTabEnabled(true);setActiveTab("my-connections");setConnectionMode(roomType==="group"?"group":"one_to_one");nav(roomType==="group"?"/ket-noi/nhom":"/ket-noi/duo");}
    }catch(e){console.error("handleCreatedTeam getMatchStatus error:",e);}
  };

  return (
    <div className="cn-page">
      <div className="cn-layout">
        <aside className="cn-sidebar cn-sidebar--desktop">
          <div className="cn-filters">
            <div className="cn-side-profile">
              <div className="cn-side-avatar">{avatarUrl?<img src={avatarUrl} alt={displayUser.name}/>:<span>{getInitials(displayUser.name)}</span>}</div>
              <div>
                <div className="cn-side-nickname">{displayUser.name}</div>
                <div className="cn-side-discover">
                  <span className="cn-side-discover-label">Cho phép mọi người tìm kiếm bạn</span>
                  <button type="button" className={"cn-switch"+(discoverable?" is-on":"")} onClick={handleToggleDiscoverable} disabled={loading||updatingDiscoverable}><span className="cn-switch-knob"/></button>
                </div>
              </div>
            </div>

            {hasAddressForConnect?(
              <div className="cn-side-sub">{discoverable?"Bạn đang được hiển thị và có thể tìm kiếm trên cộng đồng.":"Bật chức năng kết nối để hồ sơ của bạn có thể được tìm kiếm trên cộng đồng."}</div>
            ):(
              <div className="cn-side-sub">Bạn cần nhập địa chỉ trong <strong>Thông tin tài khoản</strong> để dùng chức năng kết nối xung quanh.</div>
            )}

            <nav className="cn-side-menu">
              <button type="button" className="cn-side-link" onClick={()=>nav("/tai-khoan/ho-so")}><span className="cn-side-link-icon"><i className="fa-regular fa-user"/></span><span className="cn-side-link-label">Hồ sơ thể chất của tôi</span></button>
              <button type="button" className="cn-side-link" onClick={()=>nav("/tai-khoan/tai-khoan")}><span className="cn-side-link-icon"><i className="fa-solid fa-gear"/></span><span className="cn-side-link-label">Thông tin của tôi</span></button>
              <hr className="cn-side-divider"/>
              <button type="button" className={"cn-side-link cn-side-link--tab"+(activeTab==="nearby"?" is-active":"")} onClick={()=>{setActiveTab("nearby");setShowCreateTeam(false);}}>
                <span className="cn-side-link-icon"><i className="fa-solid fa-location-arrow"/></span><span className="cn-side-link-label">Tìm kiếm xung quanh</span>
              </button>
              <button type="button" className={"cn-side-link cn-side-link--tab"+(activeTab==="my-connections"?" is-active":"")+(!hasRequestsTabEnabled?" is-disabled":"")} disabled={!hasRequestsTabEnabled}
                title={hasRequestsTabEnabled?"":"Tab này sẽ mở khi bạn có lời mời kết nối hoặc tham gia phòng."}
                onClick={()=>{if(!hasRequestsTabEnabled)return;setActiveTab("my-connections");setShowCreateTeam(false);}}>
                <span className="cn-side-link-icon"><i className="fa-solid fa-users"/></span><span className="cn-side-link-label">Kết nối của tôi</span>
              </button>
            </nav>

            <div className="cn-side-section">
              <h3 className="cn-side-section-title">Lọc</h3>

              <div className="cn-side-field">
                <div className="cn-filter-label">Chế độ kết nối</div>
                <div className="cn-connection-mode">
                  <button type="button" className={"cn-toggle-btn"+(connectionMode==="one_to_one"?" is-active":"")} onClick={()=>setConnectionMode("one_to_one")}>1:1</button>
                  <button type="button" className={"cn-toggle-btn"+(connectionMode==="group"?" is-active":"")} onClick={()=>setConnectionMode("group")}>Nhóm</button>
                </div>
              </div>

              <div className="cn-side-field">
                <div className="cn-filter-label">Vị trí</div>
                <select className="cn-location-select" value={locationRange} onChange={(e)=>setLocationRange(e.target.value)}>
                  {LOCATION_RANGE_OPTIONS.map((o)=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <p className="cn-filter-hint">Vị trí được lấy từ địa chỉ trong hồ sơ của bạn.</p>
              </div>

              <div className="cn-side-field">
                <div className="cn-filter-label">Độ tuổi hiển thị</div>
                <select className="cn-location-select cn-age-select" value={ageRange} onChange={(e)=>setAgeRange(e.target.value)}>
                  {AGE_RANGE_OPTIONS.map((o)=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div className="cn-side-field">
                <div className="cn-filter-label">Giới tính hiển thị</div>
                <div className="cn-chip-group">
                  <button type="button" className={"cn-chip cn-chip-filter"+(genderFilter==="all"?" is-active":"")} onClick={()=>setGenderFilter("all")}>Tất cả</button>
                  <button type="button" className={"cn-chip cn-chip-filter"+(genderFilter==="male"?" is-active":"")} onClick={()=>setGenderFilter("male")}>Nam</button>
                  <button type="button" className={"cn-chip cn-chip-filter"+(genderFilter==="female"?" is-active":"")} onClick={()=>setGenderFilter("female")}>Nữ</button>
                </div>
                <p className="cn-filter-hint">Giới tính của bạn: {getGenderLabel(displayUser.gender)}</p>
              </div>

              <div className="cn-side-field cn-side-goal-highlight">
                <div className="cn-side-goal-header"><i className="fa-solid fa-bullseye"/><span className="cn-side-goal-label">Mục tiêu tập luyện hiện tại</span></div>
                <div className="cn-goal-chip-wrap"><span className="cn-chip-static">{displayUser.goalLabel||"Chưa thiết lập mục tiêu"}</span></div>
                <p className="cn-goal-hint">Thay đổi trong <strong>Hồ sơ thể chất</strong> để hệ thống gợi ý bạn tập phù hợp hơn.</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="cn-main">
          <div className="cn-mobile-topbar">
            <div className="cn-mobile-tabs">
              <button
                type="button"
                className={"cn-mobile-tab" + (activeTab === "nearby" ? " is-active" : "")}
                onClick={() => {
                  setActiveTab("nearby");
                  setShowCreateTeam(false);
                }}
              >
                Tìm kiếm xung quanh
              </button>

              <button
                type="button"
                className={"cn-mobile-tab" + (activeTab === "my-connections" ? " is-active" : "")}
                disabled={!hasRequestsTabEnabled}
                title={hasRequestsTabEnabled ? "" : "Tab này sẽ mở khi bạn có lời mời kết nối hoặc tham gia phòng."}
                onClick={() => {
                  if (!hasRequestsTabEnabled) return;
                  setActiveTab("my-connections");
                  setShowCreateTeam(false);
                }}
              >
                Kết nối của tôi
              </button>
            </div>

            <button type="button" className="cn-mobile-filter-btn" onClick={openFilters}>
              <i className="fa-solid fa-sliders" />
              <span>Lọc</span>
              {activeFiltersCount > 0 && <span className="cn-mobile-filter-badge">{activeFiltersCount}</span>}
            </button>
          </div>

          {activeTab === "nearby" ? (
            showCreateTeam ? (
              <CreateTeam
                currentUser={user}
                hasAddressForConnect={hasAddressForConnect}
                onClose={closeCreateTeam}
                onCreated={handleCreatedTeam}
              />
            ) : (
              <TabNearby
                key={nearbyReloadKey}
                currentUser={user}
                connectionMode={connectionMode}
                locationRange={locationRange}
                ageRange={ageRange}
                genderFilter={genderFilter}
                discoverable={discoverable}
                goalFilter={displayUser.goalLabel || ""}
                onCreatedRequest={() => setHasRequestsTabEnabled(true)}
                onEnteredRoom={handleEnteredRoom}
                onOpenCreateTeam={openCreateTeam}
                onOpenFilters={openFilters}
              />
            )
          ) : (
            <TabMyConnections
              currentUser={user}
              activeRoomId={activeRoomId}
              activeRoomType={activeRoomType}
              onEnteredRoom={handleEnteredRoom}
              onLeftRoom={handleLeftRoom}
              navIntent={navIntent}
              onConsumeNavIntent={() => setNavIntent(null)}
            />
          )}
        </main>
      </div>

      <div className={"cn-sheet-backdrop" + (filtersOpen ? " is-open" : "")} data-fm-modal={filtersOpen ? "true" : undefined} onClick={closeFilters}>
        <div className="cn-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal={filtersOpen}>
          <div className="cn-sheet-handle" />
          <div className="cn-sheet-head">
            <div className="cn-sheet-title">Bộ lọc</div>
            <button type="button" className="cn-sheet-close" onClick={closeFilters}>
              <i className="fa-solid fa-xmark" />
            </button>
          </div>

          <div className="cn-sheet-body">
            <div className="cn-filters cn-filters--sheet">
              <div className="cn-side-profile">
                <div className="cn-side-avatar">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayUser.name} />
                  ) : (
                    <span>{getInitials(displayUser.name)}</span>
                  )}
                </div>
                <div>
                  <div className="cn-side-nickname">{displayUser.name}</div>
                  <div className="cn-side-discover">
                    <span className="cn-side-discover-label">Cho phép mọi người tìm kiếm bạn</span>
                    <button
                      type="button"
                      className={"cn-switch" + (discoverable ? " is-on" : "")}
                      onClick={handleToggleDiscoverable}
                      disabled={loading || updatingDiscoverable}
                    >
                      <span className="cn-switch-knob" />
                    </button>
                  </div>
                </div>
              </div>

              {hasAddressForConnect ? (
                <div className="cn-side-sub">
                  {discoverable
                    ? "Bạn đang được hiển thị và có thể tìm kiếm trên cộng đồng."
                    : "Bật chức năng kết nối để hồ sơ của bạn có thể được tìm kiếm trên cộng đồng."}
                </div>
              ) : (
                <div className="cn-side-sub">
                  Bạn cần nhập địa chỉ trong <strong>Thông tin tài khoản</strong> để dùng chức năng kết nối xung quanh.
                </div>
              )}

              <nav className="cn-side-menu">
                <button type="button" className="cn-side-link" onClick={() => nav("/tai-khoan/ho-so")}>
                  <span className="cn-side-link-icon"><i className="fa-regular fa-user" /></span>
                  <span className="cn-side-link-label">Hồ sơ thể chất của tôi</span>
                </button>
                <button type="button" className="cn-side-link" onClick={() => nav("/tai-khoan/tai-khoan")}>
                  <span className="cn-side-link-icon"><i className="fa-solid fa-gear" /></span>
                  <span className="cn-side-link-label">Thông tin của tôi</span>
                </button>
                <hr className="cn-side-divider" />
                <button
                  type="button"
                  className={"cn-side-link cn-side-link--tab" + (activeTab === "nearby" ? " is-active" : "")}
                  onClick={() => {
                    setActiveTab("nearby");
                    setShowCreateTeam(false);
                    closeFilters();
                  }}
                >
                  <span className="cn-side-link-icon"><i className="fa-solid fa-location-arrow" /></span>
                  <span className="cn-side-link-label">Tìm kiếm xung quanh</span>
                </button>

                <button
                  type="button"
                  className={
                    "cn-side-link cn-side-link--tab" +
                    (activeTab === "my-connections" ? " is-active" : "") +
                    (!hasRequestsTabEnabled ? " is-disabled" : "")
                  }
                  disabled={!hasRequestsTabEnabled}
                  title={hasRequestsTabEnabled ? "" : "Tab này sẽ mở khi bạn có lời mời kết nối hoặc tham gia phòng."}
                  onClick={() => {
                    if (!hasRequestsTabEnabled) return;
                    setActiveTab("my-connections");
                    setShowCreateTeam(false);
                    closeFilters();
                  }}
                >
                  <span className="cn-side-link-icon"><i className="fa-solid fa-users" /></span>
                  <span className="cn-side-link-label">Kết nối của tôi</span>
                </button>
              </nav>

              <div className="cn-side-section">
                <h3 className="cn-side-section-title">Lọc</h3>

                <div className="cn-side-field">
                  <div className="cn-filter-label">Chế độ kết nối</div>
                  <div className="cn-connection-mode">
                    <button
                      type="button"
                      className={"cn-toggle-btn" + (connectionMode === "one_to_one" ? " is-active" : "")}
                      onClick={() => setConnectionMode("one_to_one")}
                    >
                      1:1
                    </button>
                    <button
                      type="button"
                      className={"cn-toggle-btn" + (connectionMode === "group" ? " is-active" : "")}
                      onClick={() => setConnectionMode("group")}
                    >
                      Nhóm
                    </button>
                  </div>
                </div>

                <div className="cn-side-field">
                  <div className="cn-filter-label">Vị trí</div>
                  <select className="cn-location-select" value={locationRange} onChange={(e) => setLocationRange(e.target.value)}>
                    {LOCATION_RANGE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <p className="cn-filter-hint">Vị trí được lấy từ địa chỉ trong hồ sơ của bạn.</p>
                </div>

                <div className="cn-side-field">
                  <div className="cn-filter-label">Độ tuổi hiển thị</div>
                  <select className="cn-location-select cn-age-select" value={ageRange} onChange={(e) => setAgeRange(e.target.value)}>
                    {AGE_RANGE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div className="cn-side-field">
                  <div className="cn-filter-label">Giới tính hiển thị</div>
                  <div className="cn-chip-group">
                    <button type="button" className={"cn-chip cn-chip-filter" + (genderFilter === "all" ? " is-active" : "")} onClick={() => setGenderFilter("all")}>Tất cả</button>
                    <button type="button" className={"cn-chip cn-chip-filter" + (genderFilter === "male" ? " is-active" : "")} onClick={() => setGenderFilter("male")}>Nam</button>
                    <button type="button" className={"cn-chip cn-chip-filter" + (genderFilter === "female" ? " is-active" : "")} onClick={() => setGenderFilter("female")}>Nữ</button>
                  </div>
                  <p className="cn-filter-hint">Giới tính của bạn: {getGenderLabel(displayUser.gender)}</p>
                </div>

                <div className="cn-side-field cn-side-goal-highlight">
                  <div className="cn-side-goal-header">
                    <i className="fa-solid fa-bullseye" />
                    <span className="cn-side-goal-label">Mục tiêu tập luyện hiện tại</span>
                  </div>
                  <div className="cn-goal-chip-wrap">
                    <span className="cn-chip-static">{displayUser.goalLabel || "Chưa thiết lập mục tiêu"}</span>
                  </div>
                  <p className="cn-goal-hint">Thay đổi trong <strong>Hồ sơ thể chất</strong> để hệ thống gợi ý bạn tập phù hợp hơn.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="cn-sheet-actions">
            <button type="button" className="cn-btn-ghost" onClick={resetFilters}>Đặt lại</button>
            <button type="button" className="cn-btn-primary" onClick={closeFilters}>Áp dụng</button>
          </div>
        </div>
      </div>

      {showConfirmModal && (
        <div className="cn-modal-backdrop" data-fm-modal="true" onClick={handleCancelEnable}>
          <div className="cn-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cn-modal-title">Cho phép mọi người tìm kiếm bạn?</h3>
            <p className="cn-modal-text">
              Khi bật tính năng này, hồ sơ của bạn sẽ xuất hiện trong mục <strong>"Tìm kiếm xung quanh"</strong> để mọi người có thể gửi lời mời kết nối hoặc mời bạn tham gia nhóm tập luyện.
            </p>
            <p className="cn-modal-text cn-modal-text-small">
              Bạn có thể tắt bất cứ lúc nào. Thông tin liên hệ nhạy cảm (email, mật khẩu, ...) sẽ không bị hiển thị công khai.
            </p>
            <div className="cn-modal-actions">
              <button type="button" className="cn-modal-btn ghost" onClick={handleCancelEnable} disabled={updatingDiscoverable}>Hủy</button>
              <button type="button" className="cn-modal-btn primary" onClick={handleConfirmEnable} disabled={updatingDiscoverable}>Bật hiển thị</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
