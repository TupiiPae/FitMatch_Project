// admin-app/src/pages/pagesConnect/modals/ConnectRoomDetailModal.jsx
import React from "react";

function Avatar({url,name}){
  return <div className="cr-av">{url?<img src={url} alt={name||"av"} />:<i className="fa-solid fa-user" />}</div>;
}
function GroupCover({url,name}){
  return (
    <div className="cr-cover">
      {url ? <img src={url} alt={name||"cover"} /> : <div className="cr-cover-ph"><i className="fa-solid fa-users" /></div>}
    </div>
  );
}
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

export default function ConnectRoomDetailModal({
  open,detail,processingKey,fmtCode,fmtDate,statusLabel,joinPolicyLabel,
  onClose,onReload,onAskClose,onAskDelete,onAskKick,onAskTransfer,onOpenReports
}){
  if(!open||!detail) return null;
  const d = detail?.data || null;
  return (
    <div className="cm-backdrop cr-z-mid" onClick={onClose}>
      <div className="cr-detail" onClick={(e)=>e.stopPropagation()}>
        <div className="cr-detail-head">
          <div className="cr-detail-title">
            <div className="rp-title">Chi tiết phòng {fmtCode(detail.id)}</div>
            <div className="rp-sub">ID phòng: {detail.id}</div>
          </div>
          <button className="rp-x" onClick={onClose} title="Đóng"><i className="fa-solid fa-xmark" /></button>
        </div>

        {detail.loading && <div className="cr-detail-body">Đang tải...</div>}

        {!detail.loading && d && (
          <div className="cr-detail-body">
            {/* Ảnh nhóm trong modal chi tiết */}
            {d.type==="group" && (
              <div className="cr-detail-cover">
                <GroupCover url={d.coverImageUrl} name={d.name}/>
                <div className="cr-detail-cover-meta">
                  <div className="cr-detail-cover-name">{d.name || "—"}</div>
                  <div className="cr-sub">{d.locationLabel || "—"} • {d.goalLabel || "—"}</div>
                </div>
              </div>
            )}

            <div className="cr-kv">
              <div className="k">Loại kết nối</div><div className="v">{d.type==="duo"?"Cặp đôi":"Nhóm"}</div>
              <div className="k">Trạng thái</div><div className="v">{statusLabel(d.status)}</div>
              <div className="k">Số thành viên</div><div className="v">{(d.members||[]).length}/{d.maxMembers}</div>

              {d.type==="group" && <>
                <div className="k">Kiểu tham gia</div><div className="v">{joinPolicyLabel(d.joinPolicy)}</div>
                <div className="k">Yêu cầu chờ duyệt</div><div className="v">{d.pendingJoinRequests||0}</div>
              </>}

              <div className="k">Báo cáo</div>
              <div className="v" title="Báo cáo chờ xử lý / Tổng số báo cáo">{(d.reportsPending||0)}/{(d.reportsTotal||0)}</div>

              <div className="k">Tạo lúc</div><div className="v">{fmtDate(d.createdAt)}</div>
              <div className="k">Cập nhật</div><div className="v">{fmtDate(d.updatedAt)}</div>
            </div>

            <div className="cr-detail-actions">

              <button className="btn close" disabled={processingKey===detail.id} onClick={()=>onAskClose(detail.id)}>
                <i className="fa-regular fa-circle-xmark" /> <span>Đóng phòng</span>
              </button>

              <button className="btn danger" disabled={processingKey===detail.id} onClick={()=>onAskDelete(detail.id)}>
                <i className="fa-regular fa-trash-can" /> <span>Xóa kết nối</span>
              </button>
            </div>

            <div className="cr-members-list">
              <div className="cr-section-title">Danh sách thành viên</div>
              {(d.members||[]).map(m=>(
                <div key={m.id} className="cr-mrow">
                  <MemberChip m={m}/>
                  <div className="cr-mact">
                    <button className="btn ghost sm" onClick={()=>onOpenReports(m)}>
                      <i className="fa-solid fa-flag" /> <span>Xem báo cáo</span>
                    </button>

                    {d.type==="group" && m.role!=="owner" && (
                      <button className="btn ghost sm" disabled={processingKey===detail.id} onClick={()=>onAskTransfer(detail.id,m)}>
                        <i className="fa-solid fa-crown" /> <span>Chuyển chủ phòng</span>
                      </button>
                    )}

                    {!(d.type==="group" && m.role==="owner") && (
                      <button className="btn ghost sm danger" disabled={processingKey===detail.id} onClick={()=>onAskKick(detail.id,m)}>
                        <i className="fa-solid fa-user-slash" /> <span>Loại khỏi phòng</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
