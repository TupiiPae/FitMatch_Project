import { useState, useEffect } from "react";
import "./Statistical.css"; // Dùng chung CSS cho đồng bộ

export function WorkoutModal({ options, initialSelectedIds, onClose, onSave }) {
  const [ids, setIds] = useState(initialSelectedIds || []);
  const toggle = (id) => setIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  return (
    <div className="st-modal-backdrop" onClick={onClose}><div className="st-modal-card" onClick={e => e.stopPropagation()}>
      <div className="st-modal-head"><h3>Chọn lịch tập</h3><button onClick={onClose} className="st-close-btn">✕</button></div>
      <div className="st-modal-body st-worklist">{!options.length ? <div className="st-empty">Chưa có lịch tập</div> : options.map(w => (
        <label key={w.id} className={"st-workrow" + (ids.includes(w.id) ? " is-selected" : "")}>
          <input type="checkbox" checked={ids.includes(w.id)} onChange={() => toggle(w.id)} />
          <div className="st-workrow-main"><div className="st-workrow-title">{w.name}</div><div className="st-workrow-sub">{w.kcal ? w.kcal + " kcal" : "-"}</div></div>
        </label>
      ))}</div>
      <div className="st-modal-foot"><button className="st-btn ghost" onClick={onClose}>Hủy</button><button className="st-btn primary" onClick={() => onSave(options.filter(o => ids.includes(o.id)))}>Lưu</button></div>
    </div></div>
  );
}

export function SimpleInputModal({ title, currentVal, unit, step, onClose, onSave }) {
  const [val, setVal] = useState(currentVal || "");
  return (
    <div className="st-modal-backdrop" onClick={onClose}><div className="st-modal-card sm" onClick={e => e.stopPropagation()}>
      <div className="st-modal-head"><h3>{title}</h3><button onClick={onClose} className="st-close-btn">✕</button></div>
      <div className="st-modal-body">
        <div className="st-input-group">
          <input type="number" step={step || 1} value={val} onChange={e => setVal(e.target.value)} autoFocus />
          <span>{unit}</span>
        </div>
      </div>
      <div className="st-modal-foot"><button className="st-btn ghost" onClick={onClose}>Hủy</button><button className="st-btn primary" onClick={() => onSave(parseFloat(val))}>Lưu</button></div>
    </div></div>
  );
}