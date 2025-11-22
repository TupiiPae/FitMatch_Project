import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  api,
  listSuggestMenusAdminOnly,
  deleteSuggestMenu,
} from "../../../lib/api";
import { toast } from "react-toastify";
import "./SuggestMenu_List.css";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

export default function SuggestMenu_List() {
  const nav = useNavigate();
  const location = useLocation();

  const [q, setQ] = useState("");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);

  const [selectedIds, setSelectedIds] = useState([]);
  const allChecked = items.length > 0 && selectedIds.length === items.length;
  const someChecked =
    selectedIds.length > 0 && selectedIds.length < items.length;

  const [confirm, setConfirm] = useState(null); // { mode:'single'|'bulk', ids:[] }
  const [deletingId, setDeletingId] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [flashId, setFlashId] = useState(null);

  const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "—");
  const fmtMacrosTriple = (p, c, f) =>
    `${Math.round(p || 0)}g / ${Math.round(c || 0)}g / ${Math.round(
      f || 0
    )}g`;

  const load = async () => {
    setLoading(true);
    setSelectedIds([]);
    try {
      const params = { limit, skip };
      const qTrim = (q || "").trim();
      if (qTrim) params.q = qTrim;

      const res = await listSuggestMenusAdminOnly(params);
      const arr = Array.isArray(res?.items) ? res.items : [];
      setItems(arr);
      setTotal(typeof res?.total === "number" ? res.total : arr.length);
    } catch (err) {
      console.error(err);
      setItems([]);
      setTotal(0);
      toast.error("Không tải được danh sách thực đơn gợi ý");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    load();
  }, [limit, skip]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (skip !== 0) setSkip(0);
      else load();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // highlight item sau create/update
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

  const toggleAll = () => {
    setSelectedIds(allChecked ? [] : items.map((x) => x._id));
  };
  const toggleOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const onDeleteOne = async (id) => {
    try {
      setDeletingId(id);
      await deleteSuggestMenu(id);

      if (items.length === 1 && skip > 0) {
        setSkip(Math.max(0, skip - limit));
      } else {
        setItems((prev) => prev.filter((x) => x._id !== id));
        setTotal((t) => Math.max(0, Number(t || 0) - 1));
        setSelectedIds((sel) => sel.filter((x) => x !== id));
      }
      toast.success("Đã xóa thực đơn gợi ý");
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message;
      toast.error(msg || "Xóa thực đơn thất bại");
    } finally {
      setDeletingId(null);
    }
  };

  const onBulkDelete = async (ids) => {
    if (!ids?.length) return;
    try {
      setBulkDeleting(true);
      const results = await Promise.allSettled(
        ids.map((id) => deleteSuggestMenu(id))
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

      if (okCount > 0) {
        toast.success(`Đã xóa ${okCount} thực đơn gợi ý`);
      }
      if (failCount > 0) {
        toast.error(`${failCount} thực đơn xóa thất bại`);
      }
    } catch (err) {
      console.error(err);
      toast.error("Xóa thực đơn thất bại");
    } finally {
      setBulkDeleting(false);
    }
  };

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
    <div className="sml-page">
      {/* breadcrumb */}
      <nav className="sml-breadcrumb" aria-label="breadcrumb">
        <Link to="/">
          <i className="fa-solid fa-house" /> <span>Trang chủ</span>
        </Link>
        <span className="sml-sep">/</span>
        <span className="sml-grp">
          <i className="fa-solid fa-bowl-food" />{" "}
          <span>Quản lý Thực đơn gợi ý</span>
        </span>
        <span className="sml-sep">/</span>
        <span className="sml-cur">Danh sách thực đơn gợi ý</span>
      </nav>

      <div className="sml-card">
        {/* Header */}
        <div className="sml-head">
          <h2>Danh sách thực đơn gợi ý ({total})</h2>
          <div className="sml-actions">
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
              <span>{bulkDeleting ? "Đang xóa..." : "Xóa"}</span>
            </button>
            <Link className="btn primary" to="/foods/suggest-menu/create">
              <span>Tạo thực đơn</span>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="sml-filters">
          <div className="sml-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên thực đơn gợi ý..."
            />
          </div>
        </div>

        {/* Table */}
        <div className="sml-table">
          <div className="sml-thead">
            <label className="sml-cell cb">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked;
                }}
                onChange={toggleAll}
              />
            </label>
            <div className="sml-cell img">Hình ảnh</div>
            <div className="sml-cell name">Tên thực đơn gợi ý</div>
            <div className="sml-cell category">Phân loại</div>
            <div className="sml-cell days">Số ngày</div>
            <div className="sml-cell total-kcal">Tổng Calorie</div>
            <div className="sml-cell macros">Đạm / Đường bột / Chất béo</div>
            <div className="sml-cell created">Thời gian tạo</div>
            <div className="sml-cell act">Thao tác</div>
          </div>

          {loading && <div className="sml-empty">Đang tải...</div>}
          {!loading && items.length === 0 && (
            <div className="sml-empty">Chưa có thực đơn gợi ý.</div>
          )}

          {!loading &&
            items.map((it) => (
              <div
                key={it._id}
                className={`sml-trow ${
                  flashId === it._id ? "sml-row--flash" : ""
                }`}
              >
                <label className="sml-cell cb">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(it._id)}
                    onChange={() => toggleOne(it._id)}
                  />
                </label>

                <div className="sml-cell img">
                  {it.imageUrl ? (
                    <img
                      src={toAbs(it.imageUrl)}
                      alt={it.name}
                      onError={(e) => {
                        e.currentTarget.src = "/images/food-placeholder.jpg";
                      }}
                    />
                  ) : (
                    <div className="sml-img-fallback">
                      <i className="fa-regular fa-image" />
                    </div>
                  )}
                </div>

                <div className="sml-cell name">
                  <div className="sml-title">{it.name || "—"}</div>
                  <div className="sml-sub">
                    #{String(it._id || "").slice(-6)}
                  </div>
                </div>

                <div className="sml-cell category">{it.category || "—"}</div>
                <div className="sml-cell days">{it.numDays || "—"}</div>
                <div className="sml-cell total-kcal">
                  {Math.round(it.totalKcal || 0).toLocaleString()} kcal
                </div>
                <div className="sml-cell macros">
                  {fmtMacrosTriple(
                    it.totalProteinG,
                    it.totalCarbG,
                    it.totalFatG
                  )}
                </div>
                <div className="sml-cell created">
                  {fmtDate(it.createdAt)}
                </div>

                <div className="sml-cell act">
                  <button
                    className="iconbtn"
                    title="Chỉnh sửa"
                    onClick={() =>
                      nav(`/foods/suggest-menu/${it._id}/edit`)
                    }
                  >
                    <i className="fa-regular fa-pen-to-square" />
                  </button>
                  <button
                    className="iconbtn danger"
                    title="Xóa"
                    disabled={deletingId === it._id}
                    onClick={() =>
                      setConfirm({ mode: "single", ids: [it._id] })
                    }
                  >
                    <i className="fa-solid fa-trash-can" />
                  </button>
                </div>
              </div>
            ))}
        </div>

        {/* Pagination */}
        <div className="sml-pagination">
          <div className="sml-per-page">
            <span>Hiển thị:</span>
            <select value={limit} onChange={handleLimitChange}>
              <option value="10">10 hàng</option>
              <option value="25">25 hàng</option>
              <option value="50">50 hàng</option>
            </select>
          </div>
          <div className="sml-page-nav">
            <span className="sml-page-info">
              Trang {page + 1} / {Math.max(pageCount, 1)} (Tổng: {total})
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

      {/* Confirm Delete */}
      {confirm && (
        <div className="cm-backdrop" onClick={() => setConfirm(null)}>
          <div
            className="cm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cm-head">
              <h1 className="cm-title">
                {confirm.mode === "bulk"
                  ? `Xóa ${confirm.ids.length} thực đơn gợi ý?`
                  : "Xóa thực đơn gợi ý?"}
              </h1>
            </div>
            <div className="cm-body">
              Thao tác này không thể hoàn tác. Bạn chắc chắn muốn xoá?
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
