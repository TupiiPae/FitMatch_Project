import { useEffect, useState } from "react";
import { listExercises } from "../../../api/exercises";
import api from "../../../lib/api";
import "./ExercisePicker.css";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try { return new URL(u, API_ORIGIN).toString(); } catch { return u; }
};

export default function ExercisePicker({
  // Cho phép lọc trước theo loại (mặc định Strength + Cardio)
  types = ["Strength", "Cardio"],
  onClose,
  onSelect,
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // BE thường nhận 1 type; nếu nhiều loại -> bỏ type để BE trả tất cả rồi lọc client
  const buildParams = () => {
    const p = { limit: 50, q: q || undefined };
    if (Array.isArray(types) && types.length === 1) p.type = types[0];
    return p;
  };

  async function load() {
    setLoading(true);
    try {
      const resp = await listExercises(buildParams());
      const payload = resp?.items ? resp : resp?.data || resp;
      let list = payload?.items || [];
      if (Array.isArray(types) && types.length > 1) {
        const allow = new Set(types);
        list = list.filter(x => allow.has(x?.type));
      }
      setItems(list);
    } finally {
      setLoading(false);
    }
  }

  // mount + search debounce theo q/types
  useEffect(() => { load(); /* on mount */ }, []);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // stringify types để tránh re-run liên tục
  }, [q, JSON.stringify(types)]);

  return (
    <div className="ep-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ep-modal" onClick={(e) => e.stopPropagation()} role="document">
        <div className="ep-head">
          <input
            placeholder="Tìm bài tập (Strength + Cardio)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Tìm bài tập"
          />
          <button className="btn ghost" onClick={onClose}>Đóng</button>
        </div>

        <div className="ep-list">
          {loading ? (
            <div className="ep-empty">Đang tải…</div>
          ) : items.length ? (
            items.map((it) => (
              <button
                key={it._id}
                className="ep-item"
                onClick={() => { onSelect?.(it); onClose?.(); }}
              >
                <img src={toAbs(it.imageUrl) || "/images/food-placeholder.jpg"} alt={it.name} />
                <div className="ep-info">
                  <div className="ep-name">{it.name}</div>
                  <div className="ep-sub">{it.type} · {it.level || "—"}</div>
                </div>
              </button>
            ))
          ) : (
            <div className="ep-empty">Không có kết quả</div>
          )}
        </div>
      </div>
    </div>
  );
}
