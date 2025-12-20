// admin-app/src/pages/pagesReportUser/Report_List.jsx
import React,{useEffect,useMemo,useState} from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import "../pagesContact/Contact_List.css";
import "./Report_List.css";
import {
  listConnectReportsAdmin,
  updateConnectReportAdmin,
  deleteConnectReportAdmin,
  deleteManyConnectReportsAdmin,
} from "../../lib/api";
import ReportDetailModal from "./Report_DetailModal.jsx";

const STATUS_OPTIONS=[{value:"",label:"Tất cả trạng thái"},{value:"pending",label:"Chờ xử lý"},{value:"reviewed",label:"Đã xử lý"},{value:"dismissed",label:"Bỏ qua"}];
const TYPE_OPTIONS=[{value:"",label:"Tất cả đối tượng"},{value:"user",label:"Người dùng"},{value:"group",label:"Nhóm"}];

const REASON_LABELS={spam:"Spam",scam:"Lừa đảo",harassment:"Quấy rối",inappropriate:"Không phù hợp",fake:"Giả mạo",other:"Khác"};
const statusText=(s)=>s==="reviewed"?"Đã xử lý":s==="dismissed"?"Bỏ qua":"Chờ xử lý";
const fmtDate=(v)=>v?new Date(v).toLocaleString("vi-VN"):"—";
const fmtCode=(id)=>id?`#${String(id).slice(-6)}`:"—";
const safe=(v)=>((v??"")+"").trim();

