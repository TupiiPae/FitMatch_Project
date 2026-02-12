import { useEffect } from "react";
import "./ConfirmDeleteModal.css";

export default function ConfirmDeleteModal({
  open,
  title,
  message,
  confirmText = "Xóa",
  cancelText = "Hủy",
  loading = false,
  onClose,
  onConfirm,
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cdm-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="cdm-card" onClick={(e) => e.stopPropagation()}>

        <div className="cdm-head">
          <div className="cdm-txt">
            <div className="cdm-title">{title}</div>
            <div className="cdm-msg">{message}</div>
          </div>
        </div>

        <div className="cdm-actions">
          <button className="cdm-btn cdm-cancel" onClick={onClose} disabled={loading}>
            {cancelText}
          </button>
          <button className="cdm-btn cdm-danger" onClick={onConfirm} disabled={loading}>
            {loading ? "Đang xóa..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
