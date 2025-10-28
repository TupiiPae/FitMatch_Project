import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listAdminAccounts } from "../../../lib/api.js";
import "./Admin_List.css"; // Đảm bảo đã import

export default function AdminAccountsList(){
  // ... (Toàn bộ state và logic giữ nguyên) ...
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const allChecked = items.length > 0 && selectedIds.length === items.filter(x => x.level !== 1).length;
  const someChecked = selectedIds.length > 0 && selectedIds.length < items.filter(x => x.level !== 1).length;
  const load = async () => {
    setLoading(true);
    setSelectedIds([]);
    try {
      const res = await listAdminAccounts(q ? { q, limit, skip } : { limit, skip });
      const sorted = [...(res?.items || [])].sort((a, b) => {
        if (a.level === 1 && b.level !== 1) return -1;
        if (a.level !== 1 && b.level === 1) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      setItems(sorted);
      setTotal(res?.total || sorted.length || 0);
    } catch (e) {
      setItems([]); setTotal(0);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [limit, skip]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (skip !== 0) setSkip(0);
      else load();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q]);
  const toggleAll = () => {
    const selectable = items.filter(x => x.level !== 1).map(x => x._id);
    if (allChecked) setSelectedIds([]);
    else setSelectedIds(selectable);
  };
  const toggleOne = (id) => {
    const it = items.find(x => x._id === id);
    if (it?.level === 1) return;
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const page = Math.floor(skip / limit);
  const pageCount = Math.ceil(total / limit) || 1;
  const handleLimitChange = (e) => { setLimit(Number(e.target.value)); setSkip(0); };
  const handlePageChange = (newSkip) => {
    if (newSkip >= 0 && newSkip < total) setSkip(newSkip);
  };
  const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "—");
  const badgeStatus = (s) => (
    <span className={`status-badge ${s === "active" ? "is-active" : "is-blocked"}`}> {/* <-- Sửa class badge status */}
      {s === "active" ? "Hoạt động" : "Đã khóa"}
    </span>
  );


  return (
    // ===== THAY ĐỔI Ở ĐÂY =====
    <div className="foods-page admin-list-page">
    {/* ===== KẾT THÚC THAY ĐỔI ===== */}

      {/* Breadcrumb */}
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        {/* ... (Giữ nguyên) ... */}
        <Link to="/"><i className="fa-solid fa-house"></i><span>Trang chủ</span></Link>
        <span className="separator">/</span>
        <span className="current-group"><i className="fa-solid fa-user-gear"></i><span>Quản lý Admin</span></span>
        <span className="separator">/</span>
        <span className="current-page">Tài khoản quản trị</span>
      </nav>

      {/* (Phần còn lại của JSX giữ nguyên y hệt) */}
      <div className="card">
        <div className="page-head">
          <h2>Tài khoản quản trị ({total})</h2>
          <div className="head-actions">
            {/* (Thêm nút xóa) */}
            <button className="btn danger" type="button" disabled={!selectedIds.length}>
               <i className="fa-regular fa-trash-can" /> <span>Xóa đã chọn</span>
            </button>
            <Link to="/admins/create" className="btn primary">
              <span>Tạo tài khoản</span>
            </Link>
          </div>
        </div>
        <div className="card-head">
          <div className="search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            <input
              value={q}
              onChange={e=>setQ(e.target.value)}
              placeholder="Tìm theo username / nickname / trạng thái..."
            />
          </div>
          <div className="filters"><div className="hint"></div></div>
        </div>
        <div className="table">
          <div className="thead">
            <label className="cell cb">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => { if (el) el.indeterminate = someChecked; }}
                onChange={toggleAll}
                aria-label="Chọn tất cả (trừ cấp 1)"
              />
            </label>
            <div className="cell username">Username</div>
            <div className="cell nickname">Nickname</div>
            <div className="cell level">Cấp</div>
            <div className="cell status">Trạng thái</div>
            <div className="cell created">Ngày tạo</div>
            <div className="cell act">Thao tác</div>
          </div>

          {loading && <div className="empty">Đang tải...</div>}
          {!loading && items.length === 0 && <div className="empty">Chưa có tài khoản quản trị.</div>}

          {!loading && items.map(it => {
            const isLv1 = Number(it.level) === 1;
            return (
              <div key={it._id} className={`trow ${isLv1 ? "row-lv1" : ""}`} title={isLv1 ? "Admin cấp 1 (đặc quyền)" : ""}>
                <label className="cell cb">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(it._id)}
                    disabled={isLv1}
                    onChange={() => toggleOne(it._id)}
                    aria-label={`Chọn ${it.username}`}
                  />
                </label>
                <div className="cell username">
                  <div className="title">
                    {it.username}
                    {isLv1 && <span className="lv1-chip" aria-label="Cấp 1">LV1</span>}
                  </div>
                  <div className="sub">#{String(it._id).slice(-6)}</div>
                </div>
                <div className="cell nickname">{it.nickname || '—'}</div>
                <div className="cell level">{it.level}</div>
                <div className="cell status">{badgeStatus(it.status)}</div>
                <div className="cell created">{fmtDate(it.createdAt)}</div>
                <div className="cell act">
                  <button className="iconbtn" title={isLv1 ? "Không thể chỉnh sửa admin cấp 1" : "Xem chi tiết/Chỉnh sửa"} disabled={isLv1}>
                    <i className={`fa-solid ${isLv1 ? "fa-lock" : "fa-pen-to-square"}`}></i> {/* Sửa icon thành edit */}
                  </button>
                  <button className="iconbtn danger" title={isLv1 ? "Không thể xóa admin cấp 1" : "Xóa"} disabled={isLv1}>
                    <i className={`fa-solid ${isLv1 ? "fa-lock" : "fa-trash-can"}`}></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
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
            <span className="page-info">Trang {page + 1} / {pageCount} (Tổng: {total})</span>
            <button className="btn-page" onClick={()=>handlePageChange(skip - limit)} disabled={skip === 0}>
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button className="btn-page" onClick={()=>handlePageChange(skip + limit)} disabled={skip + limit >= total}>
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}