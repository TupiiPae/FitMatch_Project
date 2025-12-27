// admin-app/src/pages/pagesConnect/ConnectRooms_List.jsx
import React,{useEffect,useMemo,useState} from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import "../pagesContact/Contact_List.css";
import "./ConnectRooms_List.css";
import {
  listMatchRoomsAdmin,
  getMatchRoomAdmin,
  closeMatchRoomAdmin,
  deleteMatchRoomAdmin,
  deleteManyMatchRoomsAdmin,
  kickMatchRoomMemberAdmin,
  transferMatchRoomOwnerAdmin,
} from "../../lib/api";
import ConnectRoomDetailModal from "./modals/ConnectRoomDetailModal";
import ConnectRoomConfirmModal from "./modals/ConnectRoomConfirmModal";
import ConnectRoomUserReportsModal from "./modals/ConnectRoomUserReportsModal";

const fmtCode=(id)=>!id?"—":`#${String(id).slice(-6)}`;
const fmtDate=(d)=>{ if(!d) return "—"; try{ return new Date(d).toLocaleString(); }catch{ return "—"; } };

// ✅ CHỈ chặn bubble (không preventDefault) -> checkbox mới ổn định
const stopRowClick=(e)=>{ e.stopPropagation(); };

// id ổn định
const ridOf=(it)=>{
  const v=it?._id??it?.id??it?.roomId??it?.matchRoomId??"";
  if(typeof v==="string"||typeof v==="number") return String(v);
  if(v && typeof v==="object"){
    if(v.$oid) return String(v.$oid);
    if(typeof v.toString==="function" && v.toString!==Object.prototype.toString) return String(v.toString());
  }
  return "";
};
const uidOf=(m)=>{
  const v=m?._id??m?.id??m?.userId??"";
  if(typeof v==="string"||typeof v==="number") return String(v);
  if(v && typeof v==="object"){
    if(v.$oid) return String(v.$oid);
    if(typeof v.toString==="function" && v.toString!==Object.prototype.toString) return String(v.toString());
  }
  return "";
};

const STATUS_OPTS=[
  { value:"", label:"Tất cả trạng thái" },
  { value:"running", label:"Đang hoạt động (Hoạt động/Đủ người)" },
  { value:"active", label:"Đang hoạt động" },
  { value:"full", label:"Đủ người" },
  { value:"closed", label:"Đã đóng" },
];
const statusLabel=(st)=>st==="active"?"Đang hoạt động":st==="full"?"Đủ người":st==="closed"?"Đã đóng":(st||"—");
const joinPolicyLabel=(p)=>p==="open"?"Tham gia ngay":p==="request"?"Cần duyệt":"—";

function Avatar({url,name}){return <div className="cr-av">{url?<img src={url} alt={name||"av"} />:<i className="fa-solid fa-user" />}</div>;}
function GroupCover({url,name}){return <div className="cr-cover">{url?<img src={url} alt={name||"cover"} />:<div className="cr-cover-ph"><i className="fa-solid fa-users" /></div>}</div>;}
function MemberChip({m}){
  const name=m?.nickname||m?.username||m?.email||"Người dùng";
  const roleText=m?.role==="owner"?"Chủ phòng":"Thành viên";
  return (
    <div className="cr-member">
      <Avatar url={m?.avatarUrl} name={name}/>
      <div className="cr-member-meta">
        <div className="cr-member-name" title={name}>{name}</div>
        <div className="cr-member-sub" title={m?.email||""}>{m?.email||""}</div>
      </div>
      <div className={"cr-role "+(m?.role==="owner"?"own":"mem")}>{roleText}</div>
    </div>
  );
}

export default function ConnectRooms_List(){
  const [activeTab,setActiveTab]=useState("duo"); // duo | group
  const [q,setQ]=useState("");
  const [status,setStatus]=useState("");
  const [pendingOnly,setPendingOnly]=useState(false);

  const [items,setItems]=useState([]);
  const [total,setTotal]=useState(0);
  const [limit,setLimit]=useState(10);
  const [skip,setSkip]=useState(0);
  const [loading,setLoading]=useState(false);

  const [processingKey,setProcessingKey]=useState(null); // roomId | "bulk"
  const [confirm,setConfirm]=useState(null); // {kind,...}
  const [detail,setDetail]=useState(null);   // { id, loading, data }
  const [reportsUser,setReportsUser]=useState(null); // { user, roomId? }

  // chọn nhiều (mỗi tab riêng)
  const [selDuo,setSelDuo]=useState([]);
  const [selGroup,setSelGroup]=useState([]);

  const headTitle=useMemo(()=>activeTab==="duo"?"Danh sách kết nối - Cặp đôi":"Danh sách kết nối - Nhóm",[activeTab]);
  const page=Math.floor(skip/limit);
  const pageCount=Math.max(1, Math.ceil((total||0)/limit));

  const selectedIds = activeTab==="duo" ? selDuo : selGroup;
  const setSelectedIds = activeTab==="duo" ? setSelDuo : setSelGroup;
  const selectedSet = useMemo(()=>new Set(selectedIds),[selectedIds]);

  // ✅ kiểu Report_List: ids của đúng items đang hiển thị
  const itemIds = useMemo(()=> (items||[]).map(ridOf).filter(Boolean),[items]);
  const allChecked = itemIds.length>0 && itemIds.every(id=>selectedSet.has(id));
  const someChecked = itemIds.some(id=>selectedSet.has(id)) && !allChecked;

  const toggleAll=()=>setSelectedIds(allChecked?[]:itemIds);
  const toggleOne=(id)=>setSelectedIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);

  const loadRooms=async()=>{
    setLoading(true);
    setSelectedIds([]); // giống Report_List
    try{
      const params={ type: activeTab, limit, skip };
      const qTrim=(q||"").trim();
      if(qTrim) params.q=qTrim;
      if(status) params.status=status;
      if(pendingOnly) params.hasPendingReports=1;

      const res=await listMatchRoomsAdmin(params);
      const arr=Array.isArray(res?.items)?res.items:[];
      setItems(arr);
      setTotal(typeof res?.total==="number"?res.total:arr.length);
    }catch(err){
      console.error(err);
      toast.error("Không thể tải danh sách ghép cặp");
      setItems([]); setTotal(0);
    }finally{ setLoading(false); }
  };

  useEffect(()=>{ loadRooms(); /* eslint-disable-next-line */ },[activeTab,limit,skip]);
  useEffect(()=>{
    const t=setTimeout(()=>{ if(skip!==0) setSkip(0); else loadRooms(); },250);
    return ()=>clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[q,status,pendingOnly,activeTab]);

  const openDetail=async(id)=>{
    if(!id) return;
    setDetail({ id, loading:true, data:null });
    try{
      const d=await getMatchRoomAdmin(id);
      setDetail({ id, loading:false, data:d });
    }catch(err){
      console.error(err);
      toast.error("Không thể tải chi tiết phòng");
      setDetail(null);
    }
  };

  const refreshAll=async()=>{ await loadRooms(); if(detail?.id) openDetail(detail.id); };

  const askClose=(it)=>setConfirm({ kind:"close", item:it, message:"Đóng phòng ghép cặp này? Phòng sẽ chuyển sang trạng thái ĐÃ ĐÓNG." });
  const askKick=(roomId,member)=>setConfirm({ kind:"kick", roomId, member, memberId:uidOf(member), message:`Loại "${member?.nickname||member?.email||"thành viên"}" khỏi phòng?`, reason:"" });
  const askTransfer=(roomId,member)=>setConfirm({ kind:"transfer", roomId, member, memberId:uidOf(member), message:`Chuyển vai trò CHỦ PHÒNG cho "${member?.nickname||member?.email||"thành viên"}"?` });
  const askDeleteOne=(it)=>setConfirm({ kind:"deleteOne", item:it, message:"Xóa kết nối này? Dữ liệu sẽ bị xóa khỏi hệ thống (phòng kết nối đang hoạt động cũng sẽ bị ảnh hưởng)." });
  const askDeleteMany=()=>selectedIds.length && setConfirm({ kind:"deleteMany", ids:selectedIds.slice(), message:`Xóa ${selectedIds.length} kết nối đã chọn? Dữ liệu sẽ bị xóa khỏi hệ thống.` });

  const doClose=async(id)=>{
    setProcessingKey(id);
    try{ await closeMatchRoomAdmin(id,""); toast.success("Đã đóng phòng"); await refreshAll(); }
    catch(err){ console.error(err); toast.error(err?.response?.data?.message || "Đóng phòng thất bại"); }
    finally{ setProcessingKey(null); }
  };
  const doKick=async(roomId,userId,reason)=>{
    setProcessingKey(roomId);
    try{ await kickMatchRoomMemberAdmin(roomId,userId,reason); toast.success("Đã loại thành viên"); await refreshAll(); }
    catch(err){ console.error(err); toast.error(err?.response?.data?.message || "Thao tác thất bại"); }
    finally{ setProcessingKey(null); }
  };
  const doTransfer=async(roomId,newOwnerId)=>{
    setProcessingKey(roomId);
    try{ await transferMatchRoomOwnerAdmin(roomId,newOwnerId); toast.success("Đã chuyển chủ phòng"); await refreshAll(); }
    catch(err){ console.error(err); toast.error(err?.response?.data?.message || "Chuyển chủ phòng thất bại"); }
    finally{ setProcessingKey(null); }
  };
  const doDeleteOne=async(id)=>{
    setProcessingKey(id);
    try{
      await deleteMatchRoomAdmin(id);
      toast.success("Đã xóa kết nối");
      setSelectedIds(prev=>prev.filter(x=>x!==id));
      if(detail?.id===id) setDetail(null);
      await loadRooms();
    }catch(err){
      console.error(err);
      toast.error(err?.response?.data?.message || "Xóa thất bại");
    }finally{ setProcessingKey(null); }
  };
  const doDeleteMany=async(ids)=>{
    setProcessingKey("bulk");
    try{
      await deleteManyMatchRoomsAdmin(ids);
      toast.success(`Đã xóa ${ids.length} kết nối`);
      if(detail?.id && ids.includes(detail.id)) setDetail(null);
      setSelectedIds([]);
      await loadRooms();
    }catch(err){
      console.error(err);
      toast.error(err?.response?.data?.message || "Xóa nhiều thất bại");
    }finally{ setProcessingKey(null); }
  };

  return (
    <div className="ct-page-admin">
      <nav className="ct-breadcrumb" aria-label="breadcrumb">
        <Link to="/"><i className="fa-solid fa-house" /> <span>Trang chủ</span></Link>
        <span className="sep">/</span>
        <span className="grp"><i className="fa-solid fa-link" /> <span>Kết nối</span></span>
        <span className="sep">/</span>
        <span className="cur">Danh sách kết nối</span>
      </nav>

      <div className="ct-card">
        <div className="ct-head">
          <h2>{headTitle} ({total})</h2>
          <div className="ct-actions">
            <button className="btn danger" type="button" onClick={askDeleteMany} disabled={!selectedIds.length || processingKey==="bulk"}>
              <i className="fa-solid fa-trash" /> <span>Xóa đã chọn {selectedIds.length?`(${selectedIds.length})`:""}</span>
            </button>
            <button className="btn ghost" type="button" onClick={loadRooms}>
              <i className="fa-solid fa-rotate" /> <span>Tải lại</span>
            </button>
          </div>
        </div>

        <div className="ct-filters">
          <div className="ct-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder={activeTab==="duo"?"Tìm theo tên người dùng / mã phòng...":"Tìm theo tên nhóm / vị trí / mục tiêu / thành viên / mã phòng..."} />
          </div>
          <div className="ct-filter-row">
            <select value={status} onChange={(e)=>setStatus(e.target.value)}>{STATUS_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>
            <button type="button" className={"cr-pill"+(pendingOnly?" on":"")} onClick={()=>setPendingOnly(v=>!v)}>
              <i className="fa-solid fa-triangle-exclamation"></i> <span>Chỉ báo cáo chờ xử lý</span>
            </button>
          </div>
        </div>

        <div className="cr-tabs">
          <button type="button" className={"cr-tab"+(activeTab==="duo"?" active":"")} onClick={()=>{setActiveTab("duo");setSkip(0);}}>Cặp đôi</button>
          <button type="button" className={"cr-tab"+(activeTab==="group"?" active":"")} onClick={()=>{setActiveTab("group");setSkip(0);}}>Nhóm</button>
        </div>

        <div className="ct-table">
          <div className={"ct-thead "+(activeTab==="duo"?"cr-duo-head":"cr-group-head")}>
            <div className="cell sel" onClick={stopRowClick}>
              <input className="cr-check" type="checkbox" checked={allChecked}
                ref={(el)=>{ if(el) el.indeterminate=someChecked; }}
                onClick={stopRowClick}
                onChange={toggleAll}
              />
            </div>
            <div className="cell code">Mã</div>
            <div className="cell name ctn">{activeTab==="duo"?"Thành viên":"Nhóm"}</div>
            {activeTab==="group" && <div className="cell info">Thông tin</div>}
            <div className="cell st">Trạng thái</div>
            <div className="cell rep">Báo cáo <i className="fa-regular fa-circle-question cr-tip" title="Báo cáo chờ xử lý / Tổng số báo cáo" /></div>
            <div className="cell subject">Cập nhật</div>
            <div className="cell act">Thao tác</div>
          </div>

          {loading && <div className="ct-empty">Đang tải...</div>}
          {!loading && items.length===0 && <div className="ct-empty">Chưa có dữ liệu ghép cặp.</div>}

          {!loading && items.map((it,idx)=>{
            const rid=ridOf(it);
            const repPending=Number(it.reportsPending||0), repTotal=Number(it.reportsTotal||0);
            const repText=`${repPending}/${repTotal}`, repTip="Báo cáo chờ xử lý / Tổng số báo cáo";
            return (
              <div key={rid?`rid-${rid}`:`row-${activeTab}-${idx}`} className={"ct-trow "+(activeTab==="duo"?"cr-duo-row":"cr-group-row")}
                onClick={()=>rid && openDetail(rid)} role="button" tabIndex={0}>

                <div className="cell sel" onClick={stopRowClick}>
                  <input className="cr-check" type="checkbox" disabled={!rid}
                    checked={rid?selectedSet.has(rid):false}
                    onClick={stopRowClick}
                    onChange={()=>rid && toggleOne(rid)}
                  />
                </div>

                <div className="cell code"><div className="cr-code">{fmtCode(rid)}</div></div>

                <div className="cell name">
                  {activeTab==="duo" ? (
                    <div className="cr-members">
                      {(it.members||[]).slice(0,2).map((m,i)=>{
                        const mk=uidOf(m)||m?.email||`m-${idx}-${i}`;
                        return <MemberChip key={mk} m={m} />;
                      })}
                    </div>
                  ) : (
                    <div className="cr-grouprow">
                      <GroupCover url={it.coverImageUrl} name={it.name}/>
                      <div className="cr-groupbox">
                        <div className="cr-groupname" title={it.name || ""}>{it.name || "—"}</div>
                        <div className="cr-sub" title={`${it.locationLabel||""} • ${it.goalLabel||""}`}>{it.locationLabel || "—"} • {it.goalLabel || "—"}</div>
                      </div>
                    </div>
                  )}
                </div>

                {activeTab==="group" && (
                  <div className="cell info">
                    <div className="cr-sub">Thành viên: {it.membersCount}/{it.maxMembers}</div>
                    <div className="cr-sub">Kiểu tham gia: {joinPolicyLabel(it.joinPolicy)} • Yêu cầu chờ: {it.pendingJoinRequests||0}</div>
                  </div>
                )}

                <div className="cell st ctn">
                  <span className={"cr-badge "+(it.status||"")}>{statusLabel(it.status)}</span>
                  {activeTab==="duo" && <div className="cr-sub">Thành viên: {it.membersCount}/{it.maxMembers}</div>}
                </div>

                <div className="cell rep"><span className={"cr-report"+(repPending>0?" hot":"")} title={repTip}>{repText}</span></div>

                <div className="cell subject">
                  <div className="cr-sub">{fmtDate(it.updatedAt)}</div>
                  {it.closedAt && <div className="cr-sub">Đã đóng: {fmtDate(it.closedAt)}</div>}
                </div>

                <div className="cell act" onClick={stopRowClick}>
                  <button className="iconbtn" title="Xem chi tiết" disabled={!rid} onClick={()=>rid && openDetail(rid)}><i className="fa-regular fa-eye" /></button>
                  <button className="iconbtn close" title="Đóng phòng" disabled={!rid||processingKey===rid} onClick={()=>rid && askClose({ ...it,_id:rid })}><i className="fa-regular fa-circle-xmark"></i></button>
                  <button className="iconbtn danger" title="Xóa dữ liệu" disabled={!rid||processingKey===rid} onClick={()=>rid && askDeleteOne({ ...it,_id:rid })}><i className="fa-regular fa-trash-can" /></button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="ct-pagination">
          <div className="per-page">
            <span>Hiển thị:</span>
            <select value={limit} onChange={(e)=>{ setLimit(Number(e.target.value)); setSkip(0); }}>
              <option value="10">10 hàng</option><option value="25">25 hàng</option><option value="50">50 hàng</option>
            </select>
          </div>
          <div className="page-nav">
            <span className="page-info">Trang {page+1} / {Math.max(pageCount,1)} (Tổng: {total})</span>
            <button className="btn-page" onClick={()=>setSkip(Math.max(0,skip-limit))} disabled={skip===0}><i className="fa-solid fa-chevron-left" /></button>
            <button className="btn-page" onClick={()=>setSkip(skip+limit>=total?skip:skip+limit)} disabled={skip+limit>=total}><i className="fa-solid fa-chevron-right" /></button>
          </div>
        </div>
      </div>

      <ConnectRoomDetailModal
        open={!!detail}
        detail={detail}
        processingKey={processingKey}
        fmtCode={fmtCode}
        fmtDate={fmtDate}
        statusLabel={statusLabel}
        joinPolicyLabel={joinPolicyLabel}
        onClose={()=>setDetail(null)}
        onReload={()=>detail?.id && openDetail(detail.id)}
        onAskClose={(roomId)=>askClose({ _id: roomId })}
        onAskDelete={(roomId)=>askDeleteOne({ _id: roomId })}
        onAskKick={(roomId,member)=>askKick(roomId,member)}
        onAskTransfer={(roomId,member)=>askTransfer(roomId,member)}
        onOpenReports={(member)=>setReportsUser({ user: member, roomId: detail?.id || null })}
      />

      <ConnectRoomUserReportsModal open={!!reportsUser} user={reportsUser?.user || null} onClose={()=>setReportsUser(null)} />

      <ConnectRoomConfirmModal
        open={!!confirm}
        confirm={confirm}
        processingKey={processingKey}
        onClose={()=>setConfirm(null)}
        onConfirm={async(c)=>{
          if(c.kind==="close") await doClose(String(c.item?._id||c.item?.id||""));
          else if(c.kind==="kick") await doKick(c.roomId, c.memberId, (c.reason||"").trim());
          else if(c.kind==="transfer") await doTransfer(c.roomId, c.memberId);
          else if(c.kind==="deleteOne") await doDeleteOne(String(c.item?._id||c.item?.id||""));
          else if(c.kind==="deleteMany") await doDeleteMany(c.ids||[]);
          setConfirm(null);
        }}
        onChange={(patch)=>setConfirm(x=>({ ...(x||{}), ...patch }))}
      />
    </div>
  );
}
