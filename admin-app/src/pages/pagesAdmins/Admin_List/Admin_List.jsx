// src/pages/Admin/Admin_List.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  listAdminAccounts,
  updateAdminAccount,
  deleteAdminAccount,
} from "../../../lib/api.js";
import { toast } from "react-toastify";
import "./Admin_List.css";

const NAME_REGEX =
  /^[\p{L}\p{M}0-9\s'’\-.,()]+$/u; // Hoa-thường + Dấu TV + khoảng trắng + số + 1 số ký tự an toàn

export default function AdminAccountsList() {
  const location = useLocation();

  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);

  const [selectedIds, setSelectedIds] = useState([]);

  // ===== Load list
  const load = async () => {
    setLoading(true);
    setSelectedIds([]);
    try {
      const res = await listAdminAccounts(
        q ? { q: q.trim(), limit, skip } : { limit, skip }
      );
      const sorted = [...(res?.items || [])].sort((a, b) => {
        if (a.level === 1 && b.level !== 1) return -1;
        if (a.level !== 1 && b.level === 1) return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
      setItems(sorted);
      setTotal(res?.total || sorted.length || 0);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [limit, skip]);

  // debounce search (username/nickname/status)
  useEffect(() => {
    const t = setTimeout(() => {
      if (skip !== 0) setSkip(0);
      else load();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q]);

  // Toast khi vừa tạo xong từ trang Create chuyển về
  useEffect(() => {
    const st = location.state;
    if (st?.justCreated) {
      toast.success("Tạo tài khoản quản trị thành công!");
      window.history.replaceState({}, document.title); // clear state
    }
    // eslint-disable-next-line
  }, []);

  // ===== Selection (bỏ cấp 1)
  const selectable = useMemo(
    () => items.filter((x) => Number(x.level) !== 1),
    [items]
  );
  const allChecked =
    items.length > 0 &&
    selectable.length > 0 &&
    selectedIds.length === selectable.length;
  const someChecked =
    selectedIds.length > 0 && selectedIds.length < selectable.length;

  const toggleAll = () => {
    if (allChecked) setSelectedIds([]);
    else setSelectedIds(selectable.map((x) => x.id)); // id (không phải _id)
  };
  const toggleOne = (id) => {
    const it = items.find((x) => x.id === id);
    if (Number(it?.level) === 1) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ===== Helpers UI
  const page = Math.floor(skip / limit);
  const pageCount = Math.ceil(total / limit) || 1;
  const handleLimitChange = (e) => {
    setLimit(Number(e.target.value));
    setSkip(0);
  };
  const handlePageChange = (newSkip) => {
    if (newSkip >= 0 && newSkip < total) setSkip(newSkip);
  };
  const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "—");
  const badgeStatus = (s) => (
    <span
      className={`status-badge ${s === "active" ? "is-active" : "is-blocked"}`}
    >
      {s === "active" ? "Hoạt động" : "Đã khóa"}
    </span>
  );

  // ====== Edit modal (validate nickname/password)
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editNickname, setEditNickname] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const [nickErr, setNickErr] = useState("");
  const [passErr, setPassErr] = useState("");

  const validateNickname = (v) => {
    const val = (v || "").trim();
    if (!val) return "Vui lòng nhập nickname.";
    if (val.length > 30) return "Nickname tối đa 30 ký tự.";
    if (!NAME_REGEX.test(val))
      return "Không dùng ký tự đặc biệt (cho phép chữ, số, dấu, khoảng cách, (),-.,’).";
    return "";
    // (Nếu muốn chặt hơn, có thể bỏ bớt (),.-,’)
  };

  const validatePassword = (v) => {
    if (!v) return ""; // không bắt buộc
    if ((v || "").length > 50) return "Mật khẩu tối đa 50 ký tự.";
    return "";
  };

  const openEdit = (item) => {
    if (Number(item.level) === 1) return;
    setEditTarget(item);
    setEditNickname(item.nickname || "");
    setEditPassword("");
    setNickErr("");
    setPassErr("");
    setEditOpen(true);
  };
  const closeEdit = () => {
    setEditOpen(false);
    setEditTarget(null);
    setEditNickname("");
    setEditPassword("");
    setNickErr("");
    setPassErr("");
  };

  const doSaveEdit = async () => {
    if (!editTarget) return;

    const nErr = validateNickname(editNickname);
    const pErr = validatePassword(editPassword);
    setNickErr(nErr);
    setPassErr(pErr);
    if (nErr || pErr) {
      toast.error("Vui lòng sửa các lỗi trước khi lưu.");
      return;
    }

    try {
      const body = { nickname: (editNickname || "").trim() };
      if (editPassword) body.password = editPassword;
      await updateAdminAccount(editTarget.id, body); // id
      toast.success("Cập nhật tài khoản thành công!");
      closeEdit();
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Cập nhật thất bại.");
    }
  };

  // ===== Xoá (single/bulk) dùng confirm .cm-*
  // confirm: { mode:'single'|'bulk', ids:[] }
  const [confirm, setConfirm] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const openDeleteOne = (id, level) => {
    if (Number(level) === 1) return;
    setConfirm({ mode: "single", ids: [id] });
  };
  const openDeleteSelected = () => {
    if (!selectedIds.length) return;
    setConfirm({ mode: "bulk", ids: selectedIds.slice() });
  };

  const onDeleteOne = async (id) => {
    try {
      setDeletingId(id);
      await deleteAdminAccount(id);
      toast.success("Đã xoá 1 tài khoản.");
      setItems((prev) => prev.filter((x) => x.id !== id));
      setTotal((t) => Math.max(0, (t || 0) - 1));
      setSelectedIds((sel) => sel.filter((x) => x !== id));
    } catch (e) {
      toast.error(e?.response?.data?.message || "Xoá thất bại.");
    } finally {
      setDeletingId(null);
    }
  };

  const onBulkDelete = async (ids) => {
    if (!ids?.length) return;
    try {
      setBulkDeleting(true);
      const results = await Promise.allSettled(
        ids.map((id) => deleteAdminAccount(id))
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;

      if (ok) {
        setItems((prev) => prev.filter((x) => !ids.includes(x.id)));
        setTotal((t) => Math.max(0, (t || 0) - ok));
        setSelectedIds([]);
        toast.success(`Đã xoá ${ok} tài khoản.`);
      }
      if (fail) toast.error(`${fail} tài khoản xoá thất bại`);
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="foods-page admin-list-page list-page">
      {/* Breadcrumb */}
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/">
          <i className="fa-solid fa-house"></i>
          <span>Trang chủ</span>
        </Link>
        <span className="separator">/</span>
        <span className="current-group">
          <i className="fa-solid fa-user-gear"></i>
          <span>Quản lý Admin</span>
        </span>
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
              <i className="fa-regular fa-trash-can" />{" "}
              <span>Xóa đã chọn</span>
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
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo username / nickname / trạng thái..."
            />
          </div>
          <div className="filters">
            <div className="hint"></div>
          </div>
        </div>

        <div className="table">
          <div className="thead">
            <label className="cell cb">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked;
                }}
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
          {!loading && items.length === 0 && (
            <div className="empty">Chưa có tài khoản quản trị.</div>
          )}

          {!loading &&
            items.map((it) => {
              const isLv1 = Number(it.level) === 1;
              return (
                <div
                  key={it.id}
                  className={`trow ${isLv1 ? "row-lv1" : ""}`}
                  title={isLv1 ? "Admin cấp 1 (đặc quyền)" : ""}
                >
                  <label className="cell cb">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(it.id)}
                      disabled={isLv1}
                      onChange={() => toggleOne(it.id)}
                      aria-label={`Chọn ${it.username}`}
                    />
                  </label>
                  <div className="cell username">
                    <div className="title">
                      {it.username}
                      {isLv1 && (
                        <span className="lv1-chip" aria-label="Cấp 1">
                          LV1
                        </span>
                      )}
                    </div>
                    <div className="sub">#{String(it.id).slice(-6)}</div>
                  </div>
                  <div className="cell nickname">
                    {it.nickname || "—"}
                  </div>
                  <div className="cell level">{it.level}</div>
                  <div className="cell status">{badgeStatus(it.status)}</div>
                  <div className="cell created">{fmtDate(it.createdAt)}</div>
                  <div className="cell act">
                    <button
                      className="iconbtn"
                      title={
                        isLv1
                          ? "Không thể chỉnh sửa admin cấp 1"
                          : "Xem chi tiết/Chỉnh sửa"
                      }
                      disabled={isLv1}
                      onClick={() => openEdit(it)}
                    >
                      <i
                        className={`fa-solid ${
                          isLv1 ? "fa-lock" : "fa-pen-to-square"
                        }`}
                      ></i>
                    </button>
                    <button
                      className="iconbtn danger"
                      title={
                        isLv1 ? "Không thể xóa admin cấp 1" : "Xóa"
                      }
                      disabled={isLv1}
                      onClick={() => openDeleteOne(it.id, it.level)}
                    >
                      <i
                        className={`fa-solid ${
                          isLv1 ? "fa-lock" : "fa-trash-can"
                        }`}
                      ></i>
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
            <span className="page-info">
              Trang {page + 1} / {pageCount} (Tổng: {total})
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

      {/* ===== Modal Edit (float label, validate) ===== */}
      {editOpen && (
        <div className="fm-modal-overlay" onClick={closeEdit}>
          <div
            className="fm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="al-sec-label" role="heading" aria-level="2">
              <span className="al-sec-title">Chỉnh sửa tài khoản</span>
            </div>

            <div className="al-form">
              <div className="al-field">
                <input
                  id="al-username"
                  value={editTarget?.username || ""}
                  disabled
                  placeholder=" "
                />
                <label htmlFor="al-username">Username</label>
              </div>

              <div className="al-field">
                <input
                  id="al-nickname"
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  maxLength={30}
                  placeholder=" "
                />
                <label htmlFor="al-nickname">Nickname</label>
                {nickErr && <div className="al-err">{nickErr}</div>}
              </div>

              <div className="al-field">
                <input
                  id="al-password"
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  maxLength={50}
                  placeholder=" "
                />
                <label htmlFor="al-password">Mật khẩu (tùy chọn)</label>
                {passErr && <div className="al-err">{passErr}</div>}
              </div>
            </div>

            <div className="fm-modal__actions">
              <button className="fm-btn ghost" onClick={closeEdit}>
                Hủy
              </button>
              <button className="fm-btn primary" onClick={doSaveEdit}>
                Lưu
              </button>
            </div>
          </div>
        </div>
      )}

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
                  ? `Xóa ${confirm.ids.length} tài khoản đã chọn?`
                  : "Xóa tài khoản?"}
              </h1>
            </div>

            <div id="cm-desc" className="cm-body">
              Hành động này sẽ xóa khỏi danh sách và cơ sở dữ liệu. Thao tác
              không thể hoàn tác.
            </div>

            <div className="cm-foot">
              <button className="btn ghost" onClick={() => setConfirm(null)}>
                Hủy
              </button>

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
                  {bulkDeleting
                    ? "Đang xóa..."
                    : `Xóa ${confirm.ids.length}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
