// admin-app/src/pages/pagesReportUser/Report_DetailModal.jsx
import React,{useEffect,useMemo,useState} from "react";
import "./Report_DetailModal.css";

const STATUS_OPTS=[{v:"pending",l:"Chờ xử lý"},{v:"reviewed",l:"Đã xử lý"},{v:"dismissed",l:"Bỏ qua"}];
const STATUS_CLS=(s)=>s==="reviewed"?"reviewed":s==="dismissed"?"dismissed":"pending";
const REASON_LABELS={spam:"Spam/quảng cáo",scam:"Lừa đảo",harassment:"Quấy rối",inappropriate:"Nội dung không phù hợp",fake:"Giả mạo",other:"Khác"};
const fmt=(v)=>v?new Date(v).toLocaleString("vi-VN"):"—";
const code=(id)=>id?`#${String(id).slice(-6)}`:"—";

export default function Report_DetailModal({data,onClose,onSave,saving}){
  const [status,setStatus]=useState("pending");
  const [adminNote,setAdminNote]=useState("");
  useEffect(()=>{if(!data)return;setStatus(data.status||"pending");setAdminNote(data.adminNote||"");},[data]);

  const reporter=useMemo(()=>data?.reporter||null,[data]);
  const targetType=data?.targetType||data?.snapshot?.targetType||"";
  const targetUser=data?.targetUser||null;
  const targetRoom=data?.targetRoom||null;
  const snap=data?.snapshot||null;

  const targetTitle=useMemo(()=>{
    if(targetType==="user"){
      const u=targetUser||{};
      const nick=u?.profile?.nickname||u?.username||u?.email||snap?.nickname||"(Không có tên)";
      return `Người dùng: ${nick}`;
    }
    if(targetType==="group"){
      const name=targetRoom?.name||snap?.name||"(Không có tên nhóm)";
      return `Nhóm: ${name}`;
    }
    return "(Không xác định)";
  },[targetType,targetUser,targetRoom,snap]);

  const targetSub=useMemo(()=>{
    if(targetType==="user"){
      const u=targetUser||{};
      const email=u?.email||"";
      const uname=u?.username||"";
      const loc=snap?.locationLabel||"";
      return [email||uname,loc].filter(Boolean).join(" • ")||"—";
    }
    if(targetType==="group"){
      const loc=targetRoom?.locationLabel||snap?.locationLabel||"";
      const goal=targetRoom?.goalLabel||snap?.goalLabel||"";
      const mem=(targetRoom?.members?.length??snap?.membersCount);
      const max=(targetRoom?.maxMembers??snap?.maxMembers);
      const mm=(mem!=null&&max!=null)?`${mem}/${max} thành viên`:"";
      return [loc,goal,mm].filter(Boolean).join(" • ")||"—";
    }
    return "—";
  },[targetType,targetUser,targetRoom,snap]);

  const reasons=useMemo(()=>{
    const arr=Array.isArray(data?.reasons)?data.reasons:[];
    const mapped=arr.map(r=>REASON_LABELS[r]||r).filter(Boolean);
    if(data?.otherReason) mapped.push(`Khác: ${data.otherReason}`);
    return mapped;
  },[data]);

  if(!data) return null;

  return(
    <div className="rp-backdrop" onClick={onClose}>
      <div className="rp-modal" onClick={(e)=>e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="rp-head">
          <div className="rp-head-left">
            <div className="rp-title">Chi tiết báo cáo {code(data._id)}</div>
            <div className="rp-sub">Tạo lúc: {fmt(data.createdAt)} • Cập nhật: {fmt(data.updatedAt)}</div>
          </div>
          <button className="rp-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark"/></button>
        </div>

        <div className="rp-body">
          <div className="rp-grid">
            <div className="rp-box">
              <div className="rp-box-title">Người báo cáo</div>
              <div className="rp-row">
                <div className="rp-avatar">{reporter?.profile?.avatarUrl?<img alt="" src={reporter.profile.avatarUrl}/>:<i className="fa-solid fa-user"/>}</div>
                <div className="rp-col">
                  <div className="rp-strong">{reporter?.profile?.nickname||reporter?.username||reporter?.email||"—"}</div>
                  <div className="rp-muted">{[reporter?.email,reporter?.username].filter(Boolean).join(" • ")||"—"}</div>
                </div>
              </div>
            </div>

            <div className="rp-box">
              <div className="rp-box-title">Đối tượng bị báo cáo</div>
              <div className="rp-strong">{targetTitle}</div>
              <div className="rp-muted">{targetSub}</div>
            </div>

            <div className="rp-box rp-box-wide">
              <div className="rp-box-title">Lý do</div>
              <div className="rp-chipline">
                {reasons?.length?reasons.map((x,idx)=>(<span key={idx} className="rp-chip">{x}</span>)):<span className="rp-muted">—</span>}
              </div>
            </div>

            <div className="rp-box rp-box-wide">
              <div className="rp-box-title">Ghi chú người dùng</div>
              <div className="rp-note">{data.note||"—"}</div>
            </div>

            <div className="rp-box">
              <div className="rp-box-title">Trạng thái</div>
              <select className={"rp-status "+STATUS_CLS(status)} value={status} onChange={(e)=>setStatus(e.target.value)} disabled={!!saving}>
                {STATUS_OPTS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <div className="rp-muted" style={{marginTop:8}}>
                {data.resolvedAt?`Resolved: ${fmt(data.resolvedAt)}`:"Chưa resolved"}
              </div>
            </div>

            <div className="rp-box">
              <div className="rp-box-title">Ghi chú admin</div>
              <textarea className="rp-textarea" value={adminNote} onChange={(e)=>setAdminNote(e.target.value)} placeholder="Nhập ghi chú xử lý..." maxLength={1000}/>
              <div className="rp-muted">{adminNote?.length||0}/1000</div>
            </div>
          </div>
        </div>

        <div className="rp-foot">
          <button className="btn ghost" onClick={onClose}>Đóng</button>
          <button className="btn primary" disabled={!!saving} onClick={()=>onSave?.({status,adminNote})}>
            {saving?"Đang lưu...":"Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
