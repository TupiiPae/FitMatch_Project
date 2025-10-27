// admin-app/src/pagesFoods/List/List.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, listFoods, deleteFood } from "../../../lib/api.js"; // Bỏ approveFood vì trang này là "đã duyệt"
import "./List.css";

// Chuẩn hoá URL ảnh giống user-app
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try { return new URL(u, API_ORIGIN).toString(); }
  catch { return u; }
};

export default function FoodsList() {
  const nav = useNavigate();

  // ===== Filters & state
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // (MỚI) Pagination state
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);

  // selection
  const [selectedIds, setSelectedIds] = useState([]);
  const allChecked = items.length > 0 && selectedIds.length === items.length;
  const someChecked = selectedIds.length > 0 && selectedIds.length < items.length;

  // confirm modal
  const [confirmId, setConfirmId] = useState(null);

  // ===== (CẬP NHẬT) Load data (Server-side Pagination & Filter) =====
  const load = async () => {
    setLoading(true);
    setSelectedIds([]); // Reset selection
    try {
      // Gửi TẤT CẢ params lên server
      const params = {
        status: "approved",
        limit,
        skip,
        q,
      };
      if (dateFrom) params.approvedFrom = dateFrom;
      if (dateTo) params.approvedTo = dateTo;

      const res = await listFoods(params);

      // Cập nhật state từ response
      setItems(res?.items || []);
      setTotal(res?.total || 0);

    } catch (err) {
      console.error(err);
      setItems([]); // Reset khi lỗi
      setTotal(0);  // Reset khi lỗi
    } finally {
      setLoading(false);
    }
  };

  // (CẬP NHẬT) useEffects cho phân trang
  // 1. Tải lại khi thay đổi trang (limit/skip)
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [limit, skip]);
  
  // 2. Tải lại (và reset về trang 1) khi filter thay đổi
  useEffect(() => {
    const t = setTimeout(() => {
      if (skip !== 0) {
        setSkip(0); // Sẽ trigger effect (1) để load
      } else {
        load(); // Đang ở trang 1, tự load
      }
    }, 250); // Debounce
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q, dateFrom, dateTo]);

  // ===== Actions
  const onDeleteOne = async (id) => {
    await deleteFood(id);
    // Tải lại để cập nhật total
    if (items.length === 1 && skip > 0) {
      setSkip(skip - limit); // Nếu xóa item cuối của trang, lùi về trang trước
    } else {
      await load();
    }
  };

  const onBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!confirm(`Xóa ${selectedIds.length} món đã chọn?`)) return;
    for (const id of selectedIds) { try { await deleteFood(id); } catch {} }
    // Tải lại
    if (selectedIds.length === items.length && skip > 0) {
      setSkip(skip - limit); // Lùi trang nếu xóa hết
    } else {
      await load();
    }
  };

  const toggleAll = () => {
    if (allChecked) setSelectedIds([]);
    else setSelectedIds(items.map((x) => x._id));
  };
  const toggleOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // ===== CSV (Xuất danh sách) =====
  // CSV này giờ chỉ xuất các items trên trang hiện tại
  const csv = useMemo(() => {
    // ... (logic CSV giữ nguyên) ...
    const head = [
      "name","massG","unit","kcal","proteinG","carbG","fatG","creator","approvedAt","status"
    ].join(",");
    const rows = items.map((x) => {
      const creator = x.createdByAdmin ? "admin" : (x.createdBy ? "user" : "");
      return [
        x.name, x.massG, x.unit, x.kcal ?? "", x.proteinG ?? "", x.carbG ?? "", x.fatG ?? "",
        creator, x.approvedAt || "", x.status
      ].join(",");
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
  
  // (MỚI) Pagination Logic
  const page = Math.floor(skip / limit);
  const pageCount = Math.ceil(total / limit);
  const handleLimitChange = (e) => {
    setLimit(Number(e.target.value));
    setSkip(0); // Reset về trang 1
  };
  const handlePageChange = (newSkip) => {
    if (newSkip >= 0 && newSkip < total) {
      setSkip(newSkip);
    }
  };

  // ===== UI helpers
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
        {/* ... (giữ nguyên) ... */}
        <Link to="/">
          <i className="fa-solid fa-house"></i>
          <span>Trang chủ</span>
        </Link>
        <span className="separator">/</span>
        <span className="current-group">
          <i className="fa-solid fa-utensils"></i> 
          <span>Quản lý Món ăn</span>
        </span>
        <span className="separator">/</span>
        <span className="current-page">Danh sách (đã duyệt)</span>
      </nav>

      {/* ===== Card: Chứa tất cả nội dung bên dưới ===== */}
      <div className="card">
        
        {/* ===== Title row + actions ===== */}
        <div className="page-head">
          {/* ... (giữ nguyên) ... */}
          <h2>Danh sách món ăn ({total})</h2>
          <div className="head-actions">
            <button className="btn ghost" type="button" onClick={() => alert("TODO: Nhập danh sách")}>
              <i className="fa-solid fa-file-import" /> <span>Nhập danh sách</span>
            </button>
            <button className="btn ghost" type="button" onClick={downloadCSV}>
              <i className="fa-solid fa-file-export" /> <span>Xuất danh sách</span>
            </button>
            <button className="btn danger" type="button" onClick={onBulkDelete} disabled={!selectedIds.length}>
              <i className="fa-regular fa-trash-can" /> <span>Xóa</span>
            </button>
            <Link to="/foods/create" className="btn primary">
              <span>Tạo món ăn</span>
            </Link>
          </div>
        </div>

        {/* ===== Card-head: search + filters ===== */}
        <div className="card-head">
          {/* ... (giữ nguyên) ... */}
          <div className="search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm kiếm theo tên món ăn..."
            />
          </div>
          <div className="filters">
            <div className="date-range" title="Lọc theo thời gian tạo thành công (approvedAt)">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <span className="sep">–</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="hint"></div>
          </div>
        </div>

        {/* ===== Table ===== */}
        <div className="table">
          <div className="thead">
            {/* ... (giữ nguyên) ... */}
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
            <div className="cell mass">Khối lượng (g)</div>
            <div className="cell kcal">Calorie (kcal)</div>
            <div className="cell macros">Đạm / Đường bột / Chất béo</div>
            <div className="cell creator">Người tạo</div>
            <div className="cell approved">Thời gian tạo thành công</div>
            <div className="cell act">Thao tác</div>
          </div>

          {loading && <div className="empty">Đang tải...</div>}
          {!loading && items.length === 0 && <div className="empty">Không có món đã duyệt.</div>}

          {!loading && items.map((it) => (
            <div key={it._id} className="trow">
              {/* ... (giữ nguyên) ... */}
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
                  : <div className="img-fallback"><i className="fa-regular fa-image"></i></div>}
              </div>

              <div className="cell name">
                <div className="title">{it.name || "—"}</div>
                <div className="sub">#{String(it._id).slice(-6)}</div>
              </div>

              <div className="cell mass">{it.massG ?? "—"}</div>
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
                  <i className="fa-regular fa-pen-to-square"></i>
                </button>
                <button className="iconbtn danger" title="Xóa" onClick={() => setConfirmId(it._id)}>
                  <i className="fa-regular fa-trash-can"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {/* ===== (MỚI) Pagination Controls ===== */}
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
              Trang {page + 1} / {pageCount > 0 ? pageCount : 1} (Tổng: {total})
            </span>
            <button
              className="btn-page"
              onClick={() => handlePageChange(skip - limit)}
              disabled={skip === 0}
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button
              className="btn-page"
              onClick={() => handlePageChange(skip + limit)}
              disabled={skip + limit >= total}
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>

      </div>

      {/* ===== Confirm Delete Modal (đẹp) ===== */}
      {confirmId && (
        <div
          className="cm-backdrop"
          role="presentation"
          onClick={() => setConfirmId(null)}
          // ... (các props khác giữ nguyên) ...
        >
          <div
            className="cm-modal"
            role="dialog"
            // ... (các props khác giữ nguyên) ...
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cm-head">
              <h1 id="cm-title" className="cm-title">Xóa món ăn?</h1>
            </div>

            <div id="cm-desc" className="cm-body">
              Hành động này sẽ xóa món ăn khỏi danh sách và cơ sở dữ liệu. Thao tác không thể hoàn tác.
            </div>

            <div className="cm-foot">
              <button className="btn ghost" onClick={() => setConfirmId(null)}>Hủy</button>
              <button
                className="btn danger"
                onClick={async () => { await onDeleteOne(confirmId); setConfirmId(null); }}
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