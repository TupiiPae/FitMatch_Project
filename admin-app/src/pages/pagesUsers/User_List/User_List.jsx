import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { listUsers, blockUser, unblockUser } from "../../../lib/api.js";
import "./User_List.css";

/** Chips danh sách email (ngang, gọn) */
function EmailChips({ users, showReason = false }) {
  if (!Array.isArray(users) || users.length === 0) return null;
  return (
    <div className="ulist-chipwrap">
      {users.map((u) => (
        <div key={u._id} className="ulist-chip" title={u.email || "(không có email)"}>
          <span className="ulist-chip-mail">{u.email || "—"}</span>
          {showReason && (
            <span className="ulist-chip-reason">
              {u.blockedReason ? `: ${u.blockedReason}` : ": (Vi phạm tiêu chuẩn cộng đồng)"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Popup khóa tài khoản – nhập lý do (multi/single) */
function BlockReasonModal({ open, onClose, onSubmit, users = [], loading }) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (open) setReason(""); }, [open]);
  if (!open) return null;

  const count = users.length;

  return (
    <div className="cm-backdrop" onMouseDown={(e) => e.target.classList.contains("cm-backdrop") && onClose()}>
      <div className="cm-modal" role="dialog" aria-modal="true" aria-labelledby="blk-title">
        <div className="cm-head">
          <h3 id="blk-title">
            <i className="fa-solid fa-lock"></i>{" "}
            {count > 1 ? <>Bạn đang chọn <b>{count}</b> tài khoản để khóa</> : <>Khóa tài khoản</>}
          </h3>
        </div>
        <div className="cm-body">
          {count > 0 && (
            <>
              <p style={{ marginTop: 0, marginBottom: 8 }}>
                {count > 1
                  ? "Danh sách email các tài khoản sẽ bị khóa:"
                  : "Email tài khoản sẽ bị khóa:"}
              </p>
              <EmailChips users={users} />
            </>
          )}

          <label className="fc-field" style={{ width: "100%", marginTop: 12 }}>
            <span className="fc-label">Lý do khóa (bắt buộc)</span>
            <textarea
              className="auth-input"
              rows={5}
              placeholder="Nhập lý do khóa"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              required
            />
          </label>
          <div className="error-stack" aria-live="polite">
            {!reason.trim() && <span className="error-item">Vui lòng nhập lý do khóa.</span>}
          </div>
        </div>
        <div className="cm-foot">
          <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>Hủy</button>
          <button
            type="button"
            className={`btn danger ${loading ? "loading" : ""}`}
            onClick={() => reason.trim() && onSubmit(reason.trim())}
            disabled={!reason.trim() || loading}
          >
            <i className="fa-solid fa-lock" /> <span>Khóa tài khoản</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Popup xác nhận mở khóa – hiển thị lý do đã bị khóa */
function ConfirmUnblockModal({ open, onClose, onConfirm, users = [], loading }) {
  if (!open) return null;
  const count = users.length;

  return (
    <div className="cm-backdrop" onMouseDown={(e) => e.target.classList.contains("cm-backdrop") && onClose()}>
      <div className="cm-modal" role="dialog" aria-modal="true" aria-labelledby="cfm-title">
        <div className="cm-head">
          <h3 id="cfm-title">
            <i className="fa-solid fa-lock-open"></i>{" "}
            {count > 1 ? <>Mở khóa <b>{count}</b> tài khoản</> : <>Mở khóa tài khoản</>}
          </h3>
        </div>
        <div className="cm-body">
          <p style={{ marginTop: 0, marginBottom: 8 }}>
            {count > 1 ? "Danh sách email và lý do bị khóa:" : "Email và lý do bị khóa:"}
          </p>
          <EmailChips users={users} showReason />
        </div>
        <div className="cm-foot">
          <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>Hủy</button>
          <button type="button" className={`btn ${loading ? "loading" : ""}`} onClick={onConfirm} disabled={loading}>
            <i className="fa-solid fa-lock-open" /> <span>Mở khóa</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsersList() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);

  // Lọc trạng thái (null | 'active' | 'blocked')
  const [statusFilter, setStatusFilter] = useState(null);

  // POPUP states
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockIds, setBlockIds] = useState([]);       // ids to block
  const [blockLoading, setBlockLoading] = useState(false);

  const [unblockModalOpen, setUnblockModalOpen] = useState(false);
  const [unblockIds, setUnblockIds] = useState([]);   // ids to unblock
  const [unblockLoading, setUnblockLoading] = useState(false);

  // Load list
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
    const t = setTimeout(() => { if (skip !== 0) setSkip(0); else load(); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q]);

  // Danh sách theo bộ lọc hiển thị
  const displayItems = useMemo(() => {
    let arr = items;
    if (statusFilter === "active") arr = items.filter((u) => !u.blocked);
    else if (statusFilter === "blocked") arr = items.filter((u) => !!u.blocked);
    return arr;
  }, [items, statusFilter]);

  // Selection helpers
  const allChecked = displayItems.length > 0 && selectedIds.length === displayItems.length;
  const someChecked = selectedIds.length > 0 && selectedIds.length < displayItems.length;

  const selectedUsers = useMemo(
    () => displayItems.filter((u) => selectedIds.includes(u._id)),
    [displayItems, selectedIds]
  );

  // Trạng thái chọn
  const hasSelected = selectedUsers.length > 0;
  const allSelectedBlocked = hasSelected && selectedUsers.every((u) => !!u.blocked);
  const allSelectedActive  = hasSelected && selectedUsers.every((u) => !u.blocked);
  const mixedSelected      = hasSelected && !allSelectedBlocked && !allSelectedActive;

  // Quy tắc enable/disable theo yêu cầu:
  // - Khóa đã chọn: chỉ bật khi CHỌN >=2 và tất cả đều đang hoạt động
  const canBlockSelected = selectedUsers.length >= 2 && allSelectedActive;
  // - Mở khóa: bật khi CHỌN >=1 và tất cả đều đang bị khóa
  const canUnblockSelected = selectedUsers.length >= 1 && allSelectedBlocked;
  // - Nếu mixed -> cả 2 nút disable (đã bao quát bởi 2 rule trên)

  const toggleAll = () => {
    if (allChecked) setSelectedIds([]);
    else setSelectedIds(displayItems.map((x) => x._id));
  };
  const toggleOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // ====== BLOCK flow ======
  const openBlockSingle = (id) => {
    // Chỉ cho phép khóa nếu user hiện tại chưa bị khóa
    const target = items.find((x) => x._id === id);
    if (target?.blocked) {
      toast.info("Tài khoản đã bị khóa.");
      return;
    }
    setBlockIds([id]);
    setBlockModalOpen(true);
  };
  const openBlockSelected = () => {
    if (!canBlockSelected) return;
    setBlockIds(selectedIds.slice());
    setBlockModalOpen(true);
  };
  const submitBlock = async (reason) => {
    setBlockLoading(true);
    try {
      for (const id of blockIds) {
        await blockUser(id, reason);
      }
      toast.success(`Đã khóa ${blockIds.length} tài khoản.`);
      setBlockModalOpen(false);
      setBlockIds([]);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Khóa tài khoản thất bại.");
    } finally {
      setBlockLoading(false);
    }
  };

  // ====== UNBLOCK flow ======
  const openUnblockSingle = (id) => {
    const target = items.find((x) => x._id === id);
    if (!target?.blocked) {
      toast.info("Tài khoản đang hoạt động, không cần mở khóa.");
      return;
    }
    setUnblockIds([id]);
    setUnblockModalOpen(true);
  };
  const openUnblockSelected = () => {
    if (!canUnblockSelected) return;
    // chỉ lấy các id đang bị khóa
    setUnblockIds(selectedIds.filter((id) => displayItems.find((u) => u._id === id && u.blocked)));
    setUnblockModalOpen(true);
  };
  const submitUnblock = async () => {
    setUnblockLoading(true);
    try {
      for (const id of unblockIds) {
        await unblockUser(id);
      }
      toast.success(`Đã mở khóa ${unblockIds.length} tài khoản.`);
      setUnblockModalOpen(false);
      setUnblockIds([]);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Mở khóa tài khoản thất bại.");
    } finally {
      setUnblockLoading(false);
    }
  };

  // Helpers
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

  // Lấy danh sách user theo id list (phục vụ modal)
  const usersByIds = (ids) => displayItems.filter((u) => ids.includes(u._id));

  return (
    <div className="foods-page user-list-page">
      {/* Breadcrumb */}
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/"><i className="fa-solid fa-house"></i><span>Trang chủ</span></Link>
        <span className="separator">/</span>
        <span className="current-group"><i className="fa-solid fa-users"></i><span>Quản lý Người dùng</span></span>
        <span className="separator">/</span>
        <span className="current-page">Danh sách người dùng</span>
      </nav>

      {/* Card */}
      <div className="card">
        <div className="page-head">
          <h2>Danh sách người dùng ({total})</h2>
          <div className="head-actions">
            <button
              className="btn danger"
              type="button"
              disabled={!canBlockSelected}
              onClick={openBlockSelected}
              title={
                mixedSelected
                  ? "Danh sách chọn gồm cả tài khoản đã khóa và đang hoạt động."
                  : (!canBlockSelected && selectedIds.length
                      ? "Chỉ có thể khóa khi chọn ≥ 2 tài khoản và tất cả đều đang hoạt động."
                      : undefined)
              }
            >
              <i className="fa-solid fa-lock" /> <span>Khóa đã chọn</span>
            </button>
            <button
              className="btn ghost"
              type="button"
              disabled={!canUnblockSelected}
              onClick={openUnblockSelected}
              title={
                mixedSelected
                  ? "Danh sách chọn gồm cả tài khoản đã khóa và đang hoạt động."
                  : (!canUnblockSelected && selectedIds.length
                      ? "Chỉ có thể mở khóa khi tất cả tài khoản được chọn đang bị khóa."
                      : undefined)
              }
            >
              <i className="fa-solid fa-lock-open" /> <span>Mở khóa</span>
            </button>
          </div>
        </div>

        {/* Search + Filters */}
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
            <div className="filter-row">
              <span className="hint">Lọc theo trạng thái:</span>
              <div className="seg">
                <button
                  type="button"
                  className={`seg-btn ${statusFilter === null ? "is-active" : ""}`}
                  onClick={() => setStatusFilter(null)}
                >
                  Tất cả
                </button>
                <button
                  type="button"
                  className={`seg-btn ${statusFilter === "active" ? "is-active" : ""}`}
                  onClick={() => setStatusFilter("active")}
                >
                  Hoạt động
                </button>
                <button
                  type="button"
                  className={`seg-btn ${statusFilter === "blocked" ? "is-active" : ""}`}
                  onClick={() => setStatusFilter("blocked")}
                >
                  Đã khóa
                </button>
              </div>
            </div>
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
          {!loading && displayItems.length === 0 && <div className="empty">Không có người dùng.</div>}

          {!loading && displayItems.map((u) => (
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
                  <span
                    className="status-badge is-blocked"
                    title={u?.blockedReason ? String(u.blockedReason) : "Tài khoản đã bị khóa"}
                  >
                    Đã khóa
                  </span>
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
                    onClick={() => openBlockSingle(u._id)}
                  >
                    <i className="fa-solid fa-lock"></i>
                  </button>
                ) : (
                  <button
                    className="iconbtn"
                    type="button"
                    title="Mở khóa"
                    onClick={() => openUnblockSingle(u._id)}
                  >
                    <i className="fa-solid fa-lock-open"></i>
                  </button>
                )}
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
            <button className="btn-page" onClick={() => handlePageChange(skip - limit)} disabled={skip === 0} aria-label="Trang trước">
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button className="btn-page" onClick={() => handlePageChange(skip + limit)} disabled={skip + limit >= total} aria-label="Trang sau">
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      {/* MODALS */}
      <BlockReasonModal
        open={blockModalOpen}
        onClose={() => { if (!blockLoading) setBlockModalOpen(false); }}
        onSubmit={submitBlock}
        users={usersByIds(blockIds)}
        loading={blockLoading}
      />
      <ConfirmUnblockModal
        open={unblockModalOpen}
        onClose={() => { if (!unblockLoading) setUnblockModalOpen(false); }}
        onConfirm={submitUnblock}
        users={usersByIds(unblockIds)}
        loading={unblockLoading}
      />
    </div>
  );
}
