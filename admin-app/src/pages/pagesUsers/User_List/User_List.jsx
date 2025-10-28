import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listUsers, blockUser, unblockUser } from "../../../lib/api.js";
import "./User_List.css"; // Đảm bảo bạn đã import file CSS của User_List

export default function UsersList() {
  // ... (Toàn bộ state và logic giữ nguyên) ...
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const allChecked = items.length > 0 && selectedIds.length === items.length;
  const someChecked = selectedIds.length > 0 && selectedIds.length < items.length;
  const load = async () => {
    setLoading(true);
    setSelectedIds([]);
    try {
      const res = await listUsers({ q, limit, skip });
      setItems(res?.items || []);
      setTotal(res?.total || (res?.items?.length ?? 0));
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
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
    if (allChecked) setSelectedIds([]);
    else setSelectedIds(items.map((x) => x._id));
  };
  const toggleOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const onBlock = async (id) => {
    await blockUser(id);
    await load();
  };
  const onUnblock = async (id) => {
    await unblockUser(id);
    await load();
  };
  const page = Math.floor(skip / limit);
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const handleLimitChange = (e) => { setLimit(Number(e.target.value)); setSkip(0); };
  const handlePageChange = (newSkip) => { if (newSkip >= 0 && newSkip < total) setSkip(newSkip); };
  const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "—");
  const sexLabel = (s) => (s === "male" ? "Nam" : s === "female" ? "Nữ" : "—");
  const fullAddress = (u) => {
    const a = u?.profile?.address || {};
    return [a.city, a.district, a.ward].filter(Boolean).join(", ") || "—";
  };
  const displayName = (u) => u?.profile?.nickname || u?.username || "—";


  return (
    // ===== THAY ĐỔI Ở ĐÂY =====
    // Thêm class "user-list-page" để CSS của chúng ta "mạnh" hơn
    <div className="foods-page user-list-page"> 
      {/* ===== KẾT THÚC THAY ĐỔI ===== */}

      {/* ===== Breadcrumb ===== */}
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        {/* ... (Giữ nguyên) ... */}
        <Link to="/">
          <i className="fa-solid fa-house"></i>
          <span>Trang chủ</span>
        </Link>
        <span className="separator">/</span>
        <span className="current-group">
          <i className="fa-solid fa-users"></i>
          <span>Quản lý Người dùng</span>
        </span>
        <span className="separator">/</span>
        <span className="current-page">Danh sách người dùng</span>
      </nav>

      {/* ===== Card: chứa toàn bộ nội dung ===== */}
      {/* (Phần còn lại của file JSX giữ nguyên y hệt) */}
      <div className="card">
        {/* ===== Title & actions (giống foods) ===== */}
        <div className="page-head">
          <h2>Danh sách người dùng ({total})</h2>
          <div className="head-actions">
            <button className="btn danger" type="button" disabled={!selectedIds.length}>
              <i className="fa-solid fa-lock" /> <span>Khóa đã chọn</span>
            </button>
            <button className="btn ghost" type="button" disabled={!selectedIds.length}>
              <i className="fa-solid fa-lock-open" /> <span>Mở khóa</span>
            </button>
          </div>
        </div>

        {/* ===== Card-head: search ===== */}
        <div className="card-head">
          <div className="search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên, email, SĐT, địa chỉ…"
            />
          </div>
          <div className="filters">
            <div className="hint">Lọc theo từ khóa</div>
          </div>
        </div>

        {/* ===== Table ===== */}
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
            <div className="cell name">Tên người dùng</div>
            <div className="cell sex">Giới tính</div>
            <div className="cell email">Email</div>
            <div className="cell phone">SĐT</div>
            <div className="cell country">Quốc gia</div>
            <div className="cell address">Địa chỉ</div>
            <div className="cell created">Ngày tạo</div>
            <div className="cell status">Trạng thái</div>
            <div className="cell act">Thao tác</div>
          </div>

          {loading && <div className="empty">Đang tải...</div>}
          {!loading && items.length === 0 && <div className="empty">Không có người dùng.</div>}

          {!loading && items.map((u) => (
            <div key={u._id} className="trow">
              <label className="cell cb">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(u._id)}
                  onChange={() => toggleOne(u._id)}
                  aria-label={`Chọn ${displayName(u)}`}
                />
              </label>
              <div className="cell name">
                <div className="title">{displayName(u)}</div>
                <div className="sub">#{String(u._id).slice(-6)}</div>
              </div>
              <div className="cell sex">{sexLabel(u?.profile?.sex)}</div>
              <div className="cell email">{u?.email || "—"}</div>
              <div className="cell phone">{u?.phone || "—"}</div>
              <div className="cell country">Việt Nam</div>
              <div className="cell address">{fullAddress(u)}</div>
              <div className="cell created">{fmtDate(u?.createdAt)}</div>
              <div className="cell status">
                {u?.blocked ? (
                  <span className="status-badge is-blocked">Đã khóa</span>
                ) : (
                  <span className="status-badge is-active">Hoạt động</span>
                )}
              </div>
              <div className="cell act">
                <button
                  className="iconbtn"
                  type="button"
                  title="Xem báo cáo (đang phát triển)"
                  onClick={() => alert("Tính năng báo cáo sẽ được bổ sung sau.")}
                >
                  <i className="fa-regular fa-comment-dots"></i>
                </button>
                {!u?.blocked ? (
                  <button
                    className="iconbtn danger"
                    type="button"
                    title="Khóa người dùng"
                    onClick={() => onBlock(u._id)}
                  >
                    <i className="fa-solid fa-lock"></i>
                  </button>
                ) : (
                  <button
                    className="iconbtn"
                    type="button"
                    title="Mở khóa"
                    onClick={() => onUnblock(u._id)}
                  >
                    <i className="fa-solid fa-lock-open"></i>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ===== Pagination Controls ===== */}
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
              aria-label="Trang trước"
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button
              className="btn-page"
              onClick={() => handlePageChange(skip + limit)}
              disabled={skip + limit >= total}
              aria-label="Trang sau"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}