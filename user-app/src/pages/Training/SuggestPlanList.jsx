import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./SuggestPlanList.css";
import "./Exercises.css"; 
import { listSuggestPlans, toggleSaveSuggestPlan } from "../../api/suggestPlans";
import { toast } from "react-toastify";
import api from "../../lib/api";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

// Danh sách filter
const CATEGORY_OPTIONS = [
  "Tại Gym",
  "Tại nhà",
  "Du lịch",
  "Chỉ tạ đơn",
  "Cardio và HIIT",
  "Bodyweight",
];
const LEVEL_OPTIONS = ["Cơ bản", "Trung bình", "Nâng cao"];
const GOAL_OPTIONS = ["Tăng cơ bắp", "Tăng sức mạnh", "Giảm cân nặng"];

function normalizeName(s = "") {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function SuggestPlanList() {
  const nav = useNavigate();

  // head state
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [level, setLevel] = useState("");
  const [goal, setGoal] = useState("");

  // ===== DROPDOWN FILTER =====
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({
    category: "",
    level: "",
    goal: "",
  });
  const filterBtnRef = useRef(null);
  const filterPanelRef = useRef(null);

  const syncDraftFromApplied = () => {
    setDraftFilters({
      category: category || "",
      level: level || "",
      goal: goal || "",
    });
  };

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

  const hasDraftFilters =
    !!draftFilters.category || !!draftFilters.level || !!draftFilters.goal;

  const appliedFiltersCount =
    (category ? 1 : 0) + (level ? 1 : 0) + (goal ? 1 : 0);

  const hasAppliedFilters = appliedFiltersCount > 0;
  const hasAnySelection = hasDraftFilters || hasAppliedFilters;

  const handleApplyFilters = () => {
    setCategory(draftFilters.category || "");
    setLevel(draftFilters.level || "");
    setGoal(draftFilters.goal || "");
    setFilterOpen(false);
  };

  const handleClearFilters = () => {
    setDraftFilters({ category: "", level: "", goal: "" });
    setCategory("");
    setLevel("");
    setGoal("");
  };

  // ===== LIST STATE =====
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const baseParams = useMemo(
    () => ({
      q: q.trim() || undefined,
      category: category || undefined,
      level: level || undefined,
      goal: goal || undefined,
      limit: 100,
      skip: 0,
    }),
    [q, category, level, goal]
  );

  async function load() {
    setLoading(true);
    try {
      const res = await listSuggestPlans(baseParams);
      setItems(res.items || []);
    } catch (err) {
      console.error(err);
      toast.error("Không tải được danh sách lịch tập gợi ý");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseParams]);

  const sortedItems = useMemo(() => {
    const levelOrder = { "Cơ bản": 1, "Trung bình": 2, "Nâng cao": 3 };
    const arr = [...items];
    arr.sort((a, b) => {
      const na = normalizeName(a.name || "");
      const nb = normalizeName(b.name || "");
      if (na === nb) {
        return (levelOrder[a.level] || 99) - (levelOrder[b.level] || 99);
      }
      return na.localeCompare(nb);
    });
    return arr;
  }, [items]);

  const visibleItems = useMemo(
    () => (showAll ? sortedItems : sortedItems.slice(0, 20)),
    [sortedItems, showAll]
  );

  const handleToggleSave = async (planId) => {
    try {
      const res = await toggleSaveSuggestPlan(planId);
      const saved = !!res.saved;
      setItems((prev) =>
        prev.map((p) => (p._id === planId ? { ...p, saved } : p))
      );
      toast.success(saved ? "Đã lưu lịch tập" : "Đã bỏ lưu lịch tập");
    } catch (err) {
      console.error(err);
      toast.error("Không thể lưu/bỏ lưu lịch tập");
    }
  };

  return (
    <div className="nm-wrap">
      {/* ===== HEAD ===== */}
      <div className="ex-head">
        {/* Nút Top Right: Đến trang lịch tập */}
        <div className="ex-head-top-btn">
            <Link to="/tap-luyen/lich-cua-ban" className="ex-wl-btn">
                <span>Đến trang lịch tập</span> &nbsp;<i className="fa-solid fa-arrow-right"></i>
            </Link>
        </div>

        <hr className="rm-line" />

        {/* Title & Description */}
        <div className="ex-head-text">
            <div className="ex-list-title">Danh sách lịch tập gợi ý</div>
            <div className="ex-list-desc">
                Lưu lại lịch tập gợi ý phù hợp với mục tiêu của bạn
            </div>
        </div>

        {/* Toolbar: Search + Filter (Giống ExercisesList) */}
        <div className="ex-toolbar">
            {/* Search */}
            <div className="search">
                <i className="fa-solid fa-magnifying-glass" />
                <input
                    placeholder="Tìm kiếm lịch tập gợi ý..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
            </div>

            {/* Filter Button */}
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

                {/* Dropdown Panel */}
                {filterOpen && (
                    <div
                    className="ex-filter-dd"
                    ref={filterPanelRef}
                    onClick={(e) => e.stopPropagation()}
                    >
                        <div className="spl-filter-cols">
                            {/* Phân loại */}
                            <div className="exf-col">
                                <div className="exf-col-title">PHÂN LOẠI</div>
                                <div className="exf-list">
                                    {CATEGORY_OPTIONS.map((x) => (
                                    <button
                                        key={x}
                                        type="button"
                                        className={
                                        "exf-item" +
                                        (draftFilters.category === x ? " active" : "")
                                        }
                                        onClick={() =>
                                        setDraftFilters((f) => ({
                                            ...f,
                                            category: f.category === x ? "" : x,
                                        }))
                                        }
                                    >
                                        {x}
                                    </button>
                                    ))}
                                </div>
                            </div>

                            <div className="exf-divider" />

                            {/* Mức độ */}
                            <div className="exf-col">
                                <div className="exf-col-title">MỨC ĐỘ</div>
                                <div className="exf-list">
                                    {LEVEL_OPTIONS.map((x) => (
                                    <button
                                        key={x}
                                        type="button"
                                        className={
                                        "exf-item" +
                                        (draftFilters.level === x ? " active" : "")
                                        }
                                        onClick={() =>
                                        setDraftFilters((f) => ({
                                            ...f,
                                            level: f.level === x ? "" : x,
                                        }))
                                        }
                                    >
                                        {x}
                                    </button>
                                    ))}
                                </div>
                            </div>

                            <div className="exf-divider" />

                            {/* Mục tiêu */}
                            <div className="exf-col">
                                <div className="exf-col-title">MỤC TIÊU</div>
                                <div className="exf-list">
                                    {GOAL_OPTIONS.map((x) => (
                                    <button
                                        key={x}
                                        type="button"
                                        className={
                                        "exf-item" +
                                        (draftFilters.goal === x ? " active" : "")
                                        }
                                        onClick={() =>
                                        setDraftFilters((f) => ({
                                            ...f,
                                            goal: f.goal === x ? "" : x,
                                        }))
                                        }
                                    >
                                        {x}
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
                            onClick={handleClearFilters}
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
      </div>

      {/* ===== LIST FRAME (Dark Mode) ===== */}
      <div className="spl-list-frame">
        {loading && (
          <div className="spl-empty">Đang tải lịch tập gợi ý...</div>
        )}
        {!loading && sortedItems.length === 0 && (
          <div className="spl-empty">
            Không tìm thấy lịch tập phù hợp. Hãy thử từ khóa hoặc bộ lọc khác.
          </div>
        )}

        {!loading &&
          visibleItems.map((p) => {
            const sessionsCount = p.sessionsCount ?? 0;
            const cate = p.category || "{Phân loại}";
            const lv = p.level || "{Mức độ}";
            const go = p.goal || "{Mục tiêu}";

            return (
              <div
                key={p._id}
                className="spl-item"
                onClick={() => nav(`/tap-luyen/goi-y/chi-tiet/${p._id}`)}
              >
                {/* Hình ảnh bên trái */}
                <div className="spl-img">
                  {p.imageUrl ? (
                    <img src={toAbs(p.imageUrl)} alt={p.name} />
                  ) : (
                    <div className="spl-thumb-fallback">
                      <i className="fa-regular fa-image" />
                    </div>
                  )}
                </div>

                {/* Thông tin chính */}
                <div className="spl-main">
                  <div className="spl-plan-title">
                    {p.name || "(Không tên)"}
                  </div>
                  <div className="spl-plan-note">
                    Lịch tập {sessionsCount} buổi
                  </div>
                  <div className="spl-plan-meta">
                    <span className="ex-chip">{cate}</span>
                    <span className="ex-chip">{lv}</span>
                    <span className="ex-chip">{go}</span>
                  </div>
                </div>

                {/* Nút lưu bên phải */}
                <div
                  className="spl-actions"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className={`spl-save-btn ${p.saved ? "saved" : ""}`}
                    onClick={() => handleToggleSave(p._id)}
                  >
                    {p.saved ? "Đã lưu" : "Lưu"}
                  </button>
                </div>
              </div>
            );
          })}

        {!loading && !showAll && sortedItems.length > 20 && (
          <div className="more">
            <button type="button" onClick={() => setShowAll(true)}>
              Xem tất cả
            </button>
          </div>
        )}
      </div>
    </div>
  );
}