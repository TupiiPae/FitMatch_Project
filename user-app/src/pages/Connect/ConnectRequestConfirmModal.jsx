// user-app/src/pages/Connect/ConnectRequestConfirmModal.jsx
import React from "react";

export default function ConnectRequestConfirmModal({
  open,
  mode,          // 'send_duo' | 'send_group' | 'cancel_duo' | 'cancel_group' | 'accept_duo'
  targetName,    // tên user / nhóm
  onClose,
  onConfirm,
  loading = false,
}) {
  if (!open) return null;

  let title = "";
  let desc = "";
  let primaryLabel = "";
  let primaryClass = "cn-btn-primary";

  switch (mode) {
    case "send_duo":
      title = "Gửi lời mời kết nối?";
      desc = `Bạn sắp gửi lời mời kết nối đến ${targetName}. Nếu người ấy chấp nhận, hai bạn sẽ được đưa vào một phòng kết nối riêng để trò chuyện và đồng hành tập luyện.`;
      primaryLabel = "Gửi lời mời";
      primaryClass = "cn-btn-primary";
      break;
    case "send_group":
      title = "Gửi yêu cầu tham gia nhóm?";
      desc = `Bạn sắp gửi yêu cầu tham gia nhóm "${targetName}". Quản trị viên nhóm có thể chấp nhận hoặc từ chối yêu cầu của bạn.`;
      primaryLabel = "Gửi yêu cầu";
      primaryClass = "cn-btn-primary";
      break;
    case "cancel_duo":
      title = "Hủy lời mời kết nối?";
      desc = `Lời mời kết nối đang chờ phản hồi từ ${targetName}. Bạn có chắc chắn muốn hủy lời mời này?`;
      primaryLabel = "Hủy lời mời";
      primaryClass = "cn-btn-primary";
      break;
    case "cancel_group":
      title = "Hủy yêu cầu tham gia nhóm?";
      desc = `Yêu cầu tham gia nhóm "${targetName}" đang chờ xét duyệt. Bạn có chắc chắn muốn hủy yêu cầu này?`;
      primaryLabel = "Hủy yêu cầu";
      primaryClass = "cn-btn-primary";
      break;
    case "accept_duo":
      title = "Xác nhận lời mời kết nối?";
      desc = `${targetName} đã gửi lời mời kết nối cho bạn. Nếu bạn đồng ý, hệ thống sẽ tạo một phòng kết nối riêng cho hai bạn.`;
      primaryLabel = "Xác nhận kết nối";
      primaryClass = "cn-btn-success"; // nút xanh
      break;
    default:
      title = "Xác nhận thao tác";
      desc = "";
      primaryLabel = "Đồng ý";
      primaryClass = "cn-btn-primary";
  }

  const handleConfirm = () => {
    if (loading) return;
    onConfirm && onConfirm();
  };

  const handleClose = () => {
    if (loading) return;
    onClose && onClose();
  };

  return (
    <div className="cn-modal-backdrop" onClick={handleClose}>
      <div className="cn-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="cn-modal-title">{title}</h3>
        {desc && <p className="cn-modal-text">{desc}</p>}

        <div className="cn-modal-actions">
          <button
            type="button"
            className="cn-btn-ghost"
            onClick={handleClose}
            disabled={loading}
          >
            Để sau
          </button>
          <button
            type="button"
            className={primaryClass}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Đang xử lý..." : primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
