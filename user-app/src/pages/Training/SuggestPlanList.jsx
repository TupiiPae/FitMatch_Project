import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SuggestPlanList.css";
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

  // list state
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // hiển thị tối đa 20, có nút "Xem tất cả"
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

  // lần đầu
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // debounce khi thay đổi search/filter
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseParams]);

  // sắp xếp: tên A-Z, rồi mức độ (Cơ bản -> Trung bình -> Nâng cao)
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

  // chỉ hiển thị tối đa 20 nếu chưa bấm "Xem tất cả"
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
    <div className="spl-wrap">
      {/* ===== HEAD: search + 3 nút lọc (giống ExercisesList) ===== */}
      <div className="spl-head">
        <div className="spl-search">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            placeholder="Tìm lịch tập gợi ý"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* Phân loại */}
        <div className="spl-select">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            title="Phân loại"
          >
            <option value="">Phân loại</option>
            {CATEGORY_OPTIONS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <i className="fa-solid fa-caret-down" aria-hidden="true" />
        </div>

        {/* Mức độ */}
        <div className="spl-select">
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            title="Mức độ"
          >
            <option value="">Mức độ</option>
            {LEVEL_OPTIONS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <i className="fa-solid fa-caret-down" aria-hidden="true" />
        </div>

        {/* Mục tiêu */}
        <div className="spl-select">
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            title="Mục tiêu"
          >
            <option value="">Mục tiêu</option>
            {GOAL_OPTIONS.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
          <i className="fa-solid fa-caret-down" aria-hidden="true" />
        </div>
      </div>

      {/* ===== LIST ===== */}
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
                    {/* Chỉ hiển thị tên, KHÔNG thêm "Cơ bản - / Trung bình - / Nâng cao -" nữa */}
                    {p.name || "(Không tên)"}
                  </div>
                  <div className="spl-plan-note">
                    Lịch tập {sessionsCount} buổi
                  </div>
                  <div className="spl-plan-meta">
                    {cate} - {lv} - {go}
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

        {/* Nút "Xem tất cả" khi có hơn 20 lịch */}
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
