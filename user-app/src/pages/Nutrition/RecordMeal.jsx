import { useEffect, useState, useRef, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  searchFoods,
  toggleFavoriteFood,
  addLog,
  getFood,
  viewFood,
  deleteFood,
} from "../../api/foods";
import api from "../../lib/api";
import "./RecordMeal.css";
import { toast } from "react-toastify";

// ==== NEW: modal components dùng chung ====
import DetailModal from "./components/DetailModal/DetailModal";
import AddModal from "./components/AddModal/AddModal";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

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

  // VIEW MODE: list / grid
  const [viewMode, setViewMode] = useState("list");

  // popups thêm nhật ký
  const [showAdd, setShowAdd] = useState(false);
  const [addFood, setAddFood] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [massG, setMassG] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hour, setHour] = useState(12);

  // popup xem chi tiết
  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState(null);

  // overlays
  const [menuId, setMenuId] = useState(null);
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
        skip: reset ? 0 : skip,
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
        massG: massG === "" ? null : Number(massG),
      });
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

  // click outside: đóng menu 3 chấm
  useEffect(() => {
    const onDocClick = (e) => {
      if (!headRef.current) return;
      if (!headRef.current.contains(e.target)) {
        setMenuId(null);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const onEditFood = (id) => nav(`/dinh-duong/ghi-lai/sua-mon/${id}`);

  const [confirmDel, setConfirmDel] = useState({
    open: false,
    id: null,
    name: "",
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
          (data?.rejectionReason || "").trim() || "Admin chưa cung cấp lý do.",
      });
      setShowReject(true);
    } catch {
      setRejectInfo({
        name: it.name || "",
        reason: "Không lấy được lý do từ chối.",
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

  const canShowMore = filteredItems.length > visibleCount || hasMore;

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

  const handleTabAll = () => {
    setOnlyMine(false);
    setFavorites(false);
  };
  const handleTabMine = () => {
    setOnlyMine(true);
    setFavorites(false);
  };
  const handleTabFav = () => {
    setOnlyMine(false);
    setFavorites(true);
  };

  return (
    <div className="nm-wrap">
      {/* ===== HEADER: Title + desc + search + tabs + view toggle ===== */}
      <div
        className="nm-head"
        ref={headRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="nm-head-btn">
          <button
            className="scan"
            onClick={() => nav("/dinh-duong/ghi-lai/tinh-calo-ai")}
          >
            <i className="fa-brands fa-openai"></i>&nbsp;
            <span>Tính toán Calo với AI</span>
          </button>

          <button
            className="rm-create-btn"
            onClick={() => nav("/dinh-duong/ghi-lai/tao-mon")}
          >
            <span>Tạo món ăn</span>
          </button>
        </div>

        <hr className="rm-line" />

        <div className="nm-head-top">
          <div className="nm-head-text">
            <div className="nm-list-title">Danh sách món ăn</div>
            <div className="nm-list-desc">
              Khám phá và quản lý các bữa ăn yêu thích của bạn
            </div>
          </div>
        </div>

        {/* Toolbar chứa Search - Filter - View */}
        <div className="nm-toolbar">
          {/* 1. Thanh tìm kiếm */}
          <div className="rm-search">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              placeholder="Tìm kiếm món ăn theo tên..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* 2. Box chứa 3 Tab lọc */}
          <div className="rm-tabs">
            <button
              type="button"
              className={`rm-tab ${!onlyMine && !favorites ? "on" : ""}`}
              onClick={handleTabAll}
            >
              Tất cả
            </button>
            <button
              type="button"
              className={`rm-tab ${onlyMine && !favorites ? "on" : ""}`}
              onClick={handleTabMine}
            >
              Món của tôi
            </button>
            <button
              type="button"
              className={`rm-tab ${favorites ? "on" : ""}`}
              onClick={handleTabFav}
            >
              Yêu thích
            </button>
          </div>

          {/* 3. Box chứa 2 Tab view */}
          <div className="rm-view-toggle">
            <button
              type="button"
              className={`view-btn ${viewMode === "grid" ? "on" : ""}`}
              onClick={() => setViewMode("grid")}
              title="Hiển thị dạng lưới"
            >
              <i className="fa-solid fa-table-cells-large"></i>
            </button>
            <button
              type="button"
              className={`view-btn ${viewMode === "list" ? "on" : ""}`}
              onClick={() => setViewMode("list")}
              title="Hiển thị dạng danh sách"
            >
              <i className="fa-solid fa-list"></i>
            </button>
          </div>
        </div>
      </div>

      {/* ===== LIST / GRID ===== */}
      <div
        className="nm-list-frame"
        ref={listFrameRef}
        onMouseDown={handleListMouseDown}
        onMouseMove={handleListMouseMove}
        onMouseUp={handleListMouseUpOrLeave}
        onMouseLeave={handleListMouseUpOrLeave}
      >
        <div
          className={`nm-list ${
            viewMode === "grid" ? "is-grid" : "is-list"
          }`}
        >
          {visibleItems.map((it) =>
            viewMode === "list"
              ? (
              <div
                key={it._id}
                className="nm-item"
                onClick={() => openDetail(it)}
              >
                <img
                  src={toAbs(it.imageUrl) || "/images/food-placeholder.jpg"}
                  alt={it.name}
                />
                <div className="info">
                  <div className="title">{it.name}</div>
                  <div className="sub">
                    {it.portionName || "Khẩu phần tiêu chuẩn"} ·{" "}
                    {it.massG ?? "-"} {it.unit || "g"} · {kcalStr(it.kcal)} cal
                  </div>
                  <div className="macro">
                    <span className="protein">
                      <i className="fa-solid fa-bolt"></i>{" "}
                      {gStr(it.proteinG)} g
                    </span>
                    <span className="carb">
                      <i className="fa-solid fa-wheat-awn"></i>{" "}
                      {gStr(it.carbG)} g
                    </span>
                    <span className="fat">
                      <i className="fa-solid fa-droplet"></i>{" "}
                      {gStr(it.fatG)} g
                    </span>
                  </div>
                </div>

                <div className="act" onClick={(e) => e.stopPropagation()}>
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
                    className={`heart ${it.isFavorite ? "on" : ""}`}
                    aria-pressed={!!it.isFavorite}
                    title={
                      it.isFavorite ? "Bỏ yêu thích" : "Thêm vào yêu thích"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      onFav(it._id);
                    }}
                  >
                    <i
                      className={`${
                        it.isFavorite ? "fa-solid" : "fa-regular"
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
                        <i className="fa-solid fa-ellipsis-vertical"onClick={(e) => {
                          e.stopPropagation();
                          setMenuId(menuId === it._id ? null : it._id);
                        }}></i>
                      {menuId === it._id && (
                        <div
                          className="menu"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="menu-item danger"
                            onClick={() => openConfirmDelete(it)}
                          >
                            Xóa
                          </button>
                          <button
                            className="menu-item"
                            onClick={() => onEditFood(it._id)}
                          >
                            Chỉnh sửa
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
                )
              : (
              // ===== GRID CARD =====
              <div
                key={it._id}
                className="nm-card"
                onClick={() => openDetail(it)}
              >
                <div className="nm-card-thumb">
                  <img
                    src={toAbs(it.imageUrl) || "/images/food-placeholder.jpg"}
                    alt={it.name}
                  />
                  <div
                    className="nm-card-cta"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className={`heart ${it.isFavorite ? "on" : ""}`}
                      aria-pressed={!!it.isFavorite}
                      title={
                        it.isFavorite
                          ? "Bỏ yêu thích"
                          : "Thêm vào yêu thích"
                      }
                      onClick={() => onFav(it._id)}
                    >
                      <i
                        className={`${
                          it.isFavorite ? "fa-solid" : "fa-regular"
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
                  </div>
                </div>
                <div className="nm-card-body">
                  <div className="nm-card-title-row">
                    <div className="title">{it.name}</div>
                  </div>

                  <div className="nm-card-macroline">
                    {kcalStr(it.kcal)} kcal | {gStr(it.proteinG)}g Protein |{" "}
                    {gStr(it.carbG)}g Carb | {gStr(it.fatG)}g Fat
                  </div>

                  {onlyMine && (
                    <div
                      className="nm-card-menu-row"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Status pill bên trái, cùng hàng với 3 chấm */}
                      {it.status === "rejected" ? (
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
                      )}

                      {/* More icon bên phải */}
                      <div className="more-wrap">
                          <i className="fa-solid fa-ellipsis-vertical" 
                          onClick={(e) => { e.stopPropagation(); setMenuId( menuId === it._id ? null : it._id ); }}></i> 
                          
                          {menuId === it._id && (
                          <div
                            className="menu"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="menu-item danger"
                              onClick={() => openConfirmDelete(it)}
                            >
                              Xóa
                            </button>
                            <button
                              className="menu-item"
                              onClick={() => onEditFood(it._id)}
                            >
                              Chỉnh sửa
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
                )
          )}
        </div>

        {canShowMore && (
          <div className="more">
            <button disabled={loading} onClick={handleShowMore}>
              {loading ? "Đang tải..." : "Xem thêm"}
            </button>
          </div>
        )}
      </div>

      {/* ====== ADD MODAL (dùng chung) ====== */}
      <AddModal
        open={showAdd}
        food={addFood}
        date={date}
        hour={hour}
        quantity={quantity}
        massG={massG}
        onChangeDate={setDate}
        onChangeHour={setHour}
        onChangeQuantity={setQuantity}
        onClose={() => setShowAdd(false)}
        onConfirm={confirmAdd}
      />

      {/* ====== DETAIL MODAL (dùng chung) ====== */}
      <DetailModal
        open={showDetail}
        food={detail}
        onClose={() => setShowDetail(false)}
        onAddToLog={(food) => {
          setShowDetail(false);
          openAdd(food);
        }}
      />

      {/* ====== REJECT REASON MODAL ====== */}
      {showReject && (
        <div className="ur-backdrop" onClick={() => setShowReject(false)}>
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
                <span className="ur-label">Món ăn:</span>
                <b className="ur-val">{rejectInfo.name}</b>
              </div>
              <div className="ur-row">
                <span className="ur-label">Lý do:</span>
              </div>
              <div className="ur-reason">{rejectInfo.reason}</div>
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
        <div className="modal" onClick={closeConfirmDelete}>
          <div
            className="modal-card confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-del-title"
          >
            <div className="cm-head">
              <div className="cm-icon">
                <i
                  className="fa-solid fa-triangle-exclamation"
                  aria-hidden="true"
                ></i>
              </div>
              <h3 id="confirm-del-title">Xóa món ăn?</h3>
            </div>
            <div className="cm-body">
              Bạn chắc chắn muốn xóa <b>{confirmDel.name}</b>?<br />
              Thao tác này không thể hoàn tác.
            </div>
            <div className="cm-foot">
              <button className="btn ghost" onClick={closeConfirmDelete}>
                Hủy
              </button>
              <button className="btn bad" onClick={confirmDeleteNow}>
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
