import { useEffect, useMemo, useState } from "react";
import { listExercises } from "../../../api/exercises"; // bạn đã có file này
import "./ExercisePicker.css";

export default function ExercisePicker({ open, onClose, onSelect }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data } = await listExercises({ type: "Strength,Cardio", limit: 50, q });
      setItems(data?.items || data || []); // tùy API hiện tại trả gì
    } finally { setLoading(false); }
  }
  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q]);

  if (!open) return null;
  return (
    <div className="ep-backdrop" onClick={onClose}>
      <div className="ep-modal" onClick={e => e.stopPropagation()}>
        <div className="ep-head">
          <input placeholder="Tìm bài tập (Strength + Cardio)" value={q} onChange={e=>setQ(e.target.value)} />
          <button className="btn ghost" onClick={onClose}>Đóng</button>
        </div>
        <div className="ep-list">
          {loading ? <div className="ep-empty">Đang tải…</div> : items.map(it => (
            <button key={it._id} className="ep-item" onClick={() => { onSelect?.(it); onClose(); }}>
              <img src={it.imageUrl} alt={it.name} />
              <div className="ep-info">
                <div className="ep-name">{it.name}</div>
                <div className="ep-sub">{it.type} · {it.level}</div>
              </div>
            </button>
          ))}
          {!loading && items.length === 0 && <div className="ep-empty">Không có kết quả</div>}
        </div>
      </div>
    </div>
  );
}
