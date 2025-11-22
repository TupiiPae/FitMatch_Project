// src/pages/Nutrition/SuggestMenuList.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./SuggestMenuList.css";
import "../Training/Exercises.css"; // reuse màu / layout giống SuggestPlanList
import { listSuggestMenus, toggleSaveSuggestMenu } from "../../api/suggestMenus";
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

const CAL_FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "2000-2200", label: "2000-2200 Cal", from: 2000, to: 2200 },
  { id: "2200-2400", label: "2200-2400 Cal", from: 2200, to: 2400 },
  { id: "2400-2600", label: "2400-2600 Cal", from: 2400, to: 2600 },
  { id: "2600-2800", label: "2600-2800 Cal", from: 2600, to: 2800 },
];

function normalizeName(s = "") {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getTotals(menu) {
  const totalKcal = menu.totalKcal ?? menu.totalCalories ?? menu.kcal ?? 0;
  const proteinG = menu.totalProteinG ?? menu.proteinG ?? 0;
  const carbG = menu.totalCarbG ?? menu.carbG ?? 0;
  const fatG = menu.totalFatG ?? menu.fatG ?? 0;

  return {
    totalKcal: Math.round(Number(totalKcal) || 0),
    proteinG: Math.round(Number(proteinG) || 0),
    carbG: Math.round(Number(carbG) || 0),
    fatG: Math.round(Number(fatG) || 0),
  };
}

export default function SuggestMenuList() {
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [calFilter, setCalFilter] = useState("all");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const [confirmUnsave, setConfirmUnsave] = useState(null);

  const sliderRef = useRef(null);

  // ---- Drag scroll cho hàng card (kéo chuột trái/phải) ----
  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;

    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;

    const onMouseDown = (e) => {
      isDown = true;
      el.classList.add("dragging");
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
    };

    const onMouseLeave = () => {
      isDown = false;
      el.classList.remove("dragging");
    };

    const onMouseUp = () => {
      isDown = false;
      el.classList.remove("dragging");
    };

    const onMouseMove = (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.offsetLeft;
      const walk = x - startX;
      el.scrollLeft = scrollLeft - walk;
    };

    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("mouseleave", onMouseLeave);
    el.addEventListener("mouseup", onMouseUp);
    el.addEventListener("mousemove", onMouseMove);

    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("mouseleave", onMouseLeave);
      el.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  // ---- Load danh sách thực đơn gợi ý ----
  async function load() {
    setLoading(true);
    try {
      const res = await listSuggestMenus({ limit: 100, skip: 0 });
      const arr = res.items || res || [];
      setItems(arr);
    } catch (err) {
      console.error(err);
      toast.error("Không tải được danh sách thực đơn gợi ý");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // ---- Filter theo search + khoảng Calorie ----
  const filteredItems = useMemo(() => {
    const qNorm = normalizeName(q);
    const qDigits = q.replace(/\D/g, "");

    const range = CAL_FILTERS.find((x) => x.id === calFilter);

    return (items || []).filter((m) => {
      const { totalKcal } = getTotals(m);

      // Filter theo calorie chip
      if (range && range.id !== "all") {
        if (typeof range.from === "number" && totalKcal < range.from) {
          return false;
        }
        if (typeof range.to === "number" && totalKcal > range.to) {
          return false;
        }
      }

      if (!qNorm && !qDigits) return true;

      const nameNorm = normalizeName(m.name || "");
      const nameMatch = nameNorm.includes(qNorm);

      const kcalStr = String(totalKcal || "");
      const kcalMatch = qDigits ? kcalStr.includes(qDigits) : false;

      return nameMatch || kcalMatch;
    });
  }, [items, q, calFilter]);

  // Danh sách menu đã lưu
  const savedItems = useMemo(
    () => (items || []).filter((m) => m.saved),
    [items]
  );

  const handleToggleSave = async (id, options = {}) => {
    const { silent = false } = options;
    try {
      const res = await toggleSaveSuggestMenu(id);
      const saved = !!res.saved;

      setItems((prev) =>
        (prev || []).map((m) => (m._id === id ? { ...m, saved } : m))
      );

      if (!silent) {
        toast.success(saved ? "Đã lưu thực đơn" : "Đã bỏ lưu thực đơn");
      }
      return saved;
    } catch (err) {
      console.error(err);
      toast.error("Không thể lưu/bỏ lưu thực đơn");
      return null;
    }
  };

  const openDetail = (id) => {
    nav(`/dinh-duong/thuc-don-goi-y/chi-tiet/${id}`);
  };

  const handleClickUnsaveFromSavedList = (menu, e) => {
    e.stopPropagation();
    setConfirmUnsave(menu);
  };

  const handleConfirmUnsave = async () => {
    if (!confirmUnsave) return;
    const id = confirmUnsave._id;
    const saved = await handleToggleSave(id);
    if (saved === false) {
      setConfirmUnsave(null);
    }
  };

  return (
    <div className="nm-wrap">
      {/* ===== HEAD ===== */}
      <div className="ex-head">
        <div className="ex-head-text">
          <div className="ex-list-title">Danh sách Thực đơn gợi ý</div>
          <div className="ex-list-desc">
            Đây là danh sách mang tính chất gợi ý, không bắt buộc sử dụng
            hoàn toàn thực đơn.
          </div>
        </div>

        {/* Toolbar: Search */}
        <div className="ex-toolbar smu-toolbar">
          <div className="search smu-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              placeholder="Tìm kiếm theo tên thực đơn hoặc tổng Calorie..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {/* Filter by Calories */}
        <div className="smu-filter-label">Lọc theo tổng Calorie</div>
        <div className="smu-chip-row">
          {CAL_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={"smu-chip" + (calFilter === f.id ? " active" : "")}
              onClick={() => setCalFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== LIST CARD HORIZONTAL (giống grid RecordMeal) ===== */}
      <div className="smu-frame">
        {loading && (
          <div className="smu-empty">Đang tải Thực đơn gợi ý...</div>
        )}

        {!loading && filteredItems.length === 0 && (
          <div className="smu-empty">
            Không tìm thấy thực đơn phù hợp. Hãy thử từ khóa hoặc khoảng
            Calorie khác.
          </div>
        )}

        {!loading && filteredItems.length > 0 && (
          <div className="smu-card-row" ref={sliderRef}>
            {filteredItems.map((m) => {
              const totals = getTotals(m);
              const cate = m.category || "Chưa phân loại";
              const numDays = m.numDays || m.days?.length || 0;

              return (
                <div
                  key={m._id}
                  className="smu-card"
                  onClick={() => openDetail(m._id)}
                >
                  {/* Ảnh to trên cùng (giống nm-card-thumb) */}
                  <div className="smu-card-img">
                    {m.imageUrl ? (
                      <img src={toAbs(m.imageUrl)} alt={m.name} />
                    ) : (
                      <div className="smu-thumb-fallback">
                        <i className="fa-regular fa-image" />
                      </div>
                    )}
                  </div>

                  {/* Nội dung */}
                  <div className="smu-card-body">
                    <div className="smu-card-title">
                      {m.name || "(Không tên)"}
                    </div>

                    <div className="smu-card-tags">
                      <span className="ex-chip">{cate}</span>
                      <span className="ex-chip">
                        {numDays || 1} ngày
                      </span>
                    </div>

                    <div className="smu-card-kcal">
                     Calorie: {totals.totalKcal.toLocaleString()} Cal
                    </div>

                    <div className="smu-card-macros">
                      <span>Đạm: {totals.proteinG} g | </span>
                      <span>Đường bột: {totals.carbG} g | </span>
                      <span>Chất béo: {totals.fatG} g</span>
                    </div>
                  </div>

                  {/* Footer: nút chi tiết + icon lưu (bookmark) */}
                  <div
                    className="smu-card-footer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="smu-btn-detail"
                      onClick={() => openDetail(m._id)}
                    >
                      Xem chi tiết
                    </button>

                    <button
                      type="button"
                      className={
                        "smu-save-icon" + (m.saved ? " saved" : "")
                      }
                      aria-pressed={m.saved ? "true" : "false"}
                      title={
                        m.saved
                          ? "Bỏ lưu thực đơn"
                          : "Lưu thực đơn"
                      }
                      onClick={() => handleToggleSave(m._id)}
                    >
                      <i
                        className={
                          m.saved
                            ? "fa-solid fa-bookmark"
                            : "fa-regular fa-bookmark"
                        }
                      />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== SAVED MENUS (giống list RecordMeal) ===== */}
      <div className="smu-saved-section">
        <div className="smu-saved-title">Thực đơn gợi ý đã lưu</div>
        <div className="smu-saved-desc">
          Những thực đơn bạn lưu lại sẽ hiển thị tại đây. Nhấp vào một thực
          đơn để xem chi tiết hoặc bỏ lưu nếu không còn phù hợp.
        </div>

        {savedItems.length === 0 && (
          <div className="smu-empty smu-empty-saved">
            Bạn chưa lưu thực đơn nào.
          </div>
        )}

        {savedItems.length > 0 && (
          <div className="smu-saved-list">
            {savedItems.map((m) => {
              const totals = getTotals(m);
              const cate = m.category || "Chưa phân loại";
              const numDays = m.numDays || m.days?.length || 0;

              return (
                <div
                  key={m._id}
                  className="smu-saved-item"
                  onClick={() => openDetail(m._id)}
                >
                  <div className="smu-saved-img">
                    {m.imageUrl ? (
                      <img src={toAbs(m.imageUrl)} alt={m.name} />
                    ) : (
                      <div className="smu-saved-thumb-fallback">
                        <i className="fa-regular fa-image" />
                      </div>
                    )}
                  </div>

                  <div className="smu-saved-main">
                    <div className="smu-saved-name">
                      {m.name || "(Không tên)"}
                    </div>
                    <div className="smu-saved-tags">
                      <span className="ex-chip">{cate}</span>
                      <span className="ex-chip">
                        {numDays || 1} ngày
                      </span>
                    </div>
                    <div className="smu-saved-kcal">
                      {totals.totalKcal.toLocaleString()} Cal
                    </div>
                    <div className="smu-saved-macros">
                      <span className="protein">
                        <i className="fa-solid fa-drumstick-bite" />{" "}
                        {totals.proteinG} g
                      </span>
                      <span className="carb">
                        <i className="fa-solid fa-bread-slice" />{" "}
                        {totals.carbG} g
                      </span>
                      <span className="fat">
                        <i className="fa-solid fa-bacon" />{" "}
                        {totals.fatG} g
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="smu-saved-unsave"
                    title="Bỏ lưu thực đơn"
                    onClick={(e) =>
                      handleClickUnsaveFromSavedList(m, e)
                    }
                  >
                    <i className="fa-solid fa-bookmark" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== MODAL XÁC NHẬN BỎ LƯU ===== */}
      {confirmUnsave && (
        <div
          className="smu-modal-backdrop"
          onClick={() => setConfirmUnsave(null)}
        >
          <div
            className="smu-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="smu-modal-title">Bỏ lưu thực đơn?</div>
            <div className="smu-modal-body">
              Bạn chắc chắn muốn bỏ lưu thực đơn{" "}
              <strong>{confirmUnsave.name}</strong>?
            </div>
            <div className="smu-modal-actions">
              <button
                type="button"
                className="smu-modal-btn ghost"
                onClick={() => setConfirmUnsave(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="smu-modal-btn danger"
                onClick={handleConfirmUnsave}
              >
                Bỏ lưu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
