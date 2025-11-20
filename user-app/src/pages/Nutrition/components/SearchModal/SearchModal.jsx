// src/pages/Nutrition/components/SearchModal/SearchModal.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import { toast } from "react-toastify";

import api from "../../../../lib/api";
import { searchFoods, addLog } from "../../../../api/foods";
import "./SearchModal.css"

import DetailModal from "../DetailModal/DetailModal";
import AddModal from "../AddModal/AddModal";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

const PLACEHOLDER = "/images/food-placeholder.jpg";
const fmtDisplay = (iso) => (iso ? dayjs(iso).format("DD/MM/YYYY") : "");
const HOUR_OPTIONS_MODAL = Array.from({ length: 18 }, (_, i) => 6 + i); // 6..23

// Chuẩn hoá để lọc tiếng Việt
const vnNorm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

/**
 * Modal danh sách tìm kiếm & chọn món để thêm vào nhật ký
 */
export default function SearchModal({ date: initialISO, hour: initialHour, onClose, onFoodAdded }) {
  // === State của Tìm kiếm ===
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [skip, setSkip] = useState(0);
  const [limit] = useState(20);
  const [hasMore, setHasMore] = useState(false);
  const searchTimer = useRef(null);

  // === State của bước "Xác nhận thêm" ===
  const [showAdd, setShowAdd] = useState(false);
  const [addFood, setAddFood] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [dateISO, setDateISO] = useState(initialISO); // ISO
  const [hour, setHour] = useState(initialHour ?? HOUR_OPTIONS_MODAL[0]);

  // === State popup chi tiết (DetailModal) ===
  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState(null);

  // --- Logic Tìm kiếm ---
  async function load(reset = false) {
    setLoading(true);
    try {
      const params = {
        q: q || undefined,
        scope: "all",
        limit,
        skip: reset ? 0 : skip,
      };
      const { data } = await searchFoods(params);
      const list = data?.items || [];
      setHasMore(!!data?.hasMore);
      setItems((prev) => (reset ? list : [...prev, ...list]));
      setSkip(reset ? list.length : skip + list.length);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      load(true);
    }, 300);
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line
  }, [q]);

  const filteredItems = useMemo(() => {
    const key = vnNorm(q);
    if (!key) return items;
    return items.filter((it) => vnNorm(it.name).includes(key));
  }, [items, q]);

  // --- Popup chi tiết trong search ---
  const openDetail = (it) => {
    setDetail(it);
    setShowDetail(true);
  };
  const closeDetail = () => {
    setShowDetail(false);
    setDetail(null);
  };

  // Mở bước "Xác nhận thêm" (AddModal)
  function openAdd(it) {
    setAddFood(it);
    setQuantity(1);
    setShowAdd(true);
  }

  // Xử lý thay đổi ngày từ AddModal (nhận về ISO string)
  const handleChangeDate = (newISO) => {
    if (newISO) setDateISO(newISO);
  };

  // Xử lý xác nhận thêm
  async function confirmAdd() {
    if (!addFood) return;
    try {
      await addLog({
        foodId: addFood._id,
        date: dateISO,
        hour,
        quantity,
        massG: null,
      });
      setShowAdd(false);
      onFoodAdded();
      toast.success("Thêm vào nhật ký thành công");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Thêm vào nhật ký thất bại");
    }
  }

  return (
    <div className="dj-search-backdrop" onClick={onClose}>
      <div className="dj-search-modal" onClick={(e) => e.stopPropagation()}>
        {/* Bước 1: Tìm kiếm */}
        {!showAdd && (
          <>
            <h3 className="dj-search-title">
              Thêm món ăn {fmtDisplay(dateISO)} lúc {hour}:00
              <button className="dj-search-close" onClick={onClose}>
                &times;
              </button>
            </h3>

            <div className="dj-search-bar">
              <i className="fa-solid fa-magnifying-glass" />
              <input
                placeholder="Tìm kiếm thực phẩm hoặc món ăn"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
            </div>

            <div className="dj-search-list">
              {filteredItems.map((it) => (
                <div
                  key={it._id}
                  className="dj-search-item"
                  onClick={() => openDetail(it)}
                >
                  <img src={toAbs(it.imageUrl) || PLACEHOLDER} alt={it.name} />
                  <div className="dj-search-info">
                    <div className="dj-search-info-title">{it.name}</div>
                    <div className="dj-search-info-sub">
                      {it.portionName || "Khẩu phần"} · {it.massG ?? "-"}{" "}
                      {it.unit || "g"} · {it.kcal ?? "-"} cal
                    </div>
                    <div className="dj-search-macro">
                      <span className="dj-search-macro-protein">
                        <i className="fa-solid fa-drumstick-bite"></i>{" "}
                        {it.proteinG ?? "-"} g
                      </span>
                      <span className="dj-search-macro-carb">
                        <i className="fa-solid fa-bread-slice"></i>{" "}
                        {it.carbG ?? "-"} g
                      </span>
                      <span className="dj-search-macro-fat">
                        <i className="fa-solid fa-bacon"></i>{" "}
                        {it.fatG ?? "-"} g
                      </span>
                    </div>
                  </div>
                  <div
                    className="dj-search-act"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="dj-search-add"
                      title="Thêm vào nhật ký"
                      onClick={() => openAdd(it)}
                    >
                      <i className="fa-solid fa-plus"></i>
                    </button>
                  </div>
                </div>
              ))}
              {hasMore && (
                <div className="dj-search-more">
                  <button disabled={loading} onClick={() => load(false)}>
                    {loading ? "Đang tải..." : "Xem thêm"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Modal Chi tiết món trong Tìm kiếm (DetailModal dùng chung RecordMeal) */}
        {showDetail && detail && !showAdd && (
          <DetailModal
            open={showDetail}
            food={detail}
            onClose={closeDetail}
            onAddToLog={() => {
              setAddFood(detail);
              setQuantity(1);
              setShowAdd(true);
              setShowDetail(false);
            }}
          />
        )}

        {/* Bước 2: Xác nhận thêm (AddModal dùng chung RecordMeal) */}
        {showAdd && addFood && (
          <AddModal
            open={showAdd}
            food={addFood}
            date={dateISO}
            hour={hour}
            quantity={quantity}
            massG={addFood.massG}
            onChangeDate={handleChangeDate}
            onChangeHour={(newHour) => setHour(newHour)}
            onChangeQuantity={(newQty) => setQuantity(newQty)}
            hourOptions={HOUR_OPTIONS_MODAL}
            onClose={() => setShowAdd(false)}
            onConfirm={confirmAdd}
          />
        )}
      </div>
    </div>
  );
}
