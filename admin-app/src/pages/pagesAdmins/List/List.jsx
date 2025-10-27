import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listAdminAccounts } from "../../../lib/api.js";
import "./List.css"; // dùng chung style bảng giống users/foods

export default function AdminAccountsList(){
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // pagination
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
      const res = await listAdminAccounts(q ? { q, limit, skip } : { limit, skip });
      setItems(res?.items || []);
      setTotal(res?.total || 0);
    } catch (e) {
      setItems([]); setTotal(0);
    } finally { setLoading(false); }
  };

  // load khi phân trang
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [limit, skip]);

  // reload khi filter q thay đổi (debounce nhẹ)
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
    else setSelectedIds(items.map(x => x._id));
  };
  const toggleOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const page = Math.floor(skip / limit);
  const pageCount = Math.ceil(total / limit) || 1;
  const handleLimitChange = (e) => { setLimit(Number(e.target.value)); setSkip(0); };
  const handlePageChange = (newSkip) => {
    if (newSkip >= 0 && newSkip < total) setSkip(newSkip);
  };

  const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "—");

  return (
    <div className="foods-page">
      {/* Breadcrumb */}
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/"><i className="fa-solid fa-house"></i><span>Trang chủ</span></Link>
        <span className="separator">/</span>
        <span className="current-group"><i className="fa-solid fa-user-gear"></i><span>Quản lý Admin</span></span>
        <span className="separator">/</span>
        <span className="current-page">Tài khoản quản trị (cấp 2)</span>
      </nav>

      <div className="card">
        {/* Head */}
        <div className="page-head">
          <h2>Tài khoản quản trị ({total})</h2>
          <div className="head-actions">
            <Link to="/admins/create" className="btn primary">
              <span>Tạo tài khoản</span>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="card-head">
          <div className="search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm theo username / nickname / trạng thái..." />
          </div>
          <div className="filters"><div className="hint"></div></div>
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
            <div className="cell name">Username</div>
            <div className="cell mass">Nickname</div>
            <div className="cell kcal">Cấp</div>
            <div className="cell creator">Trạng thái</div>
            <div className="cell approved">Ngày tạo</div>
            <div className="cell act">Thao tác</div>
          </div>

          {loading && <div className="empty">Đang tải...</div>}
          {!loading && items.length === 0 && <div className="empty">Chưa có admin cấp 2.</div>}

          {!loading && items.map(it => (
            <div key={it._id} className="trow">
              <label className="cell cb">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(it._id)}
                  onChange={() => toggleOne(it._id)}
                  aria-label={`Chọn ${it.username}`}
                />
              </label>

              <div className="cell name">
                <div className="title">{it.username}</div>
                <div className="sub">#{String(it._id).slice(-6)}</div>
              </div>

              <div className="cell mass">{it.nickname}</div>
              <div className="cell kcal">{it.level}</div>
              <div className="cell creator">
                <span className="role-badge">{it.status === "active" ? "Active" : "Blocked"}</span>
              </div>
              <div className="cell approved">{fmtDate(it.createdAt)}</div>

              <div className="cell act">
                {/* Để trống / TODO: block, delete… sẽ thêm sau */}
                <button className="iconbtn" title="Xem chi tiết" onClick={()=>alert("Sẽ bổ sung sau")}>
                  <i className="fa-regular fa-eye"></i>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
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
