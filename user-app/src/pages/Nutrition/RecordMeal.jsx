// src/pages/Nutrition/RecordMeal.jsx
import { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  searchFoods, toggleFavoriteFood, addLog, getFood, viewFood, deleteFood
} from "../../api/foods";
import api from "../../lib/api";
import "./RecordMeal.css";
import { toast } from "react-toastify";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try { return new URL(u, API_ORIGIN).toString(); }
  catch { return u; }
};

const HOUR_OPTIONS = Array.from({ length: 18 }, (_, i) => 6 + i); // 6..23
const statusLabel = (s) => (s === "approved" ? "Thành công" : s === "rejected" ? "Từ chối" : "Đang duyệt");

// --- Helper tìm kiếm không phân biệt hoa/thường & dấu ---
const vnNorm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export default function RecordMeal() {
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [favorites, setFavorites] = useState(false);
  const [items, setItems] = useState([]);
  const [skip, setSkip] = useState(0);
  const [limit] = useState(30);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  // popups
  const [showAdd, setShowAdd] = useState(false);
  const [addFood, setAddFood] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [massG, setMassG] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hour, setHour] = useState(12);

  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState(null);

  // overlays
  const [menuId, setMenuId] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const headRef = useRef(null);

  async function load(reset = false) {
    setLoading(true);
    try {
      const params = {
        q: q || undefined,
        scope: (!q && !onlyMine && !favorites) ? "recent" : "all",
        onlyMine: onlyMine || undefined,
        favorites: favorites || undefined,
        limit,
        skip: reset ? 0 : skip
      };
      const { data } = await searchFoods(params);
      const list = data?.items || [];
      setHasMore(!!data?.hasMore);
      setItems(reset ? list : [...items, ...list]);
      setSkip(reset ? list.length : skip + list.length);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(true); /* eslint-disable-next-line */ }, []);
  useEffect(() => { const t = setTimeout(() => load(true), 250); return () => clearTimeout(t); }, [q, onlyMine, favorites]);

  // Danh sách đã lọc theo tên, bỏ dấu
  const filteredItems = useMemo(() => {
    const key = vnNorm(q);
    if (!key) return items;
    return items.filter(it => vnNorm(it.name).includes(key));
  }, [items, q]);

  const kcalStr = (x) => (x ?? "-");
  const gStr = (x) => (x ?? "-");

  async function onFav(id) {
    const { data } = await toggleFavoriteFood(id);
    setItems((prev) => prev.map(it => it._id === id ? { ...it, isFavorite: data.isFavorite } : it));
  }

  async function openAdd(it) {
    setAddFood(it);
    setQuantity(1);
    setMassG(it.massG ?? "");
    setHour(12);
    setDate(new Date().toISOString().slice(0, 10));
    setShowAdd(true);
  }

  async function confirmAdd() {
    try {
      await addLog({ foodId: addFood._id, date, hour, quantity, massG: massG === "" ? null : Number(massG) });
      setShowAdd(false);
      toast.success("Thêm vào nhật ký thành công");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Thêm vào nhật ký thất bại");
    }
  }

  async function openDetail(it) {
    const { data } = await getFood(it._id);
    setDetail(data);
    setShowDetail(true);
    viewFood(it._id).catch(() => {});
  }

  // click outside: đóng dropdown & menu
  useEffect(() => {
    const onDocClick = (e) => {
      if (!headRef.current || !headRef.current.contains(e.target)) setFilterOpen(false);
      setMenuId(null);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const onDeleteFood = async (id) => {
    if (!window.confirm("Xóa món này?")) return;
    try {
      await deleteFood(id);
      toast.success("Đã xóa món");
      setMenuId(null);
      load(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Xóa thất bại");
    }
  };
  const onEditFood = (id) => nav(`/dinh-duong/ghi-lai/sua-mon/${id}`);

  return (
    <div className="nm-wrap">
      {/* ===== HEAD ===== */}
      <div className="nm-head" ref={headRef} onClick={(e) => e.stopPropagation()}>
        <div className="search">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            placeholder="Tìm kiếm thực phẩm hoặc món ăn"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </div>

        <button className="scan" onClick={() => nav("/dinh-duong/ghi-lai/tinh-calo-ai")}>
          <i className="fa-regular fa-images"></i>
        </button>

        {/* Filter dropdown giữ mở đến khi click ra ngoài */}
        <div className={`filter ${filterOpen ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="filter-btn"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen(v => !v)}
          >
            Lọc <i className="fa-solid fa-caret-down"></i>
          </button>

          {filterOpen && (
            <div className="filter-dd">
              <label>
                <input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} /> Tạo bởi tôi
              </label>
              <label>
                <input type="checkbox" checked={favorites} onChange={e => setFavorites(e.target.checked)} /> Yêu thích
              </label>
            </div>
          )}
        </div>

        <Link to="/dinh-duong/ghi-lai/tao-mon" className="create-btn">Tạo món ăn mới</Link>
      </div>

      {/* ===== LIST ===== */}
      <div className="nm-list-frame">
        <div className="nm-list">
          {filteredItems.map(it => (
            <div key={it._id} className="nm-item" onClick={() => openDetail(it)}>
              {/* DÙNG toAbs() CHO ẢNH */}
              <img src={toAbs(it.imageUrl) || "/images/food-placeholder.jpg"} alt={it.name} />
              <div className="info">
                <div className="title">{it.name}</div>
                <div className="sub">
                  {it.portionName || "Khẩu phần tiêu chuẩn"} · {it.massG ?? "-"} {it.unit || "g"} · {kcalStr(it.kcal)} cal
                </div>
                <div className="macro">
                  <span className="protein"><i className="fa-solid fa-drumstick-bite"></i> {gStr(it.proteinG)} g</span>
                  <span className="carb"><i className="fa-solid fa-bread-slice"></i> {gStr(it.carbG)} g</span>
                  <span className="fat"><i className="fa-solid fa-bacon"></i> {gStr(it.fatG)} g</span>
                </div>
              </div>

              <div className="act" onClick={(e) => e.stopPropagation()}>
                {onlyMine && (
                  <span className={`status-pill ${it.status || "pending"}`}>{statusLabel(it.status)}</span>
                )}

                <button className={`heart ${it.isFavorite ? "on" : ""}`} onClick={() => onFav(it._id)}>
                  <i className="fa-solid fa-heart"></i>
                </button>

                <button className="add" onClick={() => openAdd(it)}>Thêm</button>

                {onlyMine && (
                  <div className="more-wrap">
                    <button
                      className="more-btn"
                      onClick={(e) => { e.stopPropagation(); setMenuId(menuId === it._id ? null : it._id); }}
                    >
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                    {menuId === it._id && (
                      <div className="menu" onClick={(e) => e.stopPropagation()}>
                        <button className="menu-item danger" onClick={() => onDeleteFood(it._id)}>Xóa</button>
                        <button className="menu-item" onClick={() => onEditFood(it._id)}>Chỉnh sửa</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {hasMore && (
          <div className="more">
            <button disabled={loading} onClick={() => load(false)}>
              {loading ? "Đang tải..." : "Xem thêm"}
            </button>
          </div>
        )}

        {/* ====== ADD MODAL ====== */}
        {showAdd && (
          <div className="modal" onClick={() => setShowAdd(false)}>
            <div className="modal-card add-modal" onClick={e => e.stopPropagation()}>
              <div className="am-head">
                <div className="am-thumb-wrap">
                  <img className="am-thumb" src={toAbs(addFood?.imageUrl) || "/images/food-placeholder.jpg"} alt={addFood?.name || "food"} />
                </div>
                <div className="am-hmeta">
                  <h3 className="am-title">Thêm vào nhật ký</h3>
                  <div className="am-sub">{addFood?.name}</div>
                </div>
              </div>

              <div className="am-when">
                <div className="am-when-item">
                  <i className="fa-regular fa-calendar"></i>
                  <div className="am-field">
                    <label>Ngày</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} />
                  </div>
                </div>
                <div className="am-when-item">
                  <i className="fa-regular fa-clock"></i>
                  <div className="am-field">
                    <label>Thời gian</label>
                    <select value={hour} onChange={e => setHour(+e.target.value)}>
                      {HOUR_OPTIONS.map(h => <option key={h} value={h}>{`${h}:00`}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="am-qtygrid">
                <div className="am-qty">
                  <label>Số lượng khẩu phần</label>
                  <div className="am-qty-ctl">
                    <button type="button" onClick={() => setQuantity(q => Math.max(1, Math.round((q || 1) - 1)))}>–</button>
                    <input type="number" min="1" step="1" value={quantity} onChange={e => setQuantity(Math.max(1, Math.round(+e.target.value || 1)))} />
                    <button type="button" onClick={() => setQuantity(q => Math.max(1, Math.round((q || 1) + 1)))}>+</button>
                  </div>
                </div>
                <div className="am-portion">
                  <label>Khẩu phần (g)</label>
                  <input type="text" value={addFood?.massG != null ? `${addFood.massG} g` : "-"} readOnly className="readonly" />
                  <div className="am-note">* Khối lượng mặc định theo món, không thể chỉnh</div>
                </div>
              </div>

              {(() => {
                const q = Number(quantity || 1);
                const f = addFood || {};
                const fmt = (v) => (v == null ? "-" : Math.round(v * q * 10) / 10);
                return (
                  <div className="am-macros">
                    <div className="am-macro calo"><div className="m-label">Calo</div><div className="m-val">{fmt(f.kcal)} <span>cal</span></div></div>
                    <div className="am-macro protein"><div className="m-label">Đạm</div><div className="m-val">{fmt(f.proteinG)} <span>g</span></div></div>
                    <div className="am-macro carb"><div className="m-label">Đường bột</div><div className="m-val">{fmt(f.carbG)} <span>g</span></div></div>
                    <div className="am-macro fat"><div className="m-label">Béo</div><div className="m-val">{fmt(f.fatG)} <span>g</span></div></div>
                  </div>
                );
              })()}

              <div className="am-actions">
                <button className="btn ghost" onClick={() => setShowAdd(false)}>Hủy</button>
                <button className="btn primary" onClick={confirmAdd}>Thêm</button>
              </div>
            </div>
          </div>
        )}

        {/* ====== DETAIL MODAL ====== */}
        {showDetail && !!detail && (
          <div className="modal" onClick={() => setShowDetail(false)}>
            <div className="modal-card food-modal" onClick={e => e.stopPropagation()}>
              <div className="fm-head">
                <img className="fm-thumb" src={toAbs(detail.imageUrl) || "/images/food-placeholder.jpg"} alt={detail.name} />
                <div className="fm-titlebox">
                  <h3 className="fm-title">{detail.name}</h3>
                  <div className="fm-sub">
                    {(detail.portionName || "Khẩu phần tiêu chuẩn")} · {(detail.massG ?? "-")} {detail.unit || "g"} · {(detail.kcal ?? "-")} cal
                  </div>
                  <div className="fm-chips">
                    <span className="chip chip-red"><i className="fa-solid fa-drumstick-bite"></i> Đạm {(detail.proteinG ?? "-")}g</span>
                    <span className="chip chip-purple"><i className="fa-solid fa-bread-slice"></i> Carb {(detail.carbG ?? "-")}g</span>
                    <span className="chip chip-green"><i className="fa-solid fa-bacon"></i> Béo {(detail.fatG ?? "-")}g</span>
                  </div>
                </div>
              </div>
              <div className="fm-grid">
                <div className="fm-kv">
                  <div><span>Khối lượng</span><b>{detail.massG ?? "-"} {detail.unit || "g"}</b></div>
                  <div><span>Calo</span><b>{detail.kcal ?? "-"} cal</b></div>
                  <div><span>Đạm</span><b>{detail.proteinG ?? "-"} g</b></div>
                  <div><span>Đường bột</span><b>{detail.carbG ?? "-"} g</b></div>
                </div>
                <div className="fm-kv">
                  <div><span>Chất béo</span><b>{detail.fatG ?? "-"} g</b></div>
                  <div><span>Muối (NaCl)</span><b>{detail.saltG ?? "-"} g</b></div>
                  <div><span>Đường</span><b>{detail.sugarG ?? "-"} g</b></div>
                  <div><span>Chất xơ</span><b>{detail.fiberG ?? "-"} g</b></div>
                </div>
              </div>
              <div className="fm-note">
                <span className="badge">{detail.sourceType || "khác"}</span>
                <span className="muted small">• Thực phẩm tươi: khối lượng linh hoạt · Đóng gói: nên nhập đủ macro/đường/muối · Nấu chín: macro theo khẩu phần, massG là sau nấu.</span>
              </div>
              <div className="fm-actions">
                <button className="btn ghost" onClick={() => setShowDetail(false)}>Đóng</button>
                <button className="btn primary" onClick={() => { setShowDetail(false); openAdd(detail); }}>Thêm vào nhật ký</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
