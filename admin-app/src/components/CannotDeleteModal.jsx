// admin-app/src/components/CannotDeleteModal.jsx
import React from "react";

/**
 * Modal thông báo không thể xoá – dùng chung cho tất cả danh sách.
 * Dùng lại class .cm-backdrop, .cm-modal để không bể giao diện.
 */
export default function CannotDeleteModal({ open, title, message, onClose }) {
  if (!open) return null;

  return (
    <div className="cm-backdrop" onClick={onClose}>
      <div
        className="cm-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="cm-head">
          <h1 className="cm-title">
            {title || "Không thể xoá"}
          </h1>
        </div>
        <div className="cm-body">
          {message ||
            "Dữ liệu này đang được người dùng sử dụng nên không thể xoá."}
        </div>
        <div className="cm-foot">
          <button className="btn" onClick={onClose}>
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}
