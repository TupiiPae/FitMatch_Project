import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getExerciseMeta, listExercises } from "../../api/exercises";
import api from "../../lib/api";
import "./Exercises.css";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => { if (!u) return u; try { return new URL(u, API_ORIGIN).toString(); } catch { return u; } };

// Enum -> VI label
const TYPE_VI = { Strength: "Kháng lực", Cardio: "Cardio", Sport: "Thể thao" };

export default function ExercisesList({ type = "Strength", title = "Các bài tập" }) {
  const nav = useNavigate();
  const [meta, setMeta] = useState({ MUSCLE_GROUPS: [], EQUIPMENTS: [], LEVELS: [] });

  // head state
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState({ primary: "", equipment: "", level: "" });

  // list state
  const [items, setItems] = useState([]);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  // load meta once
  useEffect(() => {
    (async () => {
      try {
        const d = await getExerciseMeta();
        setMeta({
          MUSCLE_GROUPS: d?.MUSCLE_GROUPS || [],
          EQUIPMENTS: d?.EQUIPMENTS || [],
          LEVELS: d?.LEVELS || [],
        });
      } catch {}
    })();
  }, []);

  // params
  const baseParams = useMemo(() => ({
    type,
    q: q.trim() || undefined,
    primary: filters.primary || undefined,
    equipment: filters.equipment || undefined,
    level: filters.level || undefined,
    sort: "name", // A->Z
  }), [type, q, filters]);

  // lần đầu: 40 item
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await listExercises({ ...baseParams, limit: 40, skip: 0 });
        setItems(res.items || []);
        setSkip(res.items?.length || 0);
        setHasMore(!!res.hasMore);
      } finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [baseParams]);

  // xem thêm: +8
  async function loadMore() {
    if (!hasMore || loading) return;
    setLoading(true);
    try {
      const res = await listExercises({ ...baseParams, limit: 8, skip });
      setItems((s) => [...s, ...(res.items || [])]);
      setSkip((v) => v + (res.items?.length || 0));
      setHasMore(!!res.hasMore);
    } finally { setLoading(false); }
  }

  return (
    <div className="nm-wrap">
      {/* ===== HEAD (đồng bộ RecordMeal + thêm caret icon & nút tạo lịch) ===== */}
      <div className="nm-head exh">
        <div className="search">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            placeholder="Tìm kiếm bài tập"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="ex-select">
          <select
            value={filters.primary}
            onChange={(e) => setFilters((f) => ({ ...f, primary: e.target.value }))}
            title="Nhóm cơ"
          >
            <option value="">Nhóm cơ</option>
            {meta.MUSCLE_GROUPS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <i className="fa-solid fa-caret-down" aria-hidden="true"></i>
        </div>

        <div className="ex-select">
          <select
            value={filters.equipment}
            onChange={(e) => setFilters((f) => ({ ...f, equipment: e.target.value }))}
            title="Dụng cụ"
          >
            <option value="">Dụng cụ</option>
            {meta.EQUIPMENTS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <i className="fa-solid fa-caret-down" aria-hidden="true"></i>
        </div>

        <div className="ex-select">
          <select
            value={filters.level}
            onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))}
            title="Mức độ"
          >
            <option value="">Mức độ</option>
            {meta.LEVELS.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          <i className="fa-solid fa-caret-down" aria-hidden="true"></i>
        </div>

        {/* Nút tạo lịch tập ngoài cùng bên phải */}
        <Link to="/tap-luyen/lich-cua-ban" className="create-btn ex-create-plan">
          Tạo lịch tập
        </Link>
      </div>

      {/* ===== LIST-FRAME ===== */}
      <div className="nm-list-frame">
        <div className="ex-grid ex-grid-4">
          {items.map((it) => (
            <div key={it._id} className="ex-card" onClick={() => nav(`/tap-luyen/bai-tap/chi-tiet/${it._id}`)}>
              <div className="ex-thumb">
                <img src={toAbs(it.imageUrl)} alt={it.name} loading="lazy" />
              </div>
              <div className="ex-name">{it.name}</div>
              <div className="ex-chips">
                <span className="ex-chip">{TYPE_VI[it.type] || it.type}</span>
                <span className="ex-chip">{it.equipment}</span>
                <span className="ex-chip">{it.level}</span>
                <span className="ex-chip">MET: {Number(it.caloriePerRep ?? 0)}</span>
              </div>
              <div className="ex-tap">(Nhấp vào để xem chi tiết)</div>
            </div>
          ))}
        </div>

        {(!loading && items.length === 0) && (
          <div className="ex-empty">Không tìm thấy bài tập.</div>
        )}

        {hasMore && (
          <div className="more">
            <button disabled={loading} onClick={loadMore}>
              {loading ? "Đang tải..." : "Xem thêm"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
