// admin-app/src/pages/pagesConnect/modals/ConnectRoomUserReportsModal.jsx
import React,{useEffect,useMemo,useState} from "react";
import { toast } from "react-toastify";
import { listConnectReportsAdmin } from "../../../lib/api";

const fmtDate=(d)=>{ if(!d) return "—"; try{ return new Date(d).toLocaleString(); }catch{ return "—"; } };

const REASON_LABELS={
  spam:"Spam / Quảng cáo",
  scam:"Lừa đảo",
  harassment:"Quấy rối",
  inappropriate:"Nội dung không phù hợp",
  fake:"Giả mạo",
  other:"Khác",
};

const badgeLabel=(s)=>s==="pending"?"Chờ xử lý":s==="reviewed"?"Đã xử lý":s==="dismissed"?"Bỏ qua":(s||"—");
const badgeClass=(s)=>s==="pending"?"closed":s==="reviewed"?"active":s==="dismissed"?"full":"";

export default function ConnectRoomUserReportsModal({ open, user, onClose }){
  const userId = user?.id || null;
  const name = useMemo(()=> user?.nickname || user?.username || user?.email || "Người dùng", [user]);

  const [loading,setLoading]=useState(false);
  const [items,setItems]=useState([]);
  const [page,setPage]=useState(1);
  const [pages,setPages]=useState(1);
  const [total,setTotal]=useState(0);

  const load=async(p=1)=>{
    if(!userId) return;
    setLoading(true);
    try{
      const res = await listConnectReportsAdmin({ type:"user", targetUserId:userId, page:p, limit:20 });
      const arr = Array.isArray(res?.items)?res.items:[];
      setItems(arr);
      setPage(Number(res?.page||p));
      setPages(Number(res?.pages||1));
      setTotal(Number(res?.total||arr.length||0));
    }catch(err){
      console.error(err);
      toast.error(err?.response?.data?.message || "Không thể tải báo cáo của người dùng");
      setItems([]); setPage(1); setPages(1); setTotal(0);
    }finally{ setLoading(false); }
  };

  useEffect(()=>{
    if(open && userId){ load(1); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[open,userId]);

  if(!open) return null;

  return (
    <div className="cm-backdrop cr-z-top" onClick={onClose}>
      <div className="cr-report-modal" onClick={(e)=>e.stopPropagation()}>
        <div className="cr-detail-head">
          <div className="cr-detail-title">
            <div className="t1">Báo cáo của: {name} ({total})</div>
            <div className="t2">Email: {user?.email||""}</div>
          </div>
          <button className="iconbtn" onClick={onClose} title="Đóng"><i className="fa-solid fa-xmark" /></button>
        </div>

        <div className="cr-detail-body">
          {loading && <div>Đang tải...</div>}
          {!loading && items.length===0 && <div className="cr-sub">Chưa có báo cáo.</div>}

          {!loading && items.length>0 && (
            <div className="cr-report-list">
              {items.map((r)=> {
                const reasons = Array.isArray(r?.reasons)?r.reasons:[];
                const reporterName = r?.reporter?.profile?.nickname || r?.reporter?.username || r?.reporter?.email || "—";
                const reporterEmail = r?.reporter?.email || "";
                const otherReason = (r?.otherReason||"").trim();
                const note = (r?.note||"").trim();
                const adminNote = (r?.adminNote||"").trim();
                const snapNick = r?.snapshot?.nickname || r?.targetUser?.profile?.nickname || r?.targetUser?.username || r?.targetUser?.email || "";
                const status = (r?.status||"").toLowerCase();

                return (
                  <div key={r._id} className="cr-report-item">
                    <div className="cr-report-top">
                      <div className={"cr-badge "+badgeClass(status)}>{badgeLabel(status).toUpperCase()}</div>
                      <div className="cr-sub">{fmtDate(r?.createdAt)}{r?.resolvedAt?` • Xử lý: ${fmtDate(r.resolvedAt)}`:""}</div>
                    </div>

                    <div className="cr-report-reason">
                      <b>Đối tượng:</b> {snapNick || name}
                    </div>

                    <div className="cr-report-reason">
                      <b>Lý do:</b>{" "}
                      {reasons.length?reasons.map(x=>REASON_LABELS[x]||x).join(", "):"—"}
                      {otherReason?` • Khác: ${otherReason}`:""}
                    </div>

                    {note && <div className="cr-report-reason"><b>Ghi chú:</b> {note}</div>}
                    {adminNote && <div className="cr-report-reason"><b>Admin note:</b> {adminNote}</div>}

                    <div className="cr-sub">
                      Người báo cáo: {reporterName}{reporterEmail?` • ${reporterEmail}`:""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="cm-foot">
          <button className="btn ghost" onClick={onClose}>Đóng</button>
          <div className="cr-pager">
            <button className="btn ghost" disabled={loading||page<=1} onClick={()=>load(page-1)}><i className="fa-solid fa-chevron-left" /> Trang trước</button>
            <span className="cr-sub">Trang {page}/{pages}</span>
            <button className="btn ghost" disabled={loading||page>=pages} onClick={()=>load(page+1)}>Trang sau <i className="fa-solid fa-chevron-right" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