export default function Report_List(){
  const [q,setQ]=useState("");
  const [status,setStatus]=useState("");
  const [type,setType]=useState("");

  const [items,setItems]=useState([]);
  const [total,setTotal]=useState(0);
  const [limit,setLimit]=useState(20);
  const [page,setPage]=useState(1);
  const [pages,setPages]=useState(1);
  const [loading,setLoading]=useState(false);

  const [selectedIds,setSelectedIds]=useState([]);
  const allChecked=items.length>0 && selectedIds.length===items.length;
  const someChecked=selectedIds.length>0 && selectedIds.length<items.length;

  const [confirm,setConfirm]=useState(null); // { mode:'delete'|'status', ids:[], nextStatus? }
  const [savingId,setSavingId]=useState(null);
  const [bulkSaving,setBulkSaving]=useState(false);

  const [detail,setDetail]=useState(null);

  const load=async()=>{
    setLoading(true);
    setSelectedIds([]);
    try{
      const params={ page, limit };
      const qTrim=safe(q);
      if(qTrim) params.search=qTrim;
      if(status) params.status=status;
      if(type) params.type=type;

      const res=await listConnectReportsAdmin(params);
      const arr=Array.isArray(res?.items)?res.items:[];
      setItems(arr);
      setTotal(typeof res?.total==="number"?res.total:arr.length);
      setPages(Math.max(1,Number(res?.pages||Math.ceil((res?.total||arr.length)/limit)||1)));
    }catch(e){
      console.error(e);
      toast.error("Không thể tải danh sách báo cáo");
      setItems([]);setTotal(0);setPages(1);
    }finally{ setLoading(false); }
  };

  useEffect(()=>{ load(); /* eslint-disable-next-line */ },[page,limit]);

  useEffect(()=>{
    const t=setTimeout(()=>{
      if(page!==1) setPage(1);
      else load();
    },250);
    return ()=>clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[q,status,type]);

  const toggleAll=()=>setSelectedIds(allChecked?[]:items.map(x=>x._id));
  const toggleOne=(id)=>setSelectedIds(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);

  const getTargetLine=(it)=>{
    const t=it?.targetType||it?.snapshot?.targetType;
    if(t==="user"){
      const u=it?.targetUser||{};
      const nick=u?.profile?.nickname||u?.username||u?.email||it?.snapshot?.nickname||"(Không có tên)";
      const email=u?.email||"";
      return { title:`Người dùng: ${nick}`, sub: email||it?.snapshot?.locationLabel||"—" };
    }
    if(t==="group"){
      const r=it?.targetRoom||{};
      const name=r?.name||it?.snapshot?.name||"(Không có tên nhóm)";
      const loc=r?.locationLabel||it?.snapshot?.locationLabel||"—";
      return { title:`Nhóm: ${name}`, sub: loc };
    }
    return { title:"(Không xác định)", sub:"—" };
  };

  const getReasonsText=(it)=>{
    const arr=Array.isArray(it?.reasons)?it.reasons:[];
    const mapped=arr.map(r=>REASON_LABELS[r]||r).filter(Boolean);
    if(it?.otherReason) mapped.push(`Khác: ${it.otherReason}`);
    return mapped.join(", ")||"—";
  };

  const handleStatusChange=async(id,next)=>{
    setSavingId(id);
    try{
      await updateConnectReportAdmin(id,{ status: next });
      setItems(prev=>prev.map(x=>x._id===id?{...x,status:next,resolvedAt:next==="pending"?null:(x.resolvedAt||new Date().toISOString())}:x));
      setDetail(prev=>prev&&prev._id===id?{...prev,status:next,resolvedAt:next==="pending"?null:(prev.resolvedAt||new Date().toISOString())}:prev);
      toast.success("Cập nhật trạng thái thành công");
    }catch(e){
      console.error(e);
      toast.error("Cập nhật trạng thái thất bại");
    }finally{ setSavingId(null); }
  };

  const onBulkUpdateStatus=async(ids,nextStatus)=>{
    if(!ids?.length) return;
    try{
      setBulkSaving(true);
      const rs=await Promise.allSettled(ids.map(id=>updateConnectReportAdmin(id,{ status: nextStatus })));
      const okIds=ids.filter((_,i)=>rs[i].status==="fulfilled");
      const fail=ids.length-okIds.length;

      setItems(prev=>prev.map(x=>okIds.includes(x._id)?{...x,status:nextStatus,resolvedAt:nextStatus==="pending"?null:(x.resolvedAt||new Date().toISOString())}:x));
      if(detail && okIds.includes(detail._id)) setDetail(d=>d?{...d,status:nextStatus,resolvedAt:nextStatus==="pending"?null:(d.resolvedAt||new Date().toISOString())}:d);

      setSelectedIds([]);
      if(okIds.length) toast.success(`Đã cập nhật ${okIds.length} báo cáo`);
      if(fail) toast.error(`${fail} báo cáo cập nhật thất bại`);
    }finally{ setBulkSaving(false); }
  };

  // ✅ hard delete
  const onBulkDelete=async(ids=[])=>{
    if(!ids.length) return;
    setBulkSaving(true);
    try{
      if(ids.length===1) await deleteConnectReportAdmin(ids[0]);
      else await deleteManyConnectReportsAdmin(ids);

      const delSet=new Set(ids.map(String));
      setItems(prev=>{
        const next=(prev||[]).filter(x=>!delSet.has(String(x._id)));
        return next;
      });
      setTotal(t=>Math.max(0,Number(t||0)-ids.length));
      setSelectedIds([]);
      if(detail && delSet.has(String(detail._id))) setDetail(null);

      toast.success(`Đã xóa ${ids.length} báo cáo`);
      // nếu xóa xong trang hiện tại rỗng -> lùi trang
      setTimeout(()=>{ setPage(p=>p>1 && (items.length-ids.length)<=0 ? p-1 : p); },0);
    }catch(e){
      console.error(e);
      toast.error(e?.response?.data?.message || "Xóa báo cáo thất bại");
    }finally{ setBulkSaving(false); }
  };

  const csv=useMemo(()=>{
    const head=["code","targetType","reporter","target","reasons","note","status","createdAt"].join(",");
    const rows=items.map(it=>{
      const t=getTargetLine(it);
      const reporter=it?.reporter?.profile?.nickname||it?.reporter?.username||it?.reporter?.email||"";
      return [fmtCode(it._id),it?.targetType||"",reporter,`${t.title} | ${t.sub}`,getReasonsText(it),it?.note||"",it?.status||"",it?.createdAt||""]
        .map(v=>(v??"").toString().replace(/"/g,'""'))
        .map(v=>`"${v}"`).join(",");
    });
    return [head,...rows].join("\n");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[items]);

  const downloadCSV=()=>{
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download="connect_reports.csv";
    a.click();
  };

  const pageCount=Math.max(1,Number(pages||Math.ceil((total||0)/limit)||1));
  const canPrev=page>1;
  const canNext=page<pageCount;

  return(
    <div className="ct-page-admin">
      <nav className="ct-breadcrumb" aria-label="breadcrumb">
        <Link to="/"><i className="fa-solid fa-house" /> <span>Trang chủ</span></Link>
        <span className="sep">/</span>
        <span className="grp"><i className="fa-solid fa-link" /> <span>Kết nối</span></span>
        <span className="sep">/</span>
        <span className="cur">Danh sách báo cáo</span>
      </nav>

      <div className="ct-card">
        <div className="ct-head">
          <h2>Danh sách báo cáo ({total})</h2>
          <div className="ct-actions">
            <button className="btn ghost" type="button" onClick={downloadCSV} disabled={!items.length}>
              <i className="fa-solid fa-file-export" /> <span>Xuất danh sách</span>
            </button>

            <button className="btn" type="button" disabled={!selectedIds.length||bulkSaving}
              onClick={()=>setConfirm({mode:"status",ids:selectedIds.slice(),nextStatus:"reviewed"})}>
              <i className="fa-solid fa-check" /> <span>{bulkSaving?"Đang xử lý...":"Đánh dấu đã xử lý"}</span>
            </button>

            <button className="btn danger" type="button" disabled={!selectedIds.length||bulkSaving}
              onClick={()=>setConfirm({mode:"delete",ids:selectedIds.slice()})}>
              <i className="fa-regular fa-trash-can" /> <span>{bulkSaving?"Đang xóa...":"Xóa đã chọn"}</span>
            </button>
          </div>
        </div>

        <div className="ct-filters">
          <div className="ct-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Tìm theo lý do, ghi chú, tên user/nhóm, vị trí..." />
          </div>
          <div className="ct-filter-row">
            <select value={type} onChange={(e)=>setType(e.target.value)}>
              {TYPE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={status} onChange={(e)=>setStatus(e.target.value)}>
              {STATUS_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="ct-table rp-table">
          <div className="ct-thead">
            <label className="cell cb">
              <input type="checkbox" checked={allChecked} ref={(el)=>{ if(el) el.indeterminate=someChecked; }} onChange={toggleAll}/>
            </label>
            <div className="cell code">Mã</div>
            <div className="cell name">Người báo cáo</div>
            <div className="cell target">Đối tượng</div>
            <div className="cell reasons">Lý do</div>
            <div className="cell created">Ngày gửi</div>
            <div className="cell status">Trạng thái</div>
            <div className="cell act">Thao tác</div>
          </div>

          {loading && <div className="ct-empty">Đang tải...</div>}
          {!loading && items.length===0 && <div className="ct-empty">Chưa có báo cáo nào.</div>}

          {!loading && items.map(it=>{
            const reporter=it?.reporter||{};
            const reporterName=reporter?.profile?.nickname||reporter?.username||reporter?.email||"—";
            const t=getTargetLine(it);
            return(
              <div key={it._id} className="ct-trow">
                <label className="cell cb">
                  <input type="checkbox" checked={selectedIds.includes(it._id)} onChange={()=>toggleOne(it._id)} />
                </label>

                <div className="cell code">{fmtCode(it._id)}</div>

                <div className="cell name">
                  <div className="ct-name-main">{reporterName}</div>
                  <div className="rp-subline">{[reporter?.email,reporter?.username].filter(Boolean).join(" • ")}</div>
                </div>

                <div className="cell target" title={t.title}>
                  <div className="ct-name-main">{t.title}</div>
                  <div className="rp-subline">{t.sub}</div>
                </div>

                <div className="cell reasons" title={getReasonsText(it)}>{getReasonsText(it)}</div>

                <div className="cell created">{fmtDate(it.createdAt)}</div>

                <div className="cell status">
                  <select className={`ct-status-select rp-status-select status-${it.status||"pending"}`}
                    value={it.status||"pending"} disabled={savingId===it._id||bulkSaving} onChange={(e)=>handleStatusChange(it._id,e.target.value)}>
                    <option value="pending">Chờ xử lý</option>
                    <option value="reviewed">Đã xử lý</option>
                    <option value="dismissed">Bỏ qua</option>
                  </select>
                </div>

                <div className="cell act">
                  <button className="iconbtn" title="Xem chi tiết" onClick={()=>setDetail(it)}>
                    <i className="fa-regular fa-eye" />
                  </button>

                  <button className="iconbtn danger" title="Xóa vĩnh viễn" disabled={savingId===it._id||bulkSaving}
                    onClick={()=>setConfirm({mode:"delete",ids:[it._id]})}>
                    <i className="fa-regular fa-trash-can" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="ct-pagination">
          <div className="per-page">
            <span>Hiển thị:</span>
            <select value={limit} onChange={(e)=>{setLimit(Number(e.target.value));setPage(1);}}>
              <option value="10">10 hàng</option>
              <option value="20">20 hàng</option>
              <option value="50">50 hàng</option>
            </select>
          </div>
          <div className="page-nav">
            <span className="page-info">Trang {page} / {pageCount} (Tổng: {total})</span>
            <button className="btn-page" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={!canPrev}>
              <i className="fa-solid fa-chevron-left" />
            </button>
            <button className="btn-page" onClick={()=>setPage(p=>Math.min(pageCount,p+1))} disabled={!canNext}>
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        </div>
      </div>

      {/* ✅ Confirm modal */}
      {confirm && (
        <div className="cm-backdrop" onClick={()=>setConfirm(null)}>
          <div className="cm-modal" onClick={(e)=>e.stopPropagation()}>
            <div className="cm-head">
              <h1 className="cm-title">
                {confirm.mode==="delete"
                  ? `Xóa ${confirm.ids.length} báo cáo?`
                  : `Đánh dấu ${confirm.ids.length} báo cáo là “Đã xử lý”?`}
              </h1>
            </div>
            <div className="cm-body">
              {confirm.mode==="delete"
                ? "Báo cáo sẽ bị xóa khỏi cơ sở dữ liệu và không thể khôi phục."
                : "Thao tác sẽ cập nhật trạng thái hàng loạt."}
            </div>
            <div className="cm-foot">
              <button className="btn ghost" onClick={()=>setConfirm(null)}>Hủy</button>
              <button className={"btn "+(confirm.mode==="delete"?"danger":"primary")}
                disabled={bulkSaving}
                onClick={async()=>{
                  if(confirm.mode==="delete") await onBulkDelete(confirm.ids);
                  else await onBulkUpdateStatus(confirm.ids,confirm.nextStatus);
                  setConfirm(null);
                }}>
                {bulkSaving ? (confirm.mode==="delete"?"Đang xóa...":"Đang cập nhật...") : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <ReportDetailModal
          data={detail}
          saving={savingId===detail._id}
          onClose={()=>setDetail(null)}
          onSave={async(payload)=>{
            try{
              setSavingId(detail._id);
              await updateConnectReportAdmin(detail._id,payload);
              setItems(prev=>prev.map(x=>x._id===detail._id?{...x,...payload,resolvedAt:payload.status==="pending"?null:(x.resolvedAt||new Date().toISOString())}:x));
              setDetail(prev=>prev?{...prev,...payload,resolvedAt:payload.status==="pending"?null:(prev.resolvedAt||new Date().toISOString())}:prev);
              toast.success("Đã lưu báo cáo");
              setDetail(null);
            }catch(e){
              console.error(e);
              toast.error("Lưu báo cáo thất bại");
            }finally{ setSavingId(null); }
          }}
        />
      )}
    </div>
  );
}
