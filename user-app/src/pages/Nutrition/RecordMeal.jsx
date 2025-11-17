import { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  searchFoods,
  toggleFavoriteFood,
  addLog,
  getFood,
  viewFood,
  deleteFood
} from "../../api/foods";
import api from "../../lib/api";
import "./RecordMeal.css";
import { toast } from "react-toastify";

// === THÊM MỚI: Imports cho MUI Date Picker ===
import dayjs from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { useColorScheme } from "@mui/material/styles";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

const HOUR_OPTIONS = Array.from({ length: 18 }, (_, i) => 6 + i); // 6..23
const statusLabel = (s) =>
  s === "approved" ? "Thành công" : s === "rejected" ? "Từ chối" : "Đang duyệt";

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
  const [limit] = useState(30); // limit truy vấn server (giữ nguyên)
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  // Số lượng item hiển thị trên UI
  const [visibleCount, setVisibleCount] = useState(30);

  // popups
  const [showAdd, setShowAdd] = useState(false);
  const [addFood, setAddFood] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [massG, setMassG] = useState("");
  const [date, setDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [hour, setHour] = useState(12);

  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState(null);

  // overlays
  const [menuId, setMenuId] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const headRef = useRef(null);

  // Drag-to-scroll cho nm-list-frame
  const listFrameRef = useRef(null);
  const isMouseDownRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartScrollTopRef = useRef(0);

  async function load(reset = false) {
    setLoading(true);
    try {
      const params = {
        q: q || undefined,
        scope: !q && !onlyMine && !favorites ? "recent" : "all",
        onlyMine: onlyMine || undefined,
        favorites: favorites || undefined,
        limit,
        skip: reset ? 0 : skip
      };
      const { data } = await searchFoods(params);
      const list = data?.items || [];
      setHasMore(!!data?.hasMore);
      if (reset) {
        setItems(list);
        setSkip(list.length);
        setVisibleCount(30); // reset số lượng hiển thị
      } else {
        setItems((prev) => [...prev, ...list]);
        setSkip((prevSkip) => prevSkip + list.length);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(true), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q, onlyMine, favorites]);

  // Danh sách đã lọc theo tên, bỏ dấu
  const filteredItems = useMemo(() => {
    const key = vnNorm(q);
    if (!key) return items;
    return items.filter((it) => vnNorm(it.name).includes(key));
  }, [items, q]);

  // Danh sách thực tế hiển thị (giới hạn visibleCount)
  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount]
  );

  const kcalStr = (x) => x ?? "-";
  const gStr = (x) => x ?? "-";

  async function onFav(id) {
    const { data } = await toggleFavoriteFood(id); // { isFavorite: boolean }
    setItems((prev) => {
      const next = prev.map((it) =>
        it._id === id ? { ...it, isFavorite: data.isFavorite } : it
      );
      if (favorites && !data.isFavorite)
        return next.filter((it) => it._id !== id);
      return next;
    });
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
      await addLog({
        foodId: addFood._id,
        date,
        hour,
        quantity,
        massG: massG === "" ? null : Number(massG)
      });
      setShowAdd(false);
      toast.success("Thêm vào nhật ký thành công");
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Thêm vào nhật ký thất bại"
      );
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
      if (!headRef.current || !headRef.current.contains(e.target))
        setFilterOpen(false);
      setMenuId(null);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const onDeleteFood = async (id) => {};
  const onEditFood = (id) =>
    nav(`/dinh-duong/ghi-lai/sua-mon/${id}`);

  const [confirmDel, setConfirmDel] = useState({
    open: false,
    id: null,
    name: ""
  });
  const openConfirmDelete = (it) =>
    setConfirmDel({ open: true, id: it._id, name: it.name });
  const closeConfirmDelete = () =>
    setConfirmDel({ open: false, id: null, name: "" });
  const confirmDeleteNow = async () => {
    if (!confirmDel.id) return;
    try {
      await deleteFood(confirmDel.id);
      toast.success("Đã xóa món");
      setMenuId(null);
      closeConfirmDelete();
      load(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Xóa thất bại");
    }
  };

  const [showReject, setShowReject] = useState(false);
  const [rejectInfo, setRejectInfo] = useState({ name: "", reason: "" });

  async function openRejectReason(it) {
    try {
      const { data } = await getFood(it._id);
      setRejectInfo({
        name: data?.name || it.name || "",
        reason:
          (data?.rejectionReason || "").trim() ||
          "Admin chưa cung cấp lý do.",
      });
      setShowReject(true);
    } catch {
      setRejectInfo({
        name: it.name || "",
        reason: "Không lấy được lý do từ chối."
      });
      setShowReject(true);
    }
  }

  // Xử lý "Xem thêm": mỗi lần +5 món, khi thiếu dữ liệu thì mới gọi API load thêm
  const handleShowMore = async () => {
    if (loading) return;
    const STEP = 5;
    if (visibleCount < filteredItems.length) {
      setVisibleCount((c) => c + STEP);
      return;
    }
    if (hasMore) {
      await load(false);
      setVisibleCount((c) => c + STEP);
    }
  };

  const canShowMore =
    filteredItems.length > visibleCount || hasMore;

  // Drag-to-scroll handlers cho nm-list-frame
  const handleListMouseDown = (e) => {
    if (e.button !== 0) return;
    const el = listFrameRef.current;
    if (!el) return;
    isMouseDownRef.current = true;
    dragStartYRef.current = e.clientY;
    dragStartScrollTopRef.current = el.scrollTop;
  };

  const handleListMouseMove = (e) => {
    const el = listFrameRef.current;
    if (!el || !isMouseDownRef.current) return;
    const deltaY = e.clientY - dragStartYRef.current;
    // Bắt đầu kéo khi di chuyển đủ xa
    if (Math.abs(deltaY) < 2) return;
    el.scrollTop = dragStartScrollTopRef.current - deltaY;
    el.classList.add("dragging");
    if (window.getSelection) window.getSelection().removeAllRanges();
  };

  const handleListMouseUpOrLeave = () => {
    isMouseDownRef.current = false;
    const el = listFrameRef.current;
    if (el) el.classList.remove("dragging");
  };

  return (
    <div className="nm-wrap">
      <div
        className="nm-head"
        ref={headRef}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ===== PHẦN 1: BÊN TRÁI ===== */}
        <div className="search">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            placeholder="Tìm kiếm thực phẩm hoặc món ăn"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* ===== PHẦN 2: Ở GIỮA ===== */}
        <div className="nm-head-center">
          <button
            className="scan"
            onClick={() =>
              nav("/dinh-duong/ghi-lai/tinh-calo-ai")
            }
          >
            <i className="fa-brands fa-openai"></i>&nbsp;
            <span>Tính toán Calo với AI</span>
          </button>

          <button
            className="rm-create-btn"
            onClick={() =>
              nav("/dinh-duong/ghi-lai/tao-mon")
            }
          >
            <i className="fa-brands fa-openai"></i>&nbsp;
            <span>Tạo món ăn với AI</span>
          </button>

          <button
            className="rm-create-btn"
            onClick={() =>
              nav("/dinh-duong/ghi-lai/tao-mon")
            }
          >
            <span>Tạo món ăn</span>
          </button>
        </div>

        <div
          className={`filter ${filterOpen ? "open" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="rm-filter"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((v) => !v)}
          >
            <div className="rm-title">
              <i className="fa-solid fa-filter"></i>
              <span> Lọc</span>
            </div>
          </button>

          {filterOpen && (
            <div className="filter-dd">
              <label>
                <input
                  type="checkbox"
                  checked={onlyMine}
                  onChange={(e) =>
                    setOnlyMine(e.target.checked)
                  }
                />
                Tạo bởi tôi
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={favorites}
                  onChange={(e) =>
                    setFavorites(e.target.checked)
                  }
                />
                Yêu thích
              </label>
            </div>
          )}
        </div>
      </div>

      <hr className="rm-line" />

      {/* ===== LIST ===== */}
      <div className="nm-list-title">Danh sách thực phẩm</div>
      <div className="nm-list-desc">Tìm kiếm và chọn thực phẩm để ghi vào nhật ký dinh dưỡng của bạn</div>
      <div
        className="nm-list-frame"
        ref={listFrameRef}
        onMouseDown={handleListMouseDown}
        onMouseMove={handleListMouseMove}
        onMouseUp={handleListMouseUpOrLeave}
        onMouseLeave={handleListMouseUpOrLeave}
      >
        <div className="nm-list">
          {visibleItems.map((it) => (
            <div
              key={it._id}
              className="nm-item"
              onClick={() => openDetail(it)}
            >
              <img
                src={
                  toAbs(it.imageUrl) ||
                  "/images/food-placeholder.jpg"
                }
                alt={it.name}
              />
              <div className="info">
                <div className="title">{it.name}</div>
                <div className="sub">
                  {it.portionName || "Khẩu phần tiêu chuẩn"} ·{" "}
                  {it.massG ?? "-"} {it.unit || "g"} ·{" "}
                  {kcalStr(it.kcal)} cal
                </div>
                <div className="macro">
                  <span className="protein">
                    <i className="fa-solid fa-drumstick-bite"></i>{" "}
                    {gStr(it.proteinG)} g
                  </span>
                  <span className="carb">
                    <i className="fa-solid fa-bread-slice"></i>{" "}
                    {gStr(it.carbG)} g
                  </span>
                  <span className="fat">
                    <i className="fa-solid fa-bacon"></i>{" "}
                    {gStr(it.fatG)} g
                  </span>
                </div>
              </div>

              <div
                className="act"
                onClick={(e) => e.stopPropagation()}
              >
                {onlyMine &&
                  (it.status === "rejected" ? (
                    <button
                      type="button"
                      className={`status-pill ${it.status}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openRejectReason(it);
                      }}
                      title="Xem lý do từ chối"
                    >
                      {statusLabel(it.status)}
                    </button>
                  ) : (
                    <span
                      className={`status-pill ${
                        it.status || "pending"
                      }`}
                    >
                      {statusLabel(it.status)}
                    </span>
                  ))}

                <button
                  className={`heart ${
                    it.isFavorite ? "on" : ""
                  }`}
                  aria-pressed={!!it.isFavorite}
                  title={
                    it.isFavorite
                      ? "Bỏ yêu thích"
                      : "Thêm vào yêu thích"
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onFav(it._id);
                  }}
                >
                  <i
                    className={`${
                      it.isFavorite
                        ? "fa-solid"
                        : "fa-regular"
                    } fa-heart`}
                  ></i>
                </button>

                <button
                  className="add add-round"
                  title="Thêm vào nhật ký"
                  onClick={() => openAdd(it)}
                >
                  <i className="fa-solid fa-plus"></i>
                </button>

                {onlyMine && (
                  <div className="more-wrap">
                    <button
                      className="more-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuId(
                          menuId === it._id ? null : it._id
                        );
                      }}
                    >
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                    {menuId === it._id && (
                      <div
                        className="menu"
                        onClick={(e) =>
                          e.stopPropagation()
                        }
                      >
                        <button
                          className="menu-item danger"
                          onClick={() =>
                            openConfirmDelete(it)
                          }
                        >
                          Xóa
                        </button>
                        <button
                          className="menu-item"
                          onClick={() =>
                            onEditFood(it._id)
                          }
                        >
                          Chỉnh sửa
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {canShowMore && (
          <div className="more">
            <button
              disabled={loading}
              onClick={handleShowMore}
            >
              {loading ? "Đang tải..." : "Xem thêm"}
            </button>
          </div>
        )}

        {/* ====== ADD MODAL ====== */}
        {showAdd && (
          <div
            className="modal"
            onClick={() => setShowAdd(false)}
          >
            <div
              className="modal-card add-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="am-head">
                <div className="am-thumb-wrap">
                  <img
                    className="am-thumb"
                    src={
                      toAbs(addFood?.imageUrl) ||
                      "/images/food-placeholder.jpg"
                    }
                    alt={addFood?.name || "food"}
                  />
                </div>
                <div className="am-hmeta">
                  <h3 className="am-title">
                    Thêm vào nhật ký
                  </h3>
                  <div className="am-sub">
                    {addFood?.name}
                  </div>
                </div>
              </div>

              <div className="am-when">
                <div className="am-when-item">
                  <i className="fa-regular fa-calendar"></i>
                  <div className="am-field">
                    <label>Ngày</label>
                    <LocalizationProvider
                      dateAdapter={AdapterDayjs}
                    >
                      <DatePicker
                        format="DD/MM/YYYY"
                        value={date ? dayjs(date) : null}
                        onChange={(newValue) => {
                          const newDateString = newValue
                            ? newValue.format(
                                "YYYY-MM-DD"
                              )
                            : "";
                          setDate(newDateString);
                        }}
                        slotProps={{
                          textField: {
                            placeholder: "DD/MM/YYYY",
                            style: { width: 170 },
                            size: "small"
                          }
                        }}
                      />
                    </LocalizationProvider>
                  </div>
                </div>

                <div className="am-when-item">
                  <i className="fa-regular fa-clock"></i>
                  <div className="am-field">
                    <label>Thời gian</label>
                    <select
                      value={hour}
                      onChange={(e) =>
                        setHour(+e.target.value)
                      }
                    >
                      {HOUR_OPTIONS.map((h) => (
                        <option key={h} value={h}>
                          {`${h}:00`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="am-qtygrid">
                <div className="am-qty">
                  <label>Số lượng khẩu phần</label>
                  <div className="am-qty-ctl">
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((q) =>
                          Math.max(
                            1,
                            Math.round((q || 1) - 1)
                          )
                        )
                      }
                    >
                      –
                    </button>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={quantity}
                      onChange={(e) =>
                        setQuantity(
                          Math.max(
                            1,
                            Math.round(
                              +e.target.value || 1
                            )
                          )
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity((q) =>
                          Math.max(
                            1,
                            Math.round((q || 1) + 1)
                          )
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="am-portion">
                  <label>Khẩu phần (g)</label>
                  <input
                    type="text"
                    value={
                      addFood?.massG != null
                        ? `${addFood.massG} g`
                        : "-"
                    }
                    readOnly
                    className="readonly"
                  />
                  <div className="am-note">
                    * Khối lượng mặc định theo món, không
                    thể chỉnh
                  </div>
                </div>
              </div>

              {(() => {
                const qNum = Number(quantity || 1);
                const f = addFood || {};
                const fmt = (v) =>
                  v == null
                    ? "-"
                    : Math.round(v * qNum * 10) / 10;
                return (
                  <div className="am-macros">
                    <div className="am-macro calo">
                      <div className="m-label">
                        Calo
                      </div>
                      <div className="m-val">
                        {fmt(f.kcal)} <span>cal</span>
                      </div>
                    </div>
                    <div className="am-macro protein">
                      <div className="m-label">
                        Đạm
                      </div>
                      <div className="m-val">
                        {fmt(f.proteinG)} <span>g</span>
                      </div>
                    </div>
                    <div className="am-macro carb">
                      <div className="m-label">
                        Đường bột
                      </div>
                      <div className="m-val">
                        {fmt(f.carbG)} <span>g</span>
                      </div>
                    </div>
                    <div className="am-macro fat">
                      <div className="m-label">
                        Béo
                      </div>
                      <div className="m-val">
                        {fmt(f.fatG)} <span>g</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="am-actions">
                <button
                  className="btn ghost"
                  onClick={() => setShowAdd(false)}
                >
                  Hủy
                </button>
                <button
                  className="btn primary"
                  onClick={confirmAdd}
                >
                  Thêm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ====== DETAIL MODAL ====== */}
        {showDetail && !!detail && (
          <div
            className="modal"
            onClick={() => setShowDetail(false)}
          >
            <div
              className="modal-card food-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="fm-head">
                <img
                  className="fm-thumb"
                  src={
                    toAbs(detail.imageUrl) ||
                    "/images/food-placeholder.jpg"
                  }
                  alt={detail.name}
                />
                <div className="fm-titlebox">
                  <h3 className="fm-title">
                    {detail.name}
                  </h3>
                  <div className="fm-sub">
                    {(detail.portionName ||
                      "Khẩu phần tiêu chuẩn")}{" "}
                    · {detail.massG ?? "-"}{" "}
                    {detail.unit || "g"} ·{" "}
                    {detail.kcal ?? "-"} cal
                  </div>
                  <div className="fm-chips">
                    <span className="chip chip-red">
                      <i className="fa-solid fa-drumstick-bite"></i>{" "}
                      Đạm {detail.proteinG ?? "-"}g
                    </span>
                    <span className="chip chip-purple">
                      <i className="fa-solid fa-bread-slice"></i>{" "}
                      Carb {detail.carbG ?? "-"}g
                    </span>
                    <span className="chip chip-green">
                      <i className="fa-solid fa-bacon"></i>{" "}
                      Béo {detail.fatG ?? "-"}g
                    </span>
                  </div>
                </div>
              </div>

              <div className="fm-grid">
                <div className="fm-kv">
                  <div>
                    <span>Khối lượng</span>
                    <b>
                      {detail.massG ?? "-"}{" "}
                      {detail.unit || "g"}
                    </b>
                  </div>
                  <div>
                    <span>Calo</span>
                    <b>{detail.kcal ?? "-"} cal</b>
                  </div>
                  <div>
                    <span>Đạm</span>
                    <b>{detail.proteinG ?? "-"} g</b>
                  </div>
                  <div>
                    <span>Đường bột</span>
                    <b>{detail.carbG ?? "-"} g</b>
                  </div>
                </div>

                <div className="fm-kv">
                  <div>
                    <span>Chất béo</span>
                    <b>{detail.fatG ?? "-"} g</b>
                  </div>
                  <div>
                    <span>Muối (NaCl)</span>
                    <b>{detail.saltG ?? "-"} g</b>
                  </div>
                  <div>
                    <span>Đường</span>
                    <b>{detail.sugarG ?? "-"} g</b>
                  </div>
                  <div>
                    <span>Chất xơ</span>
                    <b>{detail.fiberG ?? "-"} g</b>
                  </div>
                </div>
              </div>

              <div className="fm-note">
                <span className="badge">
                  {detail.sourceType || "khác"}
                </span>
              </div>

              <div className="fm-actions">
                <button
                  className="btn ghost"
                  onClick={() => setShowDetail(false)}
                >
                  Đóng
                </button>
                <button
                  className="btn primary"
                  onClick={() => {
                    setShowDetail(false);
                    openAdd(detail);
                  }}
                >
                  Thêm vào nhật ký
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ====== REJECT REASON MODAL ====== */}
      {showReject && (
        <div
          className="ur-backdrop"
          onClick={() => setShowReject(false)}
        >
          <div
            className="ur-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ur-title"
          >
            <div className="ur-head">
              <div className="ur-icon" aria-hidden="true">
                <i className="fa-regular fa-circle-xmark"></i>
              </div>
              <h3 id="ur-title" className="ur-title">
                Lý do món ăn bị từ chối
              </h3>
            </div>
            <div className="ur-body">
              <div className="ur-row">
                <span className="ur-label">
                  Món ăn:
                </span>
                <b className="ur-val">
                  {rejectInfo.name}
                </b>
              </div>
              <div className="ur-row">
                <span className="ur-label">Lý do:</span>
              </div>
              <div className="ur-reason">
                {rejectInfo.reason}
              </div>
            </div>
            <div className="ur-foot">
              <button
                className="btn primary"
                onClick={() => setShowReject(false)}
              >
                Đã hiểu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== CONFIRM DELETE MODAL ====== */}
      {confirmDel.open && (
        <div
          className="modal"
          onClick={closeConfirmDelete}
        >
          <div
            className="modal-card confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-del-title"
          >
            <div className="cm-head">
              <div className="cm-icon">
                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
              </div>
              <h3 id="confirm-del-title">
                Xóa món ăn?
              </h3>
            </div>
            <div className="cm-body">
              Bạn chắc chắn muốn xóa{" "}
              <b>{confirmDel.name}</b>?<br />
              Thao tác này không thể hoàn tác.
            </div>
            <div className="cm-foot">
              <button
                className="btn ghost"
                onClick={closeConfirmDelete}
              >
                Hủy
              </button>
              <button
                className="btn bad"
                onClick={confirmDeleteNow}
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
