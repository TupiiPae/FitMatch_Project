import React, { useEffect, useMemo, useRef, useState } from "react";
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
  // filter đã áp dụng (dùng để call API)
  const [filters, setFilters] = useState({
    primary: "",
    secondary: "",
    equipment: "",
    level: "",
  });

  // dropdown filter
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({
    primary: [],     // Nhóm cơ chính chọn tạm
    secondary: [],   // Nhóm cơ phụ chọn tạm
    equipment: "",   // Dụng cụ chọn tạm
    level: "",       // Mức độ chọn tạm
  });
  const filterBtnRef = useRef(null);
  const filterPanelRef = useRef(null);

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

  // đồng bộ draftFilters từ filters khi mở dropdown
  const syncDraftFromApplied = () => {
    const parseList = (str) =>
      str
        ? str
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean)
        : [];
    setDraftFilters({
      primary: parseList(filters.primary),
      secondary: parseList(filters.secondary),
      equipment: filters.equipment || "",
      level: filters.level || "",
    });
  };

  // click bên ngoài để đóng dropdown
  useEffect(() => {
    if (!filterOpen) return;
    const handleClick = (e) => {
      if (
        filterPanelRef.current &&
        !filterPanelRef.current.contains(e.target) &&
        filterBtnRef.current &&
        !filterBtnRef.current.contains(e.target)
      ) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [filterOpen]);

  // có gì đang chọn trong draft
  const hasDraftFilters =
    draftFilters.primary.length > 0 ||
    draftFilters.secondary.length > 0 ||
    !!draftFilters.equipment ||
    !!draftFilters.level;

  // Đếm số filter đang áp dụng (mỗi nhóm cơ tính theo số mục)
  const parseAppliedList = (str) =>
    str
      ? str
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : [];

  const appliedPrimaryCount = parseAppliedList(filters.primary).length;
  const appliedSecondaryCount = parseAppliedList(filters.secondary).length;

  const appliedFiltersCount =
    appliedPrimaryCount +
    appliedSecondaryCount +
    (filters.equipment ? 1 : 0) +
    (filters.level ? 1 : 0);

  const hasAppliedFilters = appliedFiltersCount > 0;
  const hasAnySelection = hasDraftFilters || hasAppliedFilters;

  // params: mỗi cột lọc riêng field tương ứng
  const baseParams = useMemo(() => {
    return {
      type,
      q: q.trim() || undefined,
      primary: filters.primary || undefined,
      secondary: filters.secondary || undefined,
      equipment: filters.equipment || undefined,
      level: filters.level || undefined,
      sort: "name", // A->Z
    };
  }, [type, q, filters]);

  // lần đầu: 40 item
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await listExercises({ ...baseParams, limit: 40, skip: 0 });
        setItems(res.items || []);
        setSkip(res.items?.length || 0);
        setHasMore(!!res.hasMore);
      } finally {
        setLoading(false);
      }
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
    } finally {
      setLoading(false);
    }
  }

  // ==== HANDLER CHO FILTER DROPDOWN ====
  const togglePrimaryMuscle = (name) => {
    setDraftFilters((f) => {
      const exists = f.primary.includes(name);
      return {
        ...f,
        primary: exists ? f.primary.filter((x) => x !== name) : [...f.primary, name],
      };
    });
  };

  const toggleSecondaryMuscle = (name) => {
    setDraftFilters((f) => {
      const exists = f.secondary.includes(name);
      return {
        ...f,
        secondary: exists
          ? f.secondary.filter((x) => x !== name)
          : [...f.secondary, name],
      };
    });
  };

  const handleApplyFilters = () => {
    // Áp dụng cả 4 loại filter; nếu tất cả trống -> quay về danh sách full
    setFilters({
      primary: draftFilters.primary.join(","),       // Nhóm cơ chính
      secondary: draftFilters.secondary.join(","),   // Nhóm cơ phụ
      equipment: draftFilters.equipment,
      level: draftFilters.level,
    });
    setFilterOpen(false);
  };

  const handleClearDraft = () => {
    // Xóa tất cả: reset draft + reset filter áp dụng -> trả về full list & title bình thường
    setDraftFilters({ primary: [], secondary: [], equipment: "", level: "" });
    setFilters({ primary: "", secondary: "", equipment: "", level: "" });
  };

  return (
    <div className="nm-wrap">
      {/* ===== HEAD (search + tạo lịch + nút lọc dropdown) ===== */}
      <div className="ex-head">
        <div className="search">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            placeholder="Tìm kiếm bài tập"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <Link to="/tap-luyen/lich-cua-ban" className="ex-wl">
          Đến trang lịch tập
        </Link>

        {/* Nút LỌC gom filter thành dropdown */}
        <div className="ex-filter-wrap" ref={filterBtnRef}>
          <button
            type="button"
            className={
              "ex-filter-btn" +
              (filterOpen ? " open" : "") +
              (hasAppliedFilters ? " has-active" : "")
            }
            onClick={() => {
              if (!filterOpen) {
                syncDraftFromApplied();
                setFilterOpen(true);
              } else {
                setFilterOpen(false);
              }
            }}
          >
            <i className="fa-solid fa-sliders"></i>
            <span>Bộ lọc</span>
            {hasAppliedFilters && (
              <span className="ex-filter-badge">{appliedFiltersCount}</span>
            )}
          </button>

          {filterOpen && (
            <div
              className="ex-filter-dd"
              ref={filterPanelRef}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ex-filter-cols">
                {/* Nhóm cơ chính (multi-select) */}
                <div className="exf-col">
                  <div className="exf-col-title">NHÓM CƠ CHÍNH</div>
                  <div className="exf-list">
                    {meta.MUSCLE_GROUPS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={
                          "exf-item" +
                          (draftFilters.primary.includes(m) ? " active" : "")
                        }
                        onClick={() => togglePrimaryMuscle(m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="exf-divider" />

                {/* Nhóm cơ phụ (multi-select) */}
                <div className="exf-col">
                  <div className="exf-col-title">NHÓM CƠ PHỤ</div>
                  <div className="exf-list">
                    {meta.MUSCLE_GROUPS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={
                          "exf-item" +
                          (draftFilters.secondary.includes(m) ? " active" : "")
                        }
                        onClick={() => toggleSecondaryMuscle(m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="exf-divider" />

                {/* Dụng cụ (single-select) */}
                <div className="exf-col">
                  <div className="exf-col-title">DỤNG CỤ</div>
                  <div className="exf-list">
                    {meta.EQUIPMENTS.map((eq) => (
                      <button
                        key={eq}
                        type="button"
                        className={
                          "exf-item" +
                          (draftFilters.equipment === eq ? " active" : "")
                        }
                        onClick={() =>
                          setDraftFilters((f) => ({
                            ...f,
                            equipment: f.equipment === eq ? "" : eq,
                          }))
                        }
                      >
                        {eq}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="exf-divider" />

                {/* Mức độ (single-select) */}
                <div className="exf-col">
                  <div className="exf-col-title">MỨC ĐỘ</div>
                  <div className="exf-list">
                    {meta.LEVELS.map((lv) => (
                      <button
                        key={lv}
                        type="button"
                        className={
                          "exf-item" +
                          (draftFilters.level === lv ? " active" : "")
                        }
                        onClick={() =>
                          setDraftFilters((f) => ({
                            ...f,
                            level: f.level === lv ? "" : lv,
                          }))
                        }
                      >
                        {lv}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer nút hành động */}
              <div className="ex-filter-actions">
                <button
                  type="button"
                  className="exf-clear"
                  disabled={!hasAnySelection}
                  onClick={handleClearDraft}
                >
                  Xóa tất cả dữ liệu lọc
                </button>

                <div className="exf-actions-right">
                  <button
                    type="button"
                    className="exf-btn ghost"
                    onClick={() => setFilterOpen(false)}
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    className="exf-btn primary"
                    disabled={!hasAnySelection}
                    onClick={handleApplyFilters}
                  >
                    Lọc dữ liệu
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <hr className="ex-line" />
      <div className="ex-list-title">Danh sách các bài tập</div>
      <div className="ex-list-desc">
        Tìm kiếm, xem thông tin chi tiết bài tập bạn muốn và xây dựng kế hoạch luyện tập cho bản thân
      </div>

      {/* ===== LIST-FRAME (giữ nguyên) ===== */}
      <div className="exl-list-frame">
        <div className="ex-grid ex-grid-4">
          {items.map((it) => (
            <div
              key={it._id}
              className="ex-card"
              onClick={() => nav(`/tap-luyen/bai-tap/chi-tiet/${it._id}`)}
            >
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

        {!loading && items.length === 0 && (
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
