import React from "react";

/**
 * Modal thông báo không thể xoá – dùng chung cho tất cả danh sách.
 * - title: tiêu đề
 * - message: câu mô tả chính
 * - details: mảng string để in thêm chi tiết (danh sách thực đơn, món, v.v.)
 */
export default function CannotDeleteModal({
  open,
  title,
  message,
  details,
  onClose,
}) {
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
          <h1 className="cm-title">{title || "Không thể xoá"}</h1>
        </div>
        <div className="cm-body">
          <p>
            {message ||
              "Dữ liệu này đang được sử dụng nên không thể xoá."}
          </p>

          {Array.isArray(details) && details.length > 0 && (
            <ul className="cm-detail-list">
              {details.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
          )}
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
