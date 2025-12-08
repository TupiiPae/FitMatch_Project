import { useEffect, useMemo, useState, useRef } from "react";
import { listExercises } from "../../../api/exercises";
import api from "../../../lib/api";
import "./ExercisePicker.css";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => { if (!u) return u; try { return new URL(u, API_ORIGIN).toString(); } catch { return u; } };
const PLACEHOLDER = "/images/food-placeholder.jpg";
const TYPE_VI = { Strength: "Kháng lực", Cardio: "Cardio",};

export default function ExercisePicker({
  types = ["Strength", "Cardio"],
  onClose,
  onSelect,
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const searchTimer = useRef(null);

  // A-Z theo tiếng Việt, bỏ dấu
  const compareVi = (a, b) =>
    String(a?.name || "").localeCompare(String(b?.name || ""), "vi", { sensitivity: "base" });

  const buildParams = () => ({ limit: 200, q: q || undefined }); // lấy nhiều để cuộn dài

  async function load() {
    setLoading(true);
    try {
      const resp = await listExercises(buildParams());
      const payload = resp?.items ? resp : resp?.data || resp;
      let list = payload?.items || [];
      // chỉ giữ Strength + Cardio (hoặc theo props.types)
      const allow = new Set(types?.length ? types : ["Strength", "Cardio"]);
      list = list.filter((x) => allow.has(x?.type));
      list.sort(compareVi);
      setItems(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* mount */ }, []);
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(load, 300);
    return () => clearTimeout(searchTimer.current);
  }, [q, JSON.stringify(types)]);

  // Lọc client lần nữa để chắc ăn (bỏ dấu)
  const vnNorm = (s) =>
    String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

  const filtered = useMemo(() => {
    const key = vnNorm(q);
    if (!key) return items;
    return items.filter((it) => vnNorm(it.name).includes(key));
  }, [items, q]);

  // ===== Detail popup =====
  const [detail, setDetail] = useState(null);
  const openDetail = (it) => setDetail(it);
  const closeDetail = () => setDetail(null);

  return (
    <div className="ep-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="ep-modal" onClick={(e) => e.stopPropagation()} role="document">
        {/* Header */}
        <div className="ep-titlebar">
          <div className="ep-title">Danh sách bài tập</div>
          <button className="ep-close" aria-label="Đóng" onClick={onClose}>×</button>
        </div>

        {/* Search */}
        <div className="ep-search">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            placeholder="Tìm kiếm bài tập"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            aria-label="Tìm kiếm bài tập"
          />
        </div>

        {/* List (cuộn dài) */}
        <div className="ep-list">
          {loading && !filtered.length ? (
            <div className="ep-empty">Đang tải…</div>
          ) : filtered.length ? (
            filtered.map((it) => (
              <div key={it._id} className="ep-row" onClick={() => openDetail(it)}>
                <img src={toAbs(it.imageUrl) || PLACEHOLDER} alt={it.name} />
                <div className="ep-info">
                  <div className="ep-name">{it.name}</div>
                  <div className="ep-sub">
                    {TYPE_VI[it.type] || it.type || "—"} · {it.level || "—"}
                  </div>
                </div>
                <div className="ep-act" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="ep-add"
                    title="Chọn bài tập này"
                    onClick={() => { onSelect?.(it); onClose?.(); }}
                  >
                    <i className="fa-solid fa-plus" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="ep-empty">Không có kết quả</div>
          )}
        </div>
      </div>

      {/* Detail overlay (ảnh trái, hồ sơ phải) */}
      {detail && (
        <div className="epd-backdrop" onClick={closeDetail}>
          <div className="epd-card" onClick={(e) => e.stopPropagation()}>
            <button className="epd-close" aria-label="Đóng" onClick={closeDetail}>×</button>

            <div className="epd-grid">
              {/* Left: Image */}
              <div className="epd-left">
                <div className="epd-img">
                  <img src={toAbs(detail.imageUrl) || PLACEHOLDER} alt={detail.name} />
                </div>
              </div>

              {/* Right: Profile table (rút gọn từ ExerciseDetail) */}
              <div className="epd-right">
                <div className="epd-title">{detail.name}</div>
                <div className="epd-sub">
                  #{TYPE_VI[detail.type] || detail.type || "—"}
                </div>

                <table className="epd-table">
                  <tbody>
                    <tr>
                      <th>Nhóm cơ chính</th>
                      <td>{(detail.primaryMuscles || [])[0] || "—"}</td>
                    </tr>
                    <tr>
                      <th>Nhóm cơ phụ</th>
                      <td>{(detail.secondaryMuscles || []).join(", ") || "—"}</td>
                    </tr>
                    <tr>
                      <th>Mức độ</th>
                      <td>{detail.level || "—"}</td>
                    </tr>
                    <tr>
                      <th>Dụng cụ</th>
                      <td>{detail.equipment || "—"}</td>
                    </tr>
                    <tr>
                      <th>Giá trị MET</th>
                      <td>{detail.caloriePerRep ?? "—"}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="epd-actions">
                  <button className="epd-pick"
                    onClick={() => { onSelect?.(detail); onClose?.(); }}>
                    <i className="fa-solid fa-plus" /> Chọn bài tập này
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
