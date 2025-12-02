// admin-app/src/pages/Contact/Contact_DetailModal.jsx
import React, { useEffect, useState } from "react";
import "./Contact_DetailModal.css";

const STATUS_OPTIONS = [
  { value: "new", label: "Mới" },
  { value: "processing", label: "Đang xử lý" },
  { value: "done", label: "Đã xong" },
];

const fmtDate = (v) =>
  v ? new Date(v).toLocaleString("vi-VN") : "—";

export default function ContactDetailModal({
  data,
  onClose,
  onChangeStatus, // giờ sẽ nhận { status, internalNote }
}) {
  const [status, setStatus] = useState(data?.status || "new");
  const [note, setNote] = useState(data?.internalNote || "");

  useEffect(() => {
    setStatus(data?.status || "new");
    setNote(data?.internalNote || "");
  }, [data?._id, data?.status, data?.internalNote]);

  if (!data) return null;

  const handleNoteChange = (e) => {
    const v = e.target.value || "";
    if (v.length <= 1000) {
      setNote(v);
    } else {
      setNote(v.slice(0, 1000));
    }
  };

  const handleSave = async () => {
    if (onChangeStatus) {
      const payload = {
        status,
        internalNote: (note || "").slice(0, 1000),
      };
      await onChangeStatus(payload);
    }
    onClose();
  };

  const handleReplyEmail = () => {
    if (!data.email) return;
    const subject = encodeURIComponent(
      `Re: ${data.subject || "Liên hệ từ FitMatch"}`
    );
    const body = encodeURIComponent(`Chào ${data.name || ""},\n\n`);
    window.location.href = `mailto:${data.email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="cm-backdrop" onClick={onClose}>
      <div
        className="cm-modal ctd-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="ctd-header">
          <div className="ctd-title">
            <span>CHI TIẾT LIÊN HỆ</span>
            <span className="ctd-id">
              #{String(data._id || "").slice(-6)}
            </span>
          </div>
          <button
            type="button"
            className="ctd-close"
            onClick={onClose}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Body */}
        <div className="ctd-body">
          {/* Block 1: Info */}
          <section className="ctd-block">
            <div className="ctd-row">
              <span className="label">Người gửi:</span>
              <span className="value">{data.name || "—"}</span>
            </div>
            <div className="ctd-row">
              <span className="label">Email:</span>
              <span className="value">{data.email || "—"}</span>
            </div>
            <div className="ctd-row">
              <span className="label">SĐT:</span>
              <span className="value">{data.phone || "—"}</span>
            </div>
            <div className="ctd-row">
              <span className="label">Thời gian:</span>
              <span className="value">{fmtDate(data.createdAt)}</span>
            </div>
          </section>

          {/* Block 2: Subject + Message */}
          <section className="ctd-block">
            <div className="ctd-row">
              <span className="label">Tiêu đề:</span>
              <span className="value">{data.subject || "—"}</span>
            </div>
            <div className="ctd-row ctd-row--full">
              <span className="label">Nội dung:</span>
              <p className="ctd-message">
                {data.message || "(Không có nội dung)"}
              </p>
            </div>
          </section>

          {/* Block 3: Internal note (editable) */}
          <section className="ctd-block">
            <div className="ctd-row ctd-row--full">
              <span className="label">
                Ghi chú nội bộ{" "}
                <span className="hint">(Chỉ admin thấy)</span>:
              </span>
              <div className="ctd-note-wrap">
                <textarea
                  className="ctd-note"
                  placeholder="Điền ghi chú nội bộ..."
                  value={note}
                  onChange={handleNoteChange}
                />
                <div className="ctd-note-count">
                  {note.length}/1000
                </div>
              </div>
            </div>
          </section>

          {/* Block 4: Status radios */}
          <section className="ctd-block">
            <div className="ctd-row ctd-row--status">
              <span className="label">Trạng thái:</span>
              <div className="ctd-status-group">
                {STATUS_OPTIONS.map((opt) => (
                  <label key={opt.value} className="ctd-radio">
                    <input
                      type="radio"
                      name="ctd-status"
                      value={opt.value}
                      checked={status === opt.value}
                      onChange={() => setStatus(opt.value)}
                    />
                    <span className={`pill status-${opt.value}`}>
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Footer buttons */}
        <div className="ctd-footer">
          <button
            type="button"
            className="btn ghost"
            onClick={onClose}
          >
            Đóng
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleReplyEmail}
            disabled={!data.email}
          >
            Phản hồi qua Email
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={handleSave}
          >
            Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}
