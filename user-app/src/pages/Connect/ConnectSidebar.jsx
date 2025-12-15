// user-app/src/pages/Connect/ConnectSidebar.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const [user,setUser]=useState(null);
  const [discoverable,setDiscoverable]=useState(false);
  const [hasAddressForConnect,setHasAddressForConnect]=useState(false);
  const [hasRequestsTabEnabled,setHasRequestsTabEnabled]=useState(false);

  const [activeTab,setActiveTab]=useState("nearby"); // nearby | my-connections
  const [connectionMode,setConnectionMode]=useState("one_to_one");
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

  useEffect(()=>{let cancelled=false;(async()=>{
    try{
      setLoading(true);
      const [me,statusPayload]=await Promise.all([
        getMe(),
        getMatchStatus().catch((e)=>{console.error("getMatchStatus error:",e);return null;}),
      ]);
      if(cancelled) return;

      if(me&&typeof me==="object"){
        setUser(me);
        const p=me.profile||{};
        if(p.sex==="male"||p.sex==="female") setGenderFilter(p.sex);
        else setGenderFilter("all");
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
        if(roomId&&roomType==="duo"){setActiveTab("my-connections");setShowCreateTeam(false);}
      }
    }catch(e){
      console.error("ConnectSidebar init error:",e);
      toast.error("Không thể tải dữ liệu kết nối.");
    }finally{if(!cancelled) setLoading(false);}
  })();return()=>{cancelled=true;};},[nav]);

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

  const handleEnteredRoom=(roomId,roomType="duo")=>{
    if(!roomId) return;
    setActiveRoomId(roomId);setActiveRoomType(roomType);
    setHasRequestsTabEnabled(true);
    setActiveTab("my-connections");
    setShowCreateTeam(false);
  };
  const handleLeftRoom=()=>{setActiveRoomId(null);setActiveRoomType(null);};

  const openCreateTeam=()=>{setActiveTab("nearby");setShowCreateTeam(true);}; // ✅ giữ sidebar ở “Tìm kiếm xung quanh”
  const closeCreateTeam=()=>setShowCreateTeam(false);

  return (
    <div className="cn-page">
      <div className="cn-layout">
        <aside className="cn-sidebar">
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
              <button type="button" className={"cn-side-link"+(activeTab==="nearby"?" is-active":"")} onClick={()=>{setActiveTab("nearby");setShowCreateTeam(false);}}>
                <span className="cn-side-link-icon"><i className="fa-solid fa-location-arrow"/></span><span className="cn-side-link-label">Tìm kiếm xung quanh</span>
              </button>
              <button type="button" className={"cn-side-link"+(activeTab==="my-connections"?" is-active":"")+(!hasRequestsTabEnabled?" is-disabled":"")} disabled={!hasRequestsTabEnabled}
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
          {activeTab==="nearby" ? (
            showCreateTeam ? (
              <CreateTeam
                currentUser={user}
                hasAddressForConnect={hasAddressForConnect}
                onClose={closeCreateTeam}
                onCreated={()=>{
                  setShowCreateTeam(false);
                  setConnectionMode("group");
                  setNearbyReloadKey((k)=>k+1);
                }}
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
                goalFilter={displayUser.goalLabel||""}
                onCreatedRequest={()=>setHasRequestsTabEnabled(true)}
                onEnteredRoom={handleEnteredRoom}
                onOpenCreateTeam={openCreateTeam} // ✅ click -> đổi view sang CreateTeam
              />
            )
          ) : (
            <TabMyConnections
              currentUser={user}
              activeRoomId={activeRoomId}
              activeRoomType={activeRoomType}
              onEnteredRoom={handleEnteredRoom}
              onLeftRoom={handleLeftRoom}
            />
          )}
        </main>
      </div>

      {showConfirmModal && (
        <div className="cn-modal-backdrop" onClick={handleCancelEnable}>
          <div className="cn-modal" onClick={(e)=>e.stopPropagation()}>
            <h3 className="cn-modal-title">Cho phép mọi người tìm kiếm bạn?</h3>
            <p className="cn-modal-text">
              Khi bật tính năng này, hồ sơ của bạn sẽ xuất hiện trong mục <strong>"Tìm kiếm xung quanh"</strong> để mọi người có thể gửi lời mời kết nối hoặc mời bạn tham gia nhóm tập luyện.
            </p>
            <p className="cn-modal-text cn-modal-text-small">
              Bạn có thể tắt bất cứ lúc nào. Thông tin liên hệ nhạy cảm (email, mật khẩu, ...) sẽ không bị hiển thị công khai.
            </p>
            <div className="cn-modal-actions">
              <button type="button" className="cn-btn-ghost" onClick={handleCancelEnable} disabled={updatingDiscoverable}>Để sau</button>
              <button type="button" className="cn-btn-primary" onClick={handleConfirmEnable} disabled={updatingDiscoverable}>Bật hiển thị</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
