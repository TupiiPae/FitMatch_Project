// src/pages/Admin/Admin_List.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listAdminAccounts,
  updateAdminAccount,
  deleteAdminAccount,
} from "../../../lib/api.js";
import { toast } from "react-toastify";
import "./Admin_List.css";

export default function AdminAccountsList(){
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);

  const [selectedIds, setSelectedIds] = useState([]);

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

  // === Checkbox chọn nhiều (trừ cấp 1) ===
  const selectable = useMemo(() => items.filter(x => x.level !== 1), [items]);
  const allChecked = items.length > 0 && selectedIds.length === selectable.length && selectable.length>0;
  const someChecked = selectedIds.length > 0 && selectedIds.length < selectable.length;

  const toggleAll = () => {
    if (allChecked) setSelectedIds([]);
    else setSelectedIds(selectable.map(x => x.id)); // <-- id (không phải _id)
  };
  const toggleOne = (id) => {
    const it = items.find(x => x.id === id);
    if (it?.level === 1) return;
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const page = Math.floor(skip / limit);
  const pageCount = Math.ceil(total / limit) || 1;
  const handleLimitChange = (e) => { setLimit(Number(e.target.value)); setSkip(0); };
  const handlePageChange = (newSkip) => { if (newSkip >= 0 && newSkip < total) setSkip(newSkip); };

  const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "—");
  const badgeStatus = (s) => (
    <span className={`status-badge ${s === "active" ? "is-active" : "is-blocked"}`}>
      {s === "active" ? "Hoạt động" : "Đã khóa"}
    </span>
  );

  // ===== Modal Edit =====
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editNickname, setEditNickname] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const openEdit = (item) => {
    if (Number(item.level) === 1) return;
    setEditTarget(item);
    setEditNickname(item.nickname || "");
    setEditPassword("");
    setEditOpen(true);
  };
  const closeEdit = () => { setEditOpen(false); setEditTarget(null); setEditNickname(""); setEditPassword(""); };
  const doSaveEdit = async () => {
    if (!editTarget) return;
    try {
      const body = { nickname: (editNickname || "").trim() };
      if (editPassword) body.password = editPassword;
      await updateAdminAccount(editTarget.id, body); // <-- id
      toast.success("Cập nhật tài khoản thành công!");
      closeEdit(); load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Cập nhật thất bại.");
}
  };

  // ===== Modal Delete =====
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState([]);
  const openDeleteOne = (id, level) => {
    if (Number(level) === 1) return;
    setDeleteIds([id]); setDeleteOpen(true);
  };
  const openDeleteSelected = () => {
    if (!selectedIds.length) return;
    setDeleteIds(selectedIds.slice()); setDeleteOpen(true);
  };
  const closeDelete = () => { setDeleteOpen(false); setDeleteIds([]); };
  const doDelete = async () => {
    try {
      for (const id of deleteIds) {
        await deleteAdminAccount(id); // <-- id
      }
      toast.success(`Đã xóa ${deleteIds.length} tài khoản.`);
      closeDelete(); load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Xóa thất bại.");
    }
  };

  return (
    <div className="foods-page admin-list-page">
      {/* Breadcrumb */}
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/"><i className="fa-solid fa-house"></i><span>Trang chủ</span></Link>
        <span className="separator">/</span>
        <span className="current-group"><i className="fa-solid fa-user-gear"></i><span>Quản lý Admin</span></span>
        <span className="separator">/</span>
        <span className="current-page">Tài khoản quản trị</span>
      </nav>

      <div className="card">
        <div className="page-head">
          <h2>Tài khoản quản trị ({total})</h2>
          <div className="head-actions">
            <button
              className="btn danger"
              type="button"
              disabled={!selectedIds.length}
              onClick={openDeleteSelected}
            >
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
        _Bỏ_         onChange={toggleAll}
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
              <div key={it.id} className={`trow ${isLv1 ? "row-lv1" : ""}`} title={isLv1 ? "Admin cấp 1 (đặc quyền)" : ""}>
                <label className="cell cb">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(it.id)}
                    disabled={isLv1}
                    onChange={() => toggleOne(it.id)}
          _Bỏ_         aria-label={`Chọn ${it.username}`}
                  />
                </label>
                <div className="cell username">
                  <div className="title">
                    {it.username}
                    {isLv1 && <span className="lv1-chip" aria-label="Cấp 1">LV1</span>}
                  </div>
                  <div className="sub">#{String(it.id).slice(-6)}</div>
                </div>
                <div className="cell nickname">{it.nickname || '—'}</div>
                <div className="cell level">{it.level}</div>
                <div className="cell status">{badgeStatus(it.status)}</div>
                <div className="cell created">{fmtDate(it.createdAt)}</div>
                <div className="cell act">
                  <button
                    className="iconbtn"
                    title={isLv1 ? "Không thể chỉnh sửa admin cấp 1" : "Xem chi tiết/Chỉnh sửa"}
                    disabled={isLv1}
                    onClick={() => openEdit(it)}
                  >
                    <i className={`fa-solid ${isLv1 ? "fa-lock" : "fa-pen-to-square"}`}></i>
                  </button>
                  <button
                    className="iconbtn danger"
                    title={isLv1 ? "Không thể xóa admin cấp 1" : "Xóa"}
                    disabled={isLv1}
              _Bỏ_     onClick={() => openDeleteOne(it.id, it.level)}
                  >
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

      {/* Modal Edit */}
      {editOpen && (
        <div className="fm-modal-overlay" onClick={closeEdit}>
          <div
            className="fm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-title"
            onClick={(e)=>e.stopPropagation()}
          >
            <div className="al-sec-label" role="heading" aria-level="2">
              <span className="al-sec-title">Chỉnh sửa tài khoản</span>
              {/* <span className="al-sec-hint">Tên hiển thị & mật khẩu</span> */} 
            </div>

            <div className="al-form">
              {/* các trường của bạn giữ nguyên */}
              <div className="al-field">
                <input id="al-username" value={editTarget?.username || ""} disabled placeholder=" " />
                <label htmlFor="al-username">Username</label>
              </div>

              <div className="al-field">
                <input id="al-nickname" value={editNickname} onChange={(e)=>setEditNickname(e.target.value)} maxLength={30} placeholder=" " />
                <label htmlFor="al-nickname">Nickname</label>
              </div>

              <div className="al-field">
                <input id="al-password" type="password" value={editPassword} onChange={(e)=>setEditPassword(e.target.value)} maxLength={30} placeholder=" " />
                <label htmlFor="al-password">Mật khẩu (tùy chọn)</label>
              </div>
            </div>

            <div className="fm-modal__actions">
              <button className="fm-btn ghost" onClick={closeEdit}>Hủy</button>
              {/* Nút Lưu đã được style #008080 trong CSS ở trên */}
              <button className="fm-btn primary" onClick={doSaveEdit}>Lưu</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL DELETE (ĐÃ SỬA) ===== */}
      {deleteOpen && (
        <div className="fm-modal-overlay" onClick={closeDelete}>
          <div 
            className="fm-modal" 
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="del-title" 
            aria-describedby="del-desc"
            onClick={(e)=>e.stopPropagation()}
          >
            {/* Cấu trúc Head, Body, Actions */}
            <div className="fm-modal__head">
              <h3 id="del-title" className="fm-modal__title">Xóa tài khoản</h3>
            </div>
            <div id="del-desc" className="fm-modal__body">
              Xác nhận xóa tài khoản. Có <b>{deleteIds.length}</b> tài khoản được chọn.
            </div>
            <div className="fm-modal__actions">
              <button className="fm-btn ghost" onClick={closeDelete}>Hủy</button>
              <button className="fm-btn danger" onClick={doDelete}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}