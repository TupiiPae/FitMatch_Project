// admin-app/src/pages/pagesUsers/User_List/User_List.jsx
import React,{useEffect,useMemo,useRef,useState} from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { listUsers, blockUser, unblockUser, listConnectReportsAdmin, updateConnectReportAdmin, deleteConnectReportAdmin } from "../../../lib/api.js";
import "./User_List.css";

const RAW_API=(import.meta.env.VITE_API_BASE||import.meta.env.VITE_API_URL||"").replace(/\/+$/,"");
const API_ORIGIN=RAW_API.replace(/\/api$/,"");
const toAbs=(u)=>{if(!u)return "";try{if(/^https?:\/\//i.test(u))return u;return new URL(u,API_ORIGIN||window.location.origin).toString()}catch{return u}};

function EmailChips({ users, showReason=false }) {
  if (!Array.isArray(users) || users.length === 0) return null;
  return (
    <div className="ulist-chipwrap">
      {users.map((u)=>(
        <div key={u._id} className="ulist-chip" title={u.email || "(không có email)"}>
          <span className="ulist-chip-mail">{u.email || "—"}</span>
          {showReason && <span className="ulist-chip-reason">{u.blockedReason ? `: ${u.blockedReason}` : ": (Vi phạm tiêu chuẩn cộng đồng)"}</span>}
        </div>
      ))}
    </div>
  );
}

function BlockReasonModal({ open, onClose, onSubmit, users=[], loading }) {
  const [reason,setReason]=useState("");
  useEffect(()=>{ if(open) setReason(""); },[open]);
  if(!open) return null;
  const count=users.length;
  return (
    <div className="cm-backdrop" onMouseDown={(e)=>e.target.classList.contains("cm-backdrop")&&onClose()}>
      <div className="cm-modal" role="dialog" aria-modal="true" aria-labelledby="blk-title">
        <div className="cm-head">
          <h3 id="blk-title"><i className="fa-solid fa-lock"></i>{" "}{count>1?<>Bạn đang chọn <b>{count}</b> tài khoản để khóa</>:<>Khóa tài khoản</>}</h3>
        </div>
        <div className="cm-body">
          {count>0 && (<><p style={{marginTop:0,marginBottom:8}}>{count>1?"Danh sách email các tài khoản sẽ bị khóa:":"Email tài khoản sẽ bị khóa:"}</p><EmailChips users={users}/></>)}
          <label className="fc-field" style={{width:"100%",marginTop:12}}>
            <span className="fc-label">Lý do khóa (bắt buộc)</span>
            <textarea className="auth-input" rows={5} placeholder="Nhập lý do khóa" value={reason} onChange={(e)=>setReason(e.target.value)} maxLength={500} required />
          </label>
          <div className="error-stack" aria-live="polite">{!reason.trim() && <span className="error-item">Vui lòng nhập lý do khóa.</span>}</div>
        </div>
        <div className="cm-foot">
          <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>Hủy</button>
          <button type="button" className={`btn danger ${loading?"loading":""}`} onClick={()=>reason.trim()&&onSubmit(reason.trim())} disabled={!reason.trim()||loading}>
            <i className="fa-solid fa-lock" /> <span>Khóa tài khoản</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmUnblockModal({ open, onClose, onConfirm, users=[], loading }) {
  if(!open) return null;
  const count=users.length;
  return (
    <div className="cm-backdrop" onMouseDown={(e)=>e.target.classList.contains("cm-backdrop")&&onClose()}>
      <div className="cm-modal" role="dialog" aria-modal="true" aria-labelledby="cfm-title">
        <div className="cm-head">
          <h3 id="cfm-title"><i className="fa-solid fa-lock-open"></i>{" "}{count>1?<>Mở khóa <b>{count}</b> tài khoản</>:<>Mở khóa tài khoản</>}</h3>
        </div>
        <div className="cm-body">
          <p style={{marginTop:0,marginBottom:8}}>{count>1?"Danh sách email và lý do bị khóa:":"Email và lý do bị khóa:"}</p>
          <EmailChips users={users} showReason />
        </div>
        <div className="cm-foot">
          <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>Hủy</button>
          <button type="button" className={`btn ${loading?"loading":""}`} onClick={onConfirm} disabled={loading}>
            <i className="fa-solid fa-lock-open" /> <span>Mở khóa</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function UserReportsModal({
  open,onClose,user,loading,
  items,summary,status,setStatus,search,setSearch,
  page,pages,total,setPage,
  actingId,onReviewed,onDismissed,onAskDelete,
  editId,setEditId,editNote,setEditNote,onSaveNote,
  expandedId,setExpandedId,
}) {
  if(!open) return null;

  const name=user?.profile?.nickname||user?.username||user?.email||"Người dùng";
  const email=user?.email||"—";
  const reasonLabels={spam:"Spam",scam:"Lừa đảo",harassment:"Quấy rối",inappropriate:"Nội dung phản cảm",fake:"Giả mạo",other:"Khác"};
  const statusLabels={pending:"Chờ xử lý",reviewed:"Đã xử lý",dismissed:"Bỏ qua"};
  const fmt=(v)=>(v?new Date(v).toLocaleString():"—");

  // ✅ avatar: ưu tiên user đang mở modal; nếu thiếu thì chỉ lấy từ report có target đúng user (KHÔNG lấy items[0])
  const uid=String(user?._id||"");
  const avatar=useMemo(()=>{
    const uA=user?.profile?.avatarUrl;
    if(uA) return toAbs(uA);
    const arr=Array.isArray(items)?items:[];
    const hit=arr.find(r=>{
      const tid=r?.targetUser?._id||r?.targetUserId||r?.targetId||r?.snapshot?.targetUserId||r?.snapshot?.targetId;
      return tid && String(tid)===uid;
    });
    const a=hit?.targetUser?.profile?.avatarUrl||hit?.snapshot?.avatarUrl||null;
    return toAbs(a);
  },[uid,user?.profile?.avatarUrl,items]);

  const counts=summary?.counts||null;

  return (
    <div className="cm-backdrop" onMouseDown={(e)=>e.target.classList.contains("cm-backdrop")&&onClose()}>
      <div className="cm-modal ur-modal" role="dialog" aria-modal="true" aria-labelledby="ur-title">
        <div className="ur-head">
          <div className="ur-user">
            <div className="ur-avatar" style={{position:"relative",overflow:"hidden"}}>
              <i className="fa-solid fa-user" style={{position:"absolute",inset:0,display:"grid",placeItems:"center"}} />
              {avatar ? <img src={avatar} alt={name} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}} onError={(e)=>{e.currentTarget.style.display="none"}}/> : null}
            </div>
            <div className="ur-meta">
              <div className="ur-name" id="ur-title">{name}</div>
              <div className="ur-sub">{email} • #{String(user?._id||"").slice(-6)}</div>
            </div>
          </div>
          <button className="btn-close" type="button" title="Đóng" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="ur-summary">
          <div className="ur-chip"><b>Tổng:</b> {summary?.total ?? total ?? 0}</div>
          {counts && (<>
            <div className="ur-chip warn"><b>Chờ:</b> {counts.pending ?? 0}</div>
            <div className="ur-chip ok"><b>Đã xử lý:</b> {counts.reviewed ?? 0}</div>
            <div className="ur-chip muted"><b>Bỏ qua:</b> {counts.dismissed ?? 0}</div>
          </>)}
          {summary?.uniqueReporters!=null && <div className="ur-chip"><b>Người tố cáo:</b> {summary.uniqueReporters}</div>}
          {summary?.lastReportedAt && <div className="ur-chip"><b>Mới nhất:</b> {fmt(summary.lastReportedAt)}</div>}
        </div>

        {Array.isArray(summary?.reasons) && summary.reasons.length>0 && (
          <div className="ur-reasons">
            <div className="ur-reasons-title">Thống kê lý do</div>
            <div className="ur-reasons-row">
              {summary.reasons.slice(0,8).map((r)=>(
                <div key={r.key} className="ur-rchip" title={reasonLabels[r.key]||r.key}><span>{reasonLabels[r.key]||r.key}</span><b>{r.count}</b></div>
              ))}
            </div>
          </div>
        )}

        <div className="ur-filters">
          <div className="seg">
            <button type="button" className={`seg-btn ${status==="all"?"is-active":""}`} onClick={()=>{setStatus("all");setPage(1);}}>Tất cả</button>
            <button type="button" className={`seg-btn ${status==="pending"?"is-active":""}`} onClick={()=>{setStatus("pending");setPage(1);}}>Chờ xử lý</button>
            <button type="button" className={`seg-btn ${status==="reviewed"?"is-active":""}`} onClick={()=>{setStatus("reviewed");setPage(1);}}>Đã xử lý</button>
            <button type="button" className={`seg-btn ${status==="dismissed"?"is-active":""}`} onClick={()=>{setStatus("dismissed");setPage(1);}}>Bỏ qua</button>
          </div>
          <div className="ur-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Tìm trong note / lý do khác / adminNote..." />
          </div>
        </div>

        <div className="ur-body">
          {loading && <div className="empty">Đang tải báo cáo...</div>}
          {!loading && (!Array.isArray(items) || items.length===0) && <div className="empty">Chưa có báo cáo nào được ghi.</div>}

          {!loading && Array.isArray(items) && items.map((r)=>{
            const rep=r?.reporter||null;
            const repName=rep?.profile?.nickname||rep?.username||rep?.email||"Người dùng";
            const repEmail=rep?.email||"";
            const st=r?.status||"pending";
            const reasons=Array.isArray(r?.reasons)?r.reasons:[];
            const other=String(r?.otherReason||"").trim();
            const note=String(r?.note||"").trim();
            const adminNote=String(r?.adminNote||"").trim();
            const isActing=actingId===r._id;
            const expanded=expandedId===r._id;

            return (
              <div key={r._id} className={`ur-item ${expanded?"is-open":""}`}>
                <div className="ur-row">
                  <button type="button" className="ur-main" onClick={()=>setExpandedId(expanded?null:r._id)} title="Xem chi tiết">
                    <div className="ur-line1">
                      <span className={`ur-status ${st}`}>{statusLabels[st]||st}</span>
                      <span className="ur-time">{fmt(r?.createdAt)}</span>
                      <span className="ur-rep">Tố cáo bởi: <b>{repName}</b>{repEmail?<span className="ur-rep-mail"> ({repEmail})</span>:null}</span>
                    </div>
                    <div className="ur-line2">
                      <span className="ur-tags">
                        {reasons.map((k)=><span key={k} className="ur-tag">{reasonLabels[k]||k}</span>)}
                        {other?<span className="ur-tag other">Khác</span>:null}
                      </span>
                      <span className="ur-snippet">{note||other||adminNote||"—"}</span>
                    </div>
                  </button>

                  <div className="ur-actions">
                    <button className="iconbtn" type="button" title="Đánh dấu đã xử lý" disabled={isActing||st==="reviewed"} onClick={()=>onReviewed(r._id)}><i className="fa-solid fa-check" /></button>
                    <button className="iconbtn" type="button" title="Bỏ qua" disabled={isActing||st==="dismissed"} onClick={()=>onDismissed(r._id)}><i className="fa-solid fa-ban" /></button>
                    <button className="iconbtn danger" type="button" title="Xóa vĩnh viễn" disabled={isActing} onClick={()=>onAskDelete(r._id)}><i className="fa-solid fa-trash-can" /></button>
                    <button className="iconbtn" type="button" title="Sửa ghi chú admin" disabled={isActing} onClick={()=>{setEditId(r._id);setEditNote(r?.adminNote||"");}}><i className="fa-solid fa-pen" /></button>
                  </div>
                </div>

                {expanded && (
                  <div className="ur-detail">
                    <div className="ur-dcol">
                      <div className="ur-dtitle">Nội dung tố cáo</div>
                      <div className="ur-dbox">
                        <div><b>Lý do:</b> {reasons.length?reasons.map((k)=>reasonLabels[k]||k).join(", "):"—"}</div>
                        <div><b>Lý do khác:</b> {other||"—"}</div>
                        <div style={{marginTop:6}}><b>Ghi chú:</b></div>
                        <div className="ur-note">{note||"—"}</div>
                      </div>
                    </div>
                    <div className="ur-dcol">
                      <div className="ur-dtitle">Admin</div>
                      <div className="ur-dbox">
                        <div><b>Trạng thái:</b> {statusLabels[st]||st}</div>
                        <div><b>ResolvedAt:</b> {fmt(r?.resolvedAt)}</div>
                        <div style={{marginTop:6}}><b>AdminNote:</b></div>
                        <div className="ur-note">{adminNote||"—"}</div>
                      </div>
                    </div>
                    {r?.snapshot && (<div className="ur-dcol full"><div className="ur-dtitle">Snapshot (thời điểm bị báo cáo)</div><pre className="ur-pre">{JSON.stringify(r.snapshot,null,2)}</pre></div>)}
                  </div>
                )}

                {editId===r._id && (
                  <div className="ur-edit">
                    <textarea className="auth-input" rows={3} value={editNote} onChange={(e)=>setEditNote(e.target.value)} placeholder="Nhập ghi chú admin..." maxLength={500} />
                    <div className="ur-edit-actions">
                      <button type="button" className="btn ghost" onClick={()=>{setEditId(null);setEditNote("");}} disabled={isActing}>Hủy</button>
                      <button type="button" className={`btn primary ${isActing?"loading":""}`} onClick={()=>onSaveNote(r._id)} disabled={isActing}><span>Lưu</span></button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="ur-foot">
          <div className="ur-pageinfo">Trang {page} / {pages} (Tổng: {total||0})</div>
          <div className="ur-pagenav">
            <button className="btn-page" onClick={()=>setPage((p)=>Math.max(1,p-1))} disabled={page<=1}><i className="fa-solid fa-chevron-left" /></button>
            <button className="btn-page" onClick={()=>setPage((p)=>Math.min(pages||1,p+1))} disabled={page>=(pages||1)}><i className="fa-solid fa-chevron-right" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UsersList(){
  const [q,setQ]=useState("");
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(false);
  const [limit,setLimit]=useState(10);
  const [skip,setSkip]=useState(0);
  const [total,setTotal]=useState(0);
  const [selectedIds,setSelectedIds]=useState([]);
  const [statusFilter,setStatusFilter]=useState(null);

  const [blockModalOpen,setBlockModalOpen]=useState(false);
  const [blockIds,setBlockIds]=useState([]);
  const [blockLoading,setBlockLoading]=useState(false);

  const [unblockModalOpen,setUnblockModalOpen]=useState(false);
  const [unblockIds,setUnblockIds]=useState([]);
  const [unblockLoading,setUnblockLoading]=useState(false);

  const [reportsOpen,setReportsOpen]=useState(false);
  const [reportsUser,setReportsUser]=useState(null);
  const [reportsLoading,setReportsLoading]=useState(false);
  const [reportsItems,setReportsItems]=useState([]);
  const [reportsSummary,setReportsSummary]=useState(null);
  const [reportsStatus,setReportsStatus]=useState("all");
  const [reportsSearch,setReportsSearch]=useState("");
  const [reportsPage,setReportsPage]=useState(1);
  const [reportsPages,setReportsPages]=useState(1);
  const [reportsTotal,setReportsTotal]=useState(0);
  const [reportActingId,setReportActingId]=useState(null);
  const [reportEditId,setReportEditId]=useState(null);
  const [reportEditNote,setReportEditNote]=useState("");
  const [reportExpandedId,setReportExpandedId]=useState(null);
  const [reportDeleteConfirm,setReportDeleteConfirm]=useState(null); // { id }

  // ✅ chống race
  const reportsReqRef=useRef(0);

  const load=async()=>{
    setLoading(true);
    setSelectedIds([]);
    try{
      const res=await listUsers({ q, limit, skip });
      setItems(res?.items||[]);
      setTotal(res?.total||(res?.items?.length??0));
    }catch{
      setItems([]);setTotal(0);
    }finally{ setLoading(false); }
  };

  useEffect(()=>{ load(); /* eslint-disable-next-line */ },[limit,skip]);
  useEffect(()=>{
    const t=setTimeout(()=>{ if(skip!==0) setSkip(0); else load(); },250);
    return ()=>clearTimeout(t);
    // eslint-disable-next-line
  },[q]);

  const displayItems=useMemo(()=>{
    let arr=items;
    if(statusFilter==="active") arr=items.filter((u)=>!u.blocked);
    else if(statusFilter==="blocked") arr=items.filter((u)=>!!u.blocked);
    return arr;
  },[items,statusFilter]);

  const allChecked=displayItems.length>0 && selectedIds.length===displayItems.length;
  const someChecked=selectedIds.length>0 && selectedIds.length<displayItems.length;

  const selectedUsers=useMemo(()=>displayItems.filter((u)=>selectedIds.includes(u._id)),[displayItems,selectedIds]);
  const hasSelected=selectedUsers.length>0;
  const allSelectedBlocked=hasSelected && selectedUsers.every((u)=>!!u.blocked);
  const allSelectedActive=hasSelected && selectedUsers.every((u)=>!u.blocked);
  const mixedSelected=hasSelected && !allSelectedBlocked && !allSelectedActive;

  const canBlockSelected=selectedUsers.length>=2 && allSelectedActive;
  const canUnblockSelected=selectedUsers.length>=1 && allSelectedBlocked;

  const toggleAll=()=>{ if(allChecked) setSelectedIds([]); else setSelectedIds(displayItems.map((x)=>x._id)); };
  const toggleOne=(id)=>setSelectedIds((prev)=>prev.includes(id)?prev.filter((x)=>x!==id):[...prev,id]);

  const openBlockSingle=(id)=>{
    const target=items.find((x)=>x._id===id);
    if(target?.blocked){ toast.info("Tài khoản đã bị khóa."); return; }
    setBlockIds([id]); setBlockModalOpen(true);
  };
  const openBlockSelected=()=>{ if(!canBlockSelected) return; setBlockIds(selectedIds.slice()); setBlockModalOpen(true); };
  const submitBlock=async(reason)=>{
    setBlockLoading(true);
    try{
      for(const id of blockIds) await blockUser(id,reason);
      toast.success(`Đã khóa ${blockIds.length} tài khoản.`);
      setBlockModalOpen(false); setBlockIds([]);
      await load();
    }catch(e){
      toast.error(e?.response?.data?.message||"Khóa tài khoản thất bại.");
    }finally{ setBlockLoading(false); }
  };

  const openUnblockSingle=(id)=>{
    const target=items.find((x)=>x._id===id);
    if(!target?.blocked){ toast.info("Tài khoản đang hoạt động, không cần mở khóa."); return; }
    setUnblockIds([id]); setUnblockModalOpen(true);
  };
  const openUnblockSelected=()=>{
    if(!canUnblockSelected) return;
    setUnblockIds(selectedIds.filter((id)=>displayItems.find((u)=>u._id===id && u.blocked)));
    setUnblockModalOpen(true);
  };
  const submitUnblock=async()=>{
    setUnblockLoading(true);
    try{
      for(const id of unblockIds) await unblockUser(id);
      toast.success(`Đã mở khóa ${unblockIds.length} tài khoản.`);
      setUnblockModalOpen(false); setUnblockIds([]);
      await load();
    }catch(e){
      toast.error(e?.response?.data?.message||"Mở khóa tài khoản thất bại.");
    }finally{ setUnblockLoading(false); }
  };

  const getTargetId=(r)=>r?.targetUser?._id||r?.targetUserId||r?.targetId||r?.snapshot?.targetUserId||r?.snapshot?.targetId||null;
  const buildSummary=(arr)=>{
    const counts={pending:0,reviewed:0,dismissed:0};
    const repSet=new Set();
    let last=0;
    const reasonMap={};
    for(const r of arr){
      const st=r?.status||"pending"; if(counts[st]!=null) counts[st]+=1;
      const rid=r?.reporter?._id; if(rid) repSet.add(String(rid));
      const t=new Date(r?.createdAt||0).getTime(); if(t>last) last=t;
      const rs=Array.isArray(r?.reasons)?r.reasons:[]; rs.forEach(k=>{reasonMap[k]=(reasonMap[k]||0)+1;});
      if(String(r?.otherReason||"").trim()) reasonMap.other=(reasonMap.other||0)+1;
    }
    const reasons=Object.entries(reasonMap).map(([key,count])=>({key,count})).sort((a,b)=>b.count-a.count);
    return { total:arr.length, counts, uniqueReporters:repSet.size, lastReportedAt:last?new Date(last).toISOString():null, reasons };
  };

  const openReports=(u)=>{
    reportsReqRef.current+=1;
    setReportsUser(u);
    setReportsOpen(true);

    // ✅ reset sạch để không dính user trước
    setReportsLoading(true);
    setReportsItems([]);
    setReportsSummary(null);
    setReportsTotal(0);
    setReportsPages(1);

    setReportsStatus("all");
    setReportsSearch("");
    setReportsPage(1);
    setReportEditId(null);
    setReportEditNote("");
    setReportExpandedId(null);
    setReportDeleteConfirm(null);
  };

  const loadReports=async()=>{
    if(!reportsOpen || !reportsUser?._id) return;
    const req=++reportsReqRef.current;
    setReportsLoading(true);
    try{
      const uid=String(reportsUser._id);
      const s=reportsSearch.trim();
      const params={
        page:reportsPage, limit:10,
        type:"user", targetType:"user",
        targetUserId:uid, targetId:uid, targetUser:uid,
        ...(s?{ search:s, q:s }:{}),
        ...(reportsStatus!=="all"?{ status:reportsStatus }:{}),
      };

      const res=await listConnectReportsAdmin(params);
      if(req!==reportsReqRef.current) return;

      const raw=Array.isArray(res?.items)?res.items:[];
      const filtered=raw.filter(r=>{
        const tid=getTargetId(r);
        return tid && String(tid)===uid;
      });

      setReportsItems(filtered);
      setReportsTotal(typeof res?.total==="number"?res.total:filtered.length);
      setReportsPages(res?.pages||Math.max(1,Math.ceil((Number(res?.total||filtered.length)||0)/10))||1);

      // ✅ nếu BE không trả summary hoặc trả lẫn -> FE tự build summary đúng user
      const summaryOk=res?.summary;
      const mixed=raw.length!==filtered.length;
      setReportsSummary(!mixed && summaryOk ? summaryOk : buildSummary(filtered));
    }catch(e){
      if(req!==reportsReqRef.current) return;
      setReportsItems([]); setReportsSummary(null); setReportsTotal(0); setReportsPages(1);
      toast.error(e?.response?.data?.message||"Không tải được danh sách báo cáo.");
    }finally{
      if(req===reportsReqRef.current) setReportsLoading(false);
    }
  };

  useEffect(()=>{ loadReports(); /* eslint-disable-next-line */ },[reportsOpen,reportsUser?._id,reportsStatus,reportsPage]);
  useEffect(()=>{
    if(!reportsOpen) return;
    const t=setTimeout(()=>{ if(reportsPage!==1) setReportsPage(1); else loadReports(); },250);
    return ()=>clearTimeout(t);
    // eslint-disable-next-line
  },[reportsSearch]);

  const patchReport=async(id,payload)=>{
    setReportActingId(id);
    try{
      await updateConnectReportAdmin(id,payload);
      toast.success("Đã cập nhật báo cáo.");
      await loadReports();
    }catch(e){
      toast.error(e?.response?.data?.message||"Cập nhật báo cáo thất bại.");
    }finally{ setReportActingId(null); }
  };

  const markReviewed=(id)=>patchReport(id,{ status:"reviewed" });
  const markDismissed=(id)=>patchReport(id,{ status:"dismissed" });
  const saveAdminNote=(id)=>patchReport(id,{ adminNote:String(reportEditNote||"").trim() });

  const hardDeleteReport=async(id)=>{
    setReportActingId(id);
    try{
      await deleteConnectReportAdmin(id);
      toast.success("Đã xóa báo cáo vĩnh viễn.");

      // update local nhanh
      setReportsItems(prev=>prev.filter(x=>x._id!==id));
      setReportsTotal(t=>Math.max(0,(Number(t)||0)-1));
      if(reportExpandedId===id) setReportExpandedId(null);
      if(reportEditId===id){ setReportEditId(null); setReportEditNote(""); }

      // nếu vừa xóa item cuối của trang => lùi trang để load lại
      if(reportsItems.length===1 && reportsPage>1) setReportsPage(p=>Math.max(1,p-1));
      else await loadReports();
    }catch(e){
      toast.error(e?.response?.data?.message||"Xóa báo cáo thất bại.");
    }finally{ setReportActingId(null); }
  };

  const page=Math.floor(skip/limit);
  const pageCount=Math.max(1,Math.ceil(total/limit));
  const handleLimitChange=(e)=>{ setLimit(Number(e.target.value)); setSkip(0); };
  const handlePageChange=(newSkip)=>{ if(newSkip>=0 && newSkip<total) setSkip(newSkip); };
  const fmtDate=(v)=>(v?new Date(v).toLocaleString():"—");
  const sexLabel=(s)=>(s==="male"?"Nam":s==="female"?"Nữ":"—");
  const fullAddress=(u)=>{ const a=u?.profile?.address||{}; return [a.city,a.district,a.ward].filter(Boolean).join(", ")||"—"; };
  const displayName=(u)=>u?.profile?.nickname||u?.username||"—";
  const usersByIds=(ids)=>displayItems.filter((u)=>ids.includes(u._id));

  return (
    <div className="foods-page user-list-page">
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/"><i className="fa-solid fa-house" /><span>Trang chủ</span></Link>
        <span className="separator">/</span>
        <span className="current-group"><i className="fa-solid fa-users" /><span>Quản lý Người dùng</span></span>
        <span className="separator">/</span>
        <span className="current-page">Danh sách người dùng</span>
      </nav>

      <div className="card">
        <div className="page-head">
          <h2>Danh sách người dùng ({total})</h2>
          <div className="head-actions">
            <button className="btn danger" type="button" disabled={!canBlockSelected} onClick={openBlockSelected}
              title={mixedSelected?"Danh sách chọn gồm cả tài khoản đã khóa và đang hoạt động.":(!canBlockSelected&&selectedIds.length?"Chỉ có thể khóa khi chọn ≥ 2 tài khoản và tất cả đều đang hoạt động.":undefined)}>
              <i className="fa-solid fa-lock" /> <span>Khóa đã chọn</span>
            </button>
            <button className="btn ghost" type="button" disabled={!canUnblockSelected} onClick={openUnblockSelected}
              title={mixedSelected?"Danh sách chọn gồm cả tài khoản đã khóa và đang hoạt động.":(!canUnblockSelected&&selectedIds.length?"Chỉ có thể mở khóa khi tất cả tài khoản được chọn đang bị khóa.":undefined)}>
              <i className="fa-solid fa-lock-open" /> <span>Mở khóa</span>
            </button>
          </div>
        </div>

        <div className="card-head">
          <div className="search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Tìm theo tên, email, SĐT, địa chỉ…" />
          </div>
          <div className="filters">
            <div className="filter-row">
              <span className="hint">Lọc theo trạng thái:</span>
              <div className="seg">
                <button type="button" className={`seg-btn ${statusFilter===null?"is-active":""}`} onClick={()=>setStatusFilter(null)}>Tất cả</button>
                <button type="button" className={`seg-btn ${statusFilter==="active"?"is-active":""}`} onClick={()=>setStatusFilter("active")}>Hoạt động</button>
                <button type="button" className={`seg-btn ${statusFilter==="blocked"?"is-active":""}`} onClick={()=>setStatusFilter("blocked")}>Đã khóa</button>
              </div>
            </div>
          </div>
        </div>

        <div className="table">
          <div className="thead">
            <label className="cell cb">
              <input type="checkbox" checked={allChecked} ref={(el)=>{ if(el) el.indeterminate=someChecked; }} onChange={toggleAll} aria-label="Chọn tất cả" />
            </label>
            <div className="cell name">Tên người dùng</div>
            <div className="cell sex">Giới tính</div>
            <div className="cell email">Email</div>
            <div className="cell phone">SĐT</div>
            <div className="cell country">Quốc gia</div>
            <div className="cell address">Địa chỉ</div>
            <div className="cell created">Ngày tạo</div>
            <div className="cell status">Trạng thái</div>
            <div className="cell act">Thao tác</div>
          </div>

          {loading && <div className="empty">Đang tải...</div>}
          {!loading && displayItems.length===0 && <div className="empty">Không có người dùng.</div>}

          {!loading && displayItems.map((u)=>(
            <div key={u._id} className="trow">
              <label className="cell cb">
                <input type="checkbox" checked={selectedIds.includes(u._id)} onChange={()=>toggleOne(u._id)} aria-label={`Chọn ${displayName(u)}`} />
              </label>

              <div className="cell name">
                <div className="title">{displayName(u)}</div>
                <div className="sub">#{String(u._id).slice(-6)}</div>
              </div>

              <div className="cell sex">{sexLabel(u?.profile?.sex)}</div>
              <div className="cell email">{u?.email||"—"}</div>
              <div className="cell phone">{u?.phone||"—"}</div>
              <div className="cell country">Việt Nam</div>
              <div className="cell address">{fullAddress(u)}</div>
              <div className="cell created">{fmtDate(u?.createdAt)}</div>

              <div className="cell status">
                {u?.blocked
                  ? <span className="status-badge is-blocked" title={u?.blockedReason?String(u.blockedReason):"Tài khoản đã bị khóa"}>Đã khóa</span>
                  : <span className="status-badge is-active">Hoạt động</span>}
              </div>

              <div className="cell act">
                <button className="iconbtn" type="button" title="Xem báo cáo" onClick={()=>openReports(u)}>
                  <i className="fa-regular fa-comment-dots" />
                </button>

                {!u?.blocked ? (
                  <button className="iconbtn danger" type="button" title="Khóa người dùng" onClick={()=>openBlockSingle(u._id)}>
                    <i className="fa-solid fa-lock" />
                  </button>
                ) : (
                  <button className="iconbtn" type="button" title="Mở khóa" onClick={()=>openUnblockSingle(u._id)}>
                    <i className="fa-solid fa-lock-open" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="pagination-controls">
          <div className="per-page">
            <span>Hiển thị:</span>
            <select value={limit} onChange={handleLimitChange}>
              <option value="10">10 hàng</option>
              <option value="25">25 hàng</option>
              <option value="50">50 hàng</option>
            </select>
          </div>
          <div className="page-nav">
            <span className="page-info">Trang {page+1} / {pageCount} (Tổng: {total})</span>
            <button className="btn-page" onClick={()=>handlePageChange(skip-limit)} disabled={skip===0} aria-label="Trang trước"><i className="fa-solid fa-chevron-left" /></button>
            <button className="btn-page" onClick={()=>handlePageChange(skip+limit)} disabled={skip+limit>=total} aria-label="Trang sau"><i className="fa-solid fa-chevron-right" /></button>
          </div>
        </div>
      </div>

      <BlockReasonModal open={blockModalOpen} onClose={()=>{ if(!blockLoading) setBlockModalOpen(false); }} onSubmit={submitBlock} users={usersByIds(blockIds)} loading={blockLoading} />
      <ConfirmUnblockModal open={unblockModalOpen} onClose={()=>{ if(!unblockLoading) setUnblockModalOpen(false); }} onConfirm={submitUnblock} users={usersByIds(unblockIds)} loading={unblockLoading} />

      <UserReportsModal
        open={reportsOpen}
        onClose={()=>{
          if(!reportActingId){
            reportsReqRef.current+=1;
            setReportsOpen(false); setReportsUser(null);
            setReportsItems([]); setReportsSummary(null);
            setReportsTotal(0); setReportsPages(1);
            setReportDeleteConfirm(null);
          }
        }}
        user={reportsUser}
        loading={reportsLoading}
        items={reportsItems}
        summary={reportsSummary}
        status={reportsStatus}
        setStatus={setReportsStatus}
        search={reportsSearch}
        setSearch={setReportsSearch}
        page={reportsPage}
        pages={reportsPages}
        total={reportsTotal}
        setPage={setReportsPage}
        actingId={reportActingId}
        onReviewed={markReviewed}
        onDismissed={markDismissed}
        onAskDelete={(id)=>setReportDeleteConfirm({ id })}
        editId={reportEditId}
        setEditId={setReportEditId}
        editNote={reportEditNote}
        setEditNote={setReportEditNote}
        onSaveNote={saveAdminNote}
        expandedId={reportExpandedId}
        setExpandedId={setReportExpandedId}
      />

      {reportDeleteConfirm?.id && (
        <div className="cm-backdrop" onMouseDown={(e)=>e.target.classList.contains("cm-backdrop")&&setReportDeleteConfirm(null)}>
          <div className="cm-modal" role="dialog" aria-modal="true">
            <div className="cm-head"><h3>Xóa báo cáo vĩnh viễn?</h3></div>
            <div className="cm-body">Báo cáo sẽ bị xóa khỏi cơ sở dữ liệu và không thể khôi phục.</div>
            <div className="cm-foot">
              <button className="btn ghost" onClick={()=>setReportDeleteConfirm(null)} disabled={!!reportActingId}>Hủy</button>
              <button className={`btn danger ${reportActingId?"loading":""}`} disabled={!!reportActingId}
                onClick={async()=>{ const id=reportDeleteConfirm.id; setReportDeleteConfirm(null); await hardDeleteReport(id); }}>
                <i className="fa-solid fa-trash-can" /> <span>Xóa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
