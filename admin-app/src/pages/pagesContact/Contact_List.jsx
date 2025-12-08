import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listContactMessagesAdmin,
  deleteContactMessageAdmin,
  updateContactMessageStatus,
} from "../../lib/api";
import { toast } from "react-toastify";
import "./Contact_List.css";
import ContactDetailModal from "./Contact_DetailModal.jsx";

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "new", label: "Mới" },
  { value: "processing", label: "Đang xử lý" },
  { value: "done", label: "Đã xong" },
];

const statusLabel = (s) => {
  if (s === "processing") return "Đang xử lý";
  if (s === "done") return "Đã xong";
  return "Mới";
};

const fmtCode = (id) => {
  if (!id) return "—";
  return `#${String(id).slice(-6)}`;
};

export default function Contact_List() {
  /* Filters */
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  /* Data */
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);

  /* Selection */
  const [selectedIds, setSelectedIds] = useState([]);
  const allChecked = items.length > 0 && selectedIds.length === items.length;
  const someChecked =
    selectedIds.length > 0 && selectedIds.length < items.length;

  /* Delete */
  const [confirm, setConfirm] = useState(null); // { mode, ids }
  const [deletingId, setDeletingId] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  /* Detail modal */
  const [detail, setDetail] = useState(null);

  /* Status / detail update */
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  const fmtDate = (v) =>
    v ? new Date(v).toLocaleString("vi-VN") : "—";

  const load = async () => {
    setLoading(true);
    setSelectedIds([]);
    try {
      const params = { limit, skip };
      const qTrim = (q || "").trim();

      if (qTrim) {
        params.q = qTrim;

        // Gợi ý cho API: nếu user gõ mã (#xxxxxx) thì có thể dùng để search theo mã
        // Ví dụ: params.codeSuffix = 'xxxxxx'
        const m = qTrim.match(/^#?([a-zA-Z0-9]{4,24})$/);
        if (m) {
          params.codeSuffix = m[1];
        }
      }
      if (status) params.status = status;

      const res = await listContactMessagesAdmin(params);
      const arr = Array.isArray(res?.items) ? res.items : [];
      setItems(arr);
      setTotal(typeof res?.total === "number" ? res.total : arr.length);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách liên hệ");
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, skip]);

  // debounce khi đổi filter hoặc search
  useEffect(() => {
    const t = setTimeout(() => {
      if (skip !== 0) {
        setSkip(0);
      } else {
        load();
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  const toggleAll = () => {
    setSelectedIds(allChecked ? [] : items.map((x) => x._id));
  };
  const toggleOne = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const onDeleteOne = async (id) => {
    try {
      setDeletingId(id);
      await deleteContactMessageAdmin(id);

      if (items.length === 1 && skip > 0) {
        setSkip(Math.max(0, skip - limit));
      } else {
        setItems((prev) => prev.filter((x) => x._id !== id));
        setTotal((t) => Math.max(0, (t || 0) - 1));
        setSelectedIds((sel) => sel.filter((x) => x !== id));
      }

      toast.success("Đã xoá liên hệ");
    } catch (err) {
      console.error(err);
      toast.error("Xoá liên hệ thất bại");
    } finally {
      setDeletingId(null);
    }
  };

  const onBulkDelete = async (ids) => {
    if (!ids?.length) return;
    try {
      setBulkDeleting(true);
      const results = await Promise.allSettled(
        ids.map((id) => deleteContactMessageAdmin(id))
      );
      const successIds = ids.filter(
        (_id, idx) => results[idx].status === "fulfilled"
      );
      const failCount = ids.length - successIds.length;

      const deletingAll = ids.length >= items.length;
      if (deletingAll && skip > 0) {
        setSkip(Math.max(0, skip - limit));
      } else {
        setItems((prev) =>
          prev.filter((x) => !successIds.includes(x._id))
        );
        setTotal((t) => Math.max(0, (t || 0) - successIds.length));
        setSelectedIds([]);
      }

      if (successIds.length)
        toast.success(`Đã xoá ${successIds.length} liên hệ`);
      if (failCount) toast.error(`${failCount} liên hệ xoá thất bại`);
    } finally {
      setBulkDeleting(false);
    }
  };

  // Cập nhật trạng thái từ dropdown trong bảng
  const handleStatusChange = async (id, next) => {
    setUpdatingStatusId(id);
    try {
      await updateContactMessageStatus(id, next); // vẫn cho phép truyền string
      setItems((prev) =>
        prev.map((x) =>
          x._id === id ? { ...x, status: next } : x
        )
      );
      setDetail((prev) =>
        prev && prev._id === id ? { ...prev, status: next } : prev
      );
      toast.success("Cập nhật trạng thái thành công");
    } catch (err) {
      console.error(err);
      toast.error("Cập nhật trạng thái thất bại");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Lưu từ modal chi tiết (trạng thái + ghi chú nội bộ)
  const handleSaveDetail = async (id, payload) => {
    if (!id || !payload) return;
    setUpdatingStatusId(id);
    try {
      // payload: { status, internalNote }
      await updateContactMessageStatus(id, payload);

      setItems((prev) =>
        prev.map((x) =>
          x._id === id ? { ...x, ...payload } : x
        )
      );
      setDetail((prev) =>
        prev && prev._id === id ? { ...prev, ...payload } : prev
      );
      toast.success("Đã lưu thay đổi liên hệ");
    } catch (err) {
      console.error(err);
      toast.error("Lưu thay đổi liên hệ thất bại");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // CSV export (nếu cần sau này)
  const csv = useMemo(() => {
    const head = [
      "code",
      "name",
      "email",
      "phone",
      "subject",
      "status",
      "createdAt",
    ].join(",");
    const rows = items.map((x) =>
      [
        fmtCode(x._id),
        x.name,
        x.email,
        x.phone,
        x.subject,
        x.status,
        x.createdAt || "",
      ]
        .map((v) => (v ?? "").toString().replace(/"/g, '""'))
        .map((v) => `"${v}"`)
        .join(",")
    );
    return [head, ...rows].join("\n");
  }, [items]);

  const downloadCSV = () => {
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "contact_messages.csv";
    a.click();
  };

  /* Pagination */
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
    <div className="ct-page-admin">
      {/* breadcrumb */}
      <nav className="ct-breadcrumb" aria-label="breadcrumb">
        <Link to="/">
          <i className="fa-solid fa-house" /> <span>Trang chủ</span>
        </Link>
        <span className="sep">/</span>
        <span className="grp">
          <i className="fa-regular fa-envelope" />{" "}
          <span>Liên hệ</span>
        </span>
        <span className="sep">/</span>
        <span className="cur">Danh sách liên hệ</span>
      </nav>

      <div className="ct-card">
        <div className="ct-head">
          <h2>Danh sách liên hệ ({total})</h2>
          <div className="ct-actions">
            <button
              className="btn ghost"
              type="button"
              onClick={downloadCSV}
              disabled={items.length === 0}
            >
              <i className="fa-solid fa-file-export" />{" "}
              <span>Xuất danh sách</span>
            </button>
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
                {bulkDeleting ? "Đang xóa..." : "Xóa đã chọn"}
              </span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="ct-filters">
          <div className="ct-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo mã, tên, email, số điện thoại, tiêu đề..."
            />
          </div>
          <div className="ct-filter-row">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="ct-table">
          <div className="ct-thead">
            <label className="cell cb">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked;
                }}
                onChange={toggleAll}
              />
            </label>
            <div className="cell code">Mã liên hệ</div>
            <div className="cell name">Tên người gửi</div>
            <div className="cell email">Email</div>
            <div className="cell phone">Số điện thoại</div>
            <div className="cell subject">Tiêu đề</div>
            <div className="cell created">Ngày gửi</div>
            <div className="cell status">Trạng thái</div>
            <div className="cell act">Thao tác</div>
          </div>

          {loading && <div className="ct-empty">Đang tải...</div>}
          {!loading && items.length === 0 && (
            <div className="ct-empty">Chưa có liên hệ nào.</div>
          )}

          {!loading &&
            items.map((it) => (
              <div key={it._id} className="ct-trow">
                <label className="cell cb">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(it._id)}
                    onChange={() => toggleOne(it._id)}
                  />
                </label>

                {/* Mã liên hệ riêng 1 cột */}
                <div className="cell code">{fmtCode(it._id)}</div>

                <div className="cell name">
                  <div className="ct-name-main">
                    {it.name || "—"}
                  </div>
                </div>

                <div className="cell email">{it.email || "—"}</div>
                <div className="cell phone">{it.phone || "—"}</div>
                <div className="cell subject" title={it.subject}>
                  {it.subject || "—"}
                </div>
                <div className="cell created">
                  {fmtDate(it.createdAt)}
                </div>

                <div className="cell status">
                  <select
                    className={`ct-status-select status-${
                      it.status || "new"
                    }`}
                    value={it.status || "new"}
                    disabled={updatingStatusId === it._id}
                    onChange={(e) =>
                      handleStatusChange(it._id, e.target.value)
                    }
                  >
                    <option value="new">Mới</option>
                    <option value="processing">Đang xử lý</option>
                    <option value="done">Đã xong</option>
                  </select>
                </div>

                <div className="cell act">
                  <button
                    className="iconbtn"
                    title="Xem chi tiết"
                    onClick={() => setDetail(it)}
                  >
                    <i className="fa-regular fa-eye" />
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
        <div className="ct-pagination">
          <div className="per-page">
            <span>Hiển thị:</span>
            <select
              value={limit}
              onChange={handleLimitChange}
            >
              <option value="10">10 hàng</option>
              <option value="25">25 hàng</option>
              <option value="50">50 hàng</option>
            </select>
          </div>
          <div className="page-nav">
            <span className="page-info">
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

      {/* Confirm Delete */}
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
                  ? `Xóa ${confirm.ids.length} liên hệ?`
                  : "Xóa liên hệ?"}
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

      {/* Modal xem chi tiết */}
      {detail && (
        <ContactDetailModal
            data={detail}
            onClose={() => setDetail(null)}
            onChangeStatus={(payload) =>
            handleSaveDetail(detail._id, payload) // payload = { status, internalNote }
            }
        />
        )}
    </div>
  );
}
