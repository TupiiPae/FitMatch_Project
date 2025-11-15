// admin-app/src/pages/pagesExercises/SuggestPlan_List/SuggestPlan_List.jsx
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  api,
  listSuggestPlansAdminOnly,
  deleteSuggestPlan,
} from "../../../lib/api";
import { toast } from "react-toastify";

import "./SuggestPlan_List.css";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

export default function SuggestPlan_List() {
  const nav = useNavigate();
  const location = useLocation();

  // ---- Filter ----
  const [q, setQ] = useState("");

  // ---- Data ----
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);

  // ---- Selection ----
  const [selectedIds, setSelectedIds] = useState([]);
  const allChecked = items.length > 0 && selectedIds.length === items.length;
  const someChecked = selectedIds.length > 0 && selectedIds.length < items.length;

  // ---- Delete / modal ----
  // { mode: 'single'|'bulk', ids: string[] } | null
  const [confirm, setConfirm] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // ---- Highlight row (sau khi create / update) ----
  const [flashId, setFlashId] = useState(null);

  const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "—");
  const countSessions = (p) =>
    Array.isArray(p?.sessions) ? p.sessions.length : 0;
  const countExercises = (p) => {
    if (!Array.isArray(p?.sessions)) return 0;
    return p.sessions.reduce((sum, s) => {
      const arr = s.exercises || s.items || [];
      return sum + (Array.isArray(arr) ? arr.length : 0);
    }, 0);
  };

  const load = async () => {
    setLoading(true);
    setSelectedIds([]);
    try {
      const params = { limit, skip };
      const qTrim = (q || "").trim();
      if (qTrim) params.q = qTrim;

      const res = await listSuggestPlansAdminOnly(params);
      const arr = Array.isArray(res?.items) ? res.items : [];
      setItems(arr);
      setTotal(typeof res?.total === "number" ? res.total : arr.length);
    } catch (err) {
      console.error(err);
      setItems([]);
      setTotal(0);
      toast.error("Không tải được danh sách lịch tập gợi ý");
    } finally {
      setLoading(false);
    }
  };

  // load khi đổi pageSize / skip
  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    load();
  }, [limit, skip]);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      if (skip !== 0) setSkip(0);
      else load();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // pick up state từ trang create / edit để flash row
  useEffect(() => {
    const s = location.state;
    if (s?.justCreated || s?.justUpdated) {
      const targetId = s.createdId || s.updatedId;
      (async () => {
        try {
          if (skip !== 0) setSkip(0);
          await load();
          if (targetId) {
            setFlashId(targetId);
            setTimeout(() => setFlashId(null), 2500);
          }
        } catch {}
      })();

      nav(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- selection ----
  const toggleAll = () => {
    setSelectedIds(allChecked ? [] : items.map((x) => x._id));
  };
  const toggleOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ---- delete single ----
  const onDeleteOne = async (id) => {
    try {
      setDeletingId(id);
      await deleteSuggestPlan(id);

      if (items.length === 1 && skip > 0) {
        setSkip(Math.max(0, skip - limit));
      } else {
        setItems((prev) => prev.filter((x) => x._id !== id));
        setTotal((t) => Math.max(0, Number(t || 0) - 1));
        setSelectedIds((sel) => sel.filter((x) => x !== id));
      }
      toast.success("Đã xóa lịch tập gợi ý");
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Xóa lịch tập thất bại");
    } finally {
      setDeletingId(null);
    }
  };

  // ---- delete bulk ----
  const onBulkDelete = async (ids) => {
    if (!ids?.length) return;
    try {
      setBulkDeleting(true);
      const results = await Promise.allSettled(
        ids.map((id) => deleteSuggestPlan(id))
      );
      const okCount = results.filter((r) => r.status === "fulfilled").length;
      const failCount = results.length - okCount;

      const deletingAllOnPage = ids.length >= items.length;
      if (deletingAllOnPage && skip > 0) {
        setSkip(Math.max(0, skip - limit));
      } else {
        setItems((prev) => prev.filter((x) => !ids.includes(x._id)));
        setTotal((t) => Math.max(0, Number(t || 0) - okCount));
        setSelectedIds([]);
      }

      if (okCount > 0)
        toast.success(`Đã xóa ${okCount} lịch tập gợi ý`);
      if (failCount > 0)
        toast.error(`${failCount} lịch tập xóa thất bại`);
    } catch (err) {
      console.error(err);
      toast.error("Xóa lịch tập thất bại");
    } finally {
      setBulkDeleting(false);
    }
  };

  // ---- pagination ----
  const page = Math.floor(skip / limit);
  const pageCount = Math.max(1, Math.ceil((total || 0) / limit));
  const handleLimitChange = (e) => {
    setLimit(Number(e.target.value));
    setSkip(0);
  };
  const handlePageChange = (newSkip) => {
    if (newSkip >= 0 && newSkip < Math.max(total, 1)) setSkip(newSkip);
  };

  return (
    <div className="spg-page">
      {/* breadcrumb */}
      <nav className="spg-breadcrumb" aria-label="breadcrumb">
        <Link to="/">
          <i className="fa-solid fa-house" /> <span>Trang chủ</span>
        </Link>
        <span className="spg-sep">/</span>
        <span className="spg-grp">
          <i className="fa-solid fa-dumbbell" />{" "}
          <span>Quản lý Bài tập</span>
        </span>
        <span className="spg-sep">/</span>
        <span className="spg-cur">Danh sách lịch tập gợi ý</span>
      </nav>

      <div className="spg-card">
        {/* Header */}
        <div className="spg-head">
          <h2>Danh sách lịch tập gợi ý ({total})</h2>
          <div className="spg-actions">
            <button
              className="btn danger"
              type="button"
              disabled={!selectedIds.length || bulkDeleting}
              onClick={() =>
                setConfirm({
                  mode: "bulk",
                  ids: selectedIds.slice(),
                })
              }
            >
              <i className="fa-regular fa-trash-can" />{" "}
              <span>
                {bulkDeleting ? "Đang xóa..." : "Xóa"}
              </span>
            </button>
            <Link
              className="btn primary"
              to="/exercises/suggest-plan/create"
            >
              <span>Tạo lịch tập</span>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="spg-filters">
          <div className="spg-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên lịch tập gợi ý..."
            />
          </div>
        </div>

        {/* Table */}
        <div className="spg-table">
          <div className="spg-thead">
            <label className="spg-cell cb">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked;
                }}
                onChange={toggleAll}
              />
            </label>
            <div className="spg-cell img">Hình ảnh</div>
            <div className="spg-cell name">Tên lịch tập gợi ý</div>
            <div className="spg-cell sessions">
              Số buổi tập
            </div>
            <div className="spg-cell exercises">
              Số bài tập
            </div>
            <div className="spg-cell created">Thời gian tạo</div>
            <div className="spg-cell act">Thao tác</div>
          </div>

          {loading && (
            <div className="spg-empty">Đang tải...</div>
          )}
          {!loading && items.length === 0 && (
            <div className="spg-empty">
              Chưa có lịch tập gợi ý.
            </div>
          )}

          {!loading &&
            items.map((it) => (
              <div
                key={it._id}
                className={`spg-trow ${
                  flashId === it._id ? "spg-row--flash" : ""
                }`}
              >
                <label className="spg-cell cb">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(it._id)}
                    onChange={() => toggleOne(it._id)}
                  />
                </label>

                <div className="spg-cell img">
                  {it.imageUrl ? (
                    <img
                      src={toAbs(it.imageUrl)}
                      alt={it.name}
                      onError={(e) => {
                        e.currentTarget.src =
                          "/images/food-placeholder.jpg";
                      }}
                    />
                  ) : (
                    <div className="spg-img-fallback">
                      <i className="fa-regular fa-image" />
                    </div>
                  )}
                </div>

                <div className="spg-cell name">
                  <div className="spg-title">
                    {it.name || "—"}
                  </div>
                  <div className="spg-sub">
                    #{String(it._id).slice(-6)}
                  </div>
                </div>

                <div className="spg-cell sessions">
                  {countSessions(it)}
                </div>
                <div className="spg-cell exercises">
                  {countExercises(it)}
                </div>
                <div className="spg-cell created">
                  {fmtDate(it.createdAt)}
                </div>

                <div className="spg-cell act">
                  <button
                    className="iconbtn"
                    title="Chỉnh sửa"
                    onClick={() =>
                      nav(
                        `/exercises/suggest-plan/${it._id}/edit`
                      )
                    }
                  >
                    <i className="fa-regular fa-pen-to-square" />
                  </button>
                  <button
                    className="iconbtn danger"
                    title="Xóa"
                    disabled={deletingId === it._id}
                    onClick={() =>
                      setConfirm({
                        mode: "single",
                        ids: [it._id],
                      })
                    }
                  >
                    <i className="fa-solid fa-trash-can" />
                  </button>
                </div>
              </div>
            ))}
        </div>

        {/* Pagination */}
        <div className="spg-pagination">
          <div className="spg-per-page">
            <span>Hiển thị:</span>
            <select value={limit} onChange={handleLimitChange}>
              <option value="10">10 hàng</option>
              <option value="25">25 hàng</option>
              <option value="50">50 hàng</option>
            </select>
          </div>
          <div className="spg-page-nav">
            <span className="spg-page-info">
              Trang {page + 1} / {Math.max(pageCount, 1)} (Tổng:{" "}
              {total})
            </span>
            <button
              className="btn-page"
              onClick={() => handlePageChange(skip - limit)}
              disabled={skip === 0}
            >
              <i className="fa-solid fa-chevron-left" />
            </button>
            <button
              className="btn-page"
              onClick={() => handlePageChange(skip + limit)}
              disabled={skip + limit >= total}
            >
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Delete – giữ đúng style modal như Strength_List */}
      {confirm && (
        <div
          className="cm-backdrop"
          onClick={() => setConfirm(null)}
        >
          <div
            className="cm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cm-head">
              <h1 className="cm-title">
                {confirm.mode === "bulk"
                  ? `Xóa ${confirm.ids.length} lịch tập gợi ý?`
                  : "Xóa lịch tập gợi ý?"}
              </h1>
            </div>
            <div className="cm-body">
              Thao tác không thể hoàn tác.
            </div>
            <div className="cm-foot">
              <button
                className="btn ghost"
                onClick={() => setConfirm(null)}
              >
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
                  {deletingId === confirm.ids[0]
                    ? "Đang xóa..."
                    : "Xóa"}
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
