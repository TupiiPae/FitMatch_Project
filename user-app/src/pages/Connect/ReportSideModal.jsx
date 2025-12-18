import { useEffect, useMemo, useState } from "react";
import "./ReportSideModal.css";

const REASON_OPTIONS=[
  { key:"spam", label:"Spam / quảng cáo" },
  { key:"scam", label:"Lừa đảo / mạo danh giao dịch" },
  { key:"harassment", label:"Quấy rối / xúc phạm" },
  { key:"inappropriate", label:"Nội dung không phù hợp" },
  { key:"fake", label:"Hồ sơ/nhóm giả" },
  { key:"other", label:"Khác (tự nhập)" },
];

export default function ReportSideModal({ open, target, loading, onClose, onSubmit }){
  const [picked,setPicked]=useState([]);
  const [otherReason,setOtherReason]=useState("");
  const [note,setNote]=useState("");

  const isGroup=!!target?.isGroup;
  const title=isGroup?"Báo cáo nhóm":"Báo cáo người dùng";

  const thumb=useMemo(()=>{
    const s=String(target?.imageUrl||"").trim();
    return s || "/images/avatar.png";
  },[target]);

  useEffect(()=>{ if(open){ setPicked([]); setOtherReason(""); setNote(""); } },[open]);

  const toggle=(k)=>setPicked(p=>p.includes(k)?p.filter(x=>x!==k):[...p,k]);
  const hasOther=picked.includes("other");

  const canSubmit=useMemo(()=>{
    const reasons=picked.filter(x=>x!=="other");
    const okReasons=reasons.length>0;
    const okOther=hasOther ? !!otherReason.trim() : false;
    return okReasons || okOther;
  },[picked,hasOther,otherReason]);

  if(!open) return null;

  return (
    <div className="rp-overlay" onMouseDown={(e)=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <aside className="rp-panel" role="dialog" aria-modal="true">
        <div className="rp-head">
          <div className="rp-head-left">
            <h3 className="rp-title">{title}</h3>
            <p className="rp-sub">Chọn lý do báo cáo để admin xem xét.</p>
          </div>
          <button className="rp-close" type="button" onClick={onClose} disabled={loading}><i className="fa-solid fa-xmark"/></button>
        </div>

        <div className="rp-target">
          <img className="rp-target-img" src={thumb} alt={target?.nickname||target?.name||"target"} />
          <div className="rp-target-info">
            <div className="rp-target-name">{target?.nickname||target?.name||"—"}</div>
            {target?.locationLabel ? <div className="rp-target-meta"><i className="fa-solid fa-location-dot"/> {target.locationLabel}</div> : null}
          </div>
        </div>

        <div className="rp-body">
          <div className="rp-section-title">Lý do</div>
          <div className="rp-reasons">
            {REASON_OPTIONS.map(o=>(
              <label key={o.key} className={"rp-reason"+(picked.includes(o.key)?" is-on":"")}>
                <input type="checkbox" checked={picked.includes(o.key)} onChange={()=>toggle(o.key)} disabled={loading}/>
                <span>{o.label}</span>
              </label>
            ))}
          </div>

          {hasOther && (
            <div className="rp-field">
              <div className="rp-label">Lý do khác</div>
              <input className="rp-input" value={otherReason} onChange={(e)=>setOtherReason(e.target.value)} placeholder="Nhập lý do..." maxLength={200} disabled={loading}/>
            </div>
          )}

          <div className="rp-field">
            <div className="rp-label">Ghi chú (tuỳ chọn)</div>
            <textarea className="rp-textarea" value={note} onChange={(e)=>setNote(e.target.value)} placeholder="Mô tả thêm để quản trị viên xử lý nhanh hơn..." maxLength={500} disabled={loading}/>
          </div>
        </div>

        <div className="rp-actions">
          <button className="rp-btn rp-btn-ghost" type="button" onClick={onClose} disabled={loading}>Huỷ</button>
          <button className="rp-btn rp-btn-danger" type="button" disabled={loading||!canSubmit}
            onClick={()=>onSubmit?.({ reasons:picked.filter(x=>x!=="other"), otherReason: hasOther?otherReason.trim():"", note: note.trim() })}>
            {loading ? "Đang gửi..." : "Gửi báo cáo"}
          </button>
        </div>
      </aside>
    </div>
  );
}
