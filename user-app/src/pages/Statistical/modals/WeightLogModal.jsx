// user-app/src/pages/Statistical/modals/WeightLogModal.jsx
import { useState } from "react";

export default function WeightLogModal({
  initialWeight,
  dateLabel,
  onClose,
  onSave,
}) {
  const [weight, setWeight] = useState(
    initialWeight != null ? initialWeight : ""
  );

  const handleSave = () => {
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) return;
    onSave(w);
  };

  return (
    <div className="st-modal-backdrop" onClick={onClose}>
      <div className="st-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="st-modal-head">
          <h3>Cập nhật cân nặng – {dateLabel}</h3>
          <button type="button" className="st-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="st-modal-body">
          <label className="st-weight-label">Cân nặng</label>
          <div className="st-weight-input-row">
            <input
              type="number"
              step="0.1"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
            <span className="st-weight-unit">kg</span>
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
