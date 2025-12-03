// user-app/src/pages/Statistical/modals/StepsLogModal.jsx
import { useState } from "react";

export default function StepsLogModal({ initialSteps, dateLabel, onClose, onSave }) {
  const [steps, setSteps] = useState(initialSteps || 0);

  const handleSave = () => {
    const v = Math.max(0, Math.round(Number(steps) || 0));
    onSave(v);
  };

  return (
    <div className="st-modal-backdrop" onClick={onClose}>
      <div className="st-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="st-modal-head">
          <h3>Nhập bước chân – {dateLabel}</h3>
          <button type="button" className="st-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="st-modal-body">
          <label className="st-weight-label">Tổng số bước trong ngày</label>
          <div className="st-weight-input-row">
            <input
              type="number"
              step="100"
              min="0"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
            />
            <span className="st-weight-unit">bước</span>
          </div>
        </div>

        <div className="st-modal-foot">
          <button type="button" className="st-btn ghost" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="st-btn primary" onClick={handleSave}>
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}
