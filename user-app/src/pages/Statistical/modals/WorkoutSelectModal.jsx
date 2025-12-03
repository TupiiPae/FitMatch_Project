// user-app/src/pages/Statistical/modals/WorkoutSelectModal.jsx
import { useEffect, useState } from "react";

export default function WorkoutSelectModal({
  options,
  initialSelectedIds,
  onClose,
  onSave,
}) {
  const [selectedIds, setSelectedIds] = useState(initialSelectedIds || []);

  useEffect(() => {
    setSelectedIds(initialSelectedIds || []);
  }, [initialSelectedIds]);

  const toggleId = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    const selected = options.filter((o) => selectedIds.includes(o.id));
    onSave(selected);
  };

  return (
    <div className="st-modal-backdrop" onClick={onClose}>
      <div className="st-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="st-modal-head">
          <h3>Chọn lịch tập đã thực hiện</h3>
          <button type="button" className="st-modal-close" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="st-modal-body">
          {options.length === 0 ? (
            <div className="st-empty">
              Bạn chưa có lịch tập nào. Hãy tạo lịch tập trong mục "Lịch tập
              của bạn" trước.
            </div>
          ) : (
            <div className="st-worklist">
              {options.map((w) => (
                <label
                  key={w.id}
                  className={
                    "st-workrow" +
                    (selectedIds.includes(w.id) ? " is-selected" : "")
                  }
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(w.id)}
                    onChange={() => toggleId(w.id)}
                  />
                  <div className="st-workrow-main">
                    <div className="st-workrow-title">{w.name}</div>
                    <div className="st-workrow-sub">
                      {w.kcal ? `${w.kcal} kcal` : "Chưa có dữ liệu kcal"}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
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
