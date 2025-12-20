// admin-app/src/pages/pagesConnect/modals/ConnectRoomConfirmModal.jsx
import React from "react";

export default function ConnectRoomConfirmModal({ open, confirm, processingKey, onClose, onConfirm, onChange }){
  if(!open || !confirm) return null;
  const title =
    confirm.kind==="close"?"Đóng phòng?"
    :confirm.kind==="kick"?"Loại thành viên?"
    :confirm.kind==="transfer"?"Chuyển chủ phòng?"
    :confirm.kind==="deleteOne"?"Xóa kết nối?"
    :confirm.kind==="deleteMany"?"Xóa nhiều kết nối?"
    :"Xác nhận";

  const busy = (processingKey===(confirm?.item?._id || confirm?.roomId)) || (processingKey==="bulk" && confirm.kind==="deleteMany");
  const needReason = confirm.kind==="kick";

  return (
    <div className="cm-backdrop cr-z-top" onClick={onClose}>
      <div className="cm-modal" onClick={(e)=>e.stopPropagation()}>
        <div className="cm-head"><h1 className="cm-title">{title}</h1></div>

        <div className="cm-body">
          <div>{confirm.message}</div>

          {needReason && (
            <div className="cr-form">
              <label className="cr-lb">Ghi chú (tuỳ chọn)</label>
              <textarea className="cr-ta" value={confirm.reason||""} onChange={(e)=>onChange({ reason:e.target.value })} placeholder="Nhập ghi chú..." />
            </div>
          )}
        </div>

        <div className="cm-foot">
          <button className="btn ghost" onClick={onClose}>Đóng</button>
          <button className="btn danger" disabled={busy} onClick={()=>onConfirm(confirm)}>Xác nhận</button>
        </div>
      </div>
    </div>
  );
}
