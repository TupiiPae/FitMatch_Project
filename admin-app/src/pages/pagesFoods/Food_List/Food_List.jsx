// admin-app/src/pagesFoods/Food_List/Food_List.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, listFoodsAdminOnly, deleteFood } from "../../../lib/api.js";
import { toast } from "react-toastify";
import "./Food_List.css";

// Chuẩn hoá URL ảnh giống user-app
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try { return new URL(u, API_ORIGIN).toString(); }
  catch { return u; }
};

export default function FoodsList() {
  const nav = useNavigate();

  /* ============ Filters & state ============ */
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  /* ============ Data & pagination ============ */
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);

  /* ============ Selection ============ */
  const [selectedIds, setSelectedIds] = useState([]);
  const allChecked = items.length > 0 && selectedIds.length === items.length;
  const someChecked = selectedIds.length > 0 && selectedIds.length < items.length;

  /* ============ Confirm modal (single & bulk dùng chung) ============ */
  // { mode:'single'|'bulk', ids:string[] } | null
  const [confirm, setConfirm] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  /* ============ Load data ============ */
  const load = async () => {
    setLoading(true);
    setSelectedIds([]); // reset chọn khi đổi trang/lọc
    try {
      const params = {
        status: "approved",
        limit,
        skip,
        q,
      };
      if (dateFrom) params.approvedFrom = dateFrom;
      if (dateTo) params.approvedTo = dateTo;

      const res = await listFoodsAdminOnly(params);
      const arr = Array.isArray(res?.items) ? res.items : [];
      setItems(arr);
      setTotal(typeof res?.total === "number" ? res.total : arr.length);
    } catch (err) {
      console.error(err);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [limit, skip]);

  // Debounce khi filter text/date thay đổi → reset về trang 1
  useEffect(() => {
    const t = setTimeout(() => {
      if (skip !== 0) setSkip(0);
      else load();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, dateFrom, dateTo]);

  /* ============ Actions: delete single ============ */
  const onDeleteOne = async (id) => {
    try {
      setDeletingId(id);
      await deleteFood(id);

      // Nếu xóa item cuối của trang thì lùi trang, ngược lại cập nhật lạc quan
      if (items.length === 1 && skip > 0) {
        setSkip(Math.max(0, skip - limit));
      } else {
        setItems(prev => prev.filter(x => x._id !== id));
        setTotal(t => Math.max(0, Number(t || 0) - 1));
        setSelectedIds(sel => sel.filter(x => x !== id));
      }
      toast.success("Đã xóa món ăn");
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Xóa thất bại");
    } finally {
      setDeletingId(null);
    }
  };

  /* ============ Actions: delete bulk ============ */
  const onBulkDelete = async (ids) => {
    if (!ids?.length) return;
    try {
      setBulkDeleting(true);
      const results = await Promise.allSettled(ids.map(id => deleteFood(id)));
      const okCount = results.filter(r => r.status === "fulfilled").length;
      const failCount = results.length - okCount;

      const deletingAllOnPage = ids.length >= items.length;
      if (deletingAllOnPage && skip > 0) {
        setSkip(Math.max(0, skip - limit)); // lùi trang, load() sẽ tự gọi
      } else {
        // Cập nhật lạc quan
        setItems(prev => prev.filter(x => !ids.includes(x._id)));
        setTotal(t => Math.max(0, Number(t || 0) - okCount));
        setSelectedIds([]);
      }

      if (okCount > 0) toast.success(`Đã xóa ${okCount} món ăn`);
      if (failCount > 0) toast.error(`${failCount} món xóa thất bại`);
    } catch (e) {
      console.error(e);
      toast.error("Xóa thất bại");
    } finally {
      setBulkDeleting(false);
    }
  };

  /* ============ Selection helpers ============ */
  const toggleAll = () => {
    if (allChecked) setSelectedIds([]);
    else setSelectedIds(items.map((x) => x._id));
  };
  const toggleOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  /* ============ CSV (items trang hiện tại) ============ */
  const csv = useMemo(() => {
    const head = [
      "name","massG","unit","kcal","proteinG","carbG","fatG","creator","approvedAt","status"
    ].join(",");
    const rows = items.map((x) => {
      const creator = x.createdByAdmin ? "admin" : (x.createdBy ? "user" : "");
      return [
        x.name,
        x.massG,
        x.unit,
        x.kcal ?? "",
        x.proteinG ?? "",
        x.carbG ?? "",
        x.fatG ?? "",
        creator,
        x.approvedAt || "",
        x.status
      ].map(v => (v ?? "")).join(",");
    });
    return [head, ...rows].join("\n");
  }, [items]);

  const downloadCSV = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "foods.csv";
    a.click();
  };

  /* ============ Pagination helpers ============ */
  const page = Math.floor(skip / limit);
  const pageCount = Math.max(1, Math.ceil((total || 0) / limit));
  const handleLimitChange = (e) => {
    setLimit(Number(e.target.value));
    setSkip(0);
  };
  const handlePageChange = (newSkip) => {
    if (newSkip >= 0 && newSkip < Math.max(total, 1)) {
      setSkip(newSkip);
    }
  };

  /* ============ UI helpers ============ */
  const badgeRole = (it) => {
    if (it.createdByAdmin) return <span className="role-badge is-admin">Admin</span>;
    if (it.createdBy) return <span className="role-badge is-user">User</span>;
    return <span className="role-badge">N/A</span>;
  };
  const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "—");

  return (
    <div className="foods-page">
      {/* ===== Breadcrumb ===== */}
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/">
          <i className="fa-solid fa-house" aria-hidden="true"></i>
          <span>Trang chủ</span>
        </Link>
        <span className="separator">/</span>
        <span className="current-group">
          <i className="fa-solid fa-utensils" aria-hidden="true"></i>
          <span>Quản lý Món ăn</span>
        </span>
        <span className="separator">/</span>
        <span className="current-page">Danh sách món ăn</span>
      </nav>

      {/* ===== Card ===== */}
      <div className="card">
        {/* Title + actions */}
        <div className="page-head">
          <h2>Danh sách món ăn ({total})</h2>
          <div className="head-actions">
            <button
              className="btn ghost"
              type="button"
              onClick={() => nav("/foods/import-list")}
              title="Nhập danh sách món ăn từ CSV/XLSX/ZIP"
            >
              <i className="fa-solid fa-file-import" aria-hidden="true" /> <span>Nhập danh sách</span>
            </button>

            <button className="btn ghost" type="button" onClick={downloadCSV}>
              <i className="fa-solid fa-file-export" aria-hidden="true" /> <span>Xuất danh sách</span>
            </button>

            <button
              className="btn danger"
              type="button"
              disabled={!selectedIds.length || bulkDeleting}
              onClick={() => setConfirm({ mode: "bulk", ids: selectedIds.slice() })}
            >
              <i className="fa-regular fa-trash-can" aria-hidden="true" />{" "}
              <span>{bulkDeleting ? "Đang xóa..." : "Xóa"}</span>
            </button>

            <Link to="/foods/create" className="btn primary">
              <span>Tạo món ăn</span>
            </Link>
          </div>
        </div>

        {/* Search + filters */}
        <div className="card-head">
          <div className="search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm kiếm theo tên món ăn..."
            />
          </div>
          <div className="filters">
            <div className="date-range" title="Lọc theo thời gian được duyệt (approvedAt)">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <span className="sep">–</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="hint"></div>
          </div>
        </div>

        {/* Table */}
        <div className="table">
          <div className="thead">
            <label className="cell cb">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => { if (el) el.indeterminate = someChecked; }}
                onChange={toggleAll}
                aria-label="Chọn tất cả"
              />
            </label>
            <div className="cell img">Hình ảnh</div>
            <div className="cell name">Tên</div>
            <div className="cell mass">Khối lượng</div>
            <div className="cell kcal">Calorie (kcal)</div>
            <div className="cell macros">Đạm / Đường bột / Chất béo</div>
            <div className="cell creator">Người tạo</div>
            <div className="cell approved">Thời gian tạo thành công</div>
            <div className="cell act">Thao tác</div>
          </div>

          {loading && <div className="empty">Đang tải...</div>}
          {!loading && items.length === 0 && <div className="empty">Không có món trong danh sách.</div>}

          {!loading && items.map((it) => (
            <div key={it._id} className="trow">
              <label className="cell cb">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(it._id)}
                  onChange={() => toggleOne(it._id)}
                  aria-label={`Chọn ${it.name}`}
                />
              </label>

              <div className="cell img">
                {it.imageUrl
                  ? (
                    <img
                      src={toAbs(it.imageUrl)}
                      alt={it.name}
                      onError={(e) => { e.currentTarget.src = "/images/food-placeholder.jpg"; }}
                    />
                  )
                  : <div className="img-fallback"><i className="fa-regular fa-image" aria-hidden="true"></i></div>}
              </div>

              <div className="cell name">
                <div className="title">{it.name || "—"}</div>
                <div className="sub">#{String(it._id).slice(-6)}</div>
              </div>

              <div className="cell mass">
                {it.massG != null ? `${it.massG} ${it.unit || "g"}` : "—"}
              </div>
              <div className="cell kcal">{it.kcal ?? "—"}</div>

              <div className="cell macros">
                <span className="chip p">{it.proteinG ?? 0}g</span>
                <span className="chip c">{it.carbG ?? 0}g</span>
                <span className="chip f">{it.fatG ?? 0}g</span>
              </div>

              <div className="cell creator">{badgeRole(it)}</div>

              <div className="cell approved">{fmtDate(it.approvedAt)}</div>

              <div className="cell act">
                <button className="iconbtn" title="Chỉnh sửa" onClick={() => nav(`/foods/${it._id}/edit`)}>
                  <i className="fa-regular fa-pen-to-square" aria-hidden="true"></i>
                </button>
                <button
                  className="iconbtn danger"
                  title="Xóa"
                  onClick={() => setConfirm({ mode: "single", ids: [it._id] })}
                  disabled={deletingId === it._id}
                >
                  <i className="fa-solid fa-trash-can" aria-hidden="true"></i>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination Controls */}
        <div className="pagination-controls">
          <div className="per-page">
            <span>Hiển thị:</span>
            <select value={limit} onChange={handleLimitChange}>
              <option value="10">10 hàng</option>
              <option value="25">25 hàng</option>
              <option value="50">50 hàng</option>
            </select>
          </div>

          <div className="page-nav">
            <span className="page-info">
              Trang {page + 1} / {pageCount} (Tổng: {total})
            </span>
            <button
              className="btn-page"
              onClick={() => handlePageChange(skip - limit)}
              disabled={skip === 0}
            >
              <i className="fa-solid fa-chevron-left" aria-hidden="true"></i>
            </button>
            <button
              className="btn-page"
              onClick={() => handlePageChange(skip + limit)}
              disabled={skip + limit >= total}
            >
              <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>
        </div>
      </div>

      {/* ===== Confirm Delete Modal (.cm-*) dùng chung single & bulk ===== */}
      {confirm && (
        <div
          className="cm-backdrop"
          role="presentation"
          onClick={() => setConfirm(null)}
        >
          <div
            className="cm-modal"
            role="dialog"
            aria-labelledby="cm-title"
            aria-describedby="cm-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cm-head">
              <h1 id="cm-title" className="cm-title">
                {confirm.mode === "bulk"
                  ? `Xóa ${confirm.ids.length} món đã chọn?`
                  : "Xóa món ăn?"}
              </h1>
            </div>

            <div id="cm-desc" className="cm-body">
              Hành động này sẽ xóa khỏi danh sách và cơ sở dữ liệu. Thao tác không thể hoàn tác.
            </div>

            <div className="cm-foot">
              <button className="btn ghost" onClick={() => setConfirm(null)}>Hủy</button>
              {confirm.mode === "single" ? (
                <button
                  className="btn danger"
                  disabled={deletingId === confirm.ids[0]}
                  onClick={async () => {
                    const id = confirm.ids[0];
                    await onDeleteOne(id);
                    setConfirm(null);
                  }}
                >
                  {deletingId === confirm.ids[0] ? "Đang xóa..." : "Xóa"}
                </button>
              ) : (
                <button
                  className="btn danger"
                  disabled={bulkDeleting || !confirm.ids.length}
                  onClick={async () => {
                    await onBulkDelete(confirm.ids);
                    setConfirm(null);
                  }}
                >
                  {bulkDeleting ? "Đang xóa..." : `Xóa ${confirm.ids.length}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
