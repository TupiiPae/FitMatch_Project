// admin-app/src/pagesFoods/Review.jsx
import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { listFoodsAdminOnly, approveFood, rejectFood, api } from "../../../lib/api";
import "./Review.css";
import { toast } from "react-toastify";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => { if (!u) return u; try { return new URL(u, API_ORIGIN).toString(); } catch { return u; } };

export default function FoodsReview() {
  // --- state ---
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(null); // {mode, item|items, reason?}
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);

  const allChecked  = items.length > 0 && selectedIds.length === items.length;
  const someChecked = selectedIds.length > 0 && selectedIds.length < items.length;

  // --- load only PENDING ---
  const load = async () => {
    setLoading(true);
    setSelectedIds([]);
    try {
      const res = await listFoodsAdminOnly({ status: "pending", origin: "user", limit, skip });
      
      // Lọc an toàn để CHẮC CHẮN chỉ còn pending (phòng khi public API trả khác)
      const onlyPending = (res?.items || []).filter((x) => x?.status === "pending");
      setItems(onlyPending);
      // Nếu total từ BE không đáng tin (do lọc client), có thể dùng length
      setTotal(res?.total ?? onlyPending.length);
    } catch (e) {
      console.error(e);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [limit, skip]);

  // --- actions ---
  const onApproveAsk      = (item) => setConfirm({ mode: "approve", item });
  const onRejectAsk       = (item) => setConfirm({ mode: "reject", item, reason: "" });
  const onBulkApproveAsk  = () => setConfirm({ mode: "approve-bulk", items: selectedIds });
  const onBulkRejectAsk   = () => setConfirm({ mode: "reject-bulk",  items: selectedIds, reason: "" });
  const reasonTooLong = (confirm?.reason || "").length > 500;
  const reasonEmpty   = !((confirm?.reason || "").trim().length);

  const onConfirm = async () => {
    if (confirm.mode.includes("reject")) {
      if (reasonEmpty) { toast.error("Vui lòng nhập lý do từ chối"); return; }
      if (reasonTooLong) { toast.error("Lý do tối đa 500 ký tự"); return; }
    }
    if (!confirm) return;
    setLoading(true);
    try {
      if (confirm.mode === "approve") {
        await approveFood(confirm.item._id);
        toast.success("Duyệt món ăn thành công");
      } else if (confirm.mode === "reject") {
        await rejectFood(confirm.item._id, (confirm.reason || "").trim());
        toast.success("Từ chối món ăn thành công");
      } else if (confirm.mode === "approve-bulk") {
        for (const id of confirm.items) { try { await approveFood(id); } catch {} }
        toast.success(`Đã duyệt ${confirm.items.length} món`);
      } else if (confirm.mode === "reject-bulk") {
        for (const id of confirm.items) {
          try { await rejectFood(id, (confirm.reason || "").trim()); } catch {}
        }
        toast.success(`Đã từ chối ${confirm.items.length} món`);
      }
    } catch (e) {
      const msg = e?.response?.data?.message || "Thao tác thất bại";
      toast.error(msg); // Lỗi vẫn đỏ để dễ phân biệt
      console.error(e);
    } finally {
      setConfirm(null);
      await load();
      setLoading(false);
    }
  };

  // --- selection ---
  const toggleAll = () => {
    if (allChecked) setSelectedIds([]);
    else setSelectedIds(items.map((x) => x._id));
  };
  const toggleOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // --- paging ---
  const page = Math.floor(skip / limit);
  const pageCount = Math.ceil((total || 0) / limit);
  const handleLimitChange = (e) => { setLimit(Number(e.target.value)); setSkip(0); };
  const handlePageChange  = (newSkip) => { if (newSkip >= 0 && newSkip < total) setSkip(newSkip); };

  const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");

  const confirmInfo = useMemo(() => {
    if (!confirm) return {};
    const isBulk    = confirm.mode.includes("bulk");
    const isApprove = confirm.mode.includes("approve");
    return {
      title: isApprove
        ? (isBulk ? "Duyệt hàng loạt" : "Xác nhận duyệt món")
        : (isBulk ? "Từ chối hàng loạt" : "Xác nhận từ chối món"),
      description: isBulk
        ? `Bạn có chắc muốn ${isApprove ? "duyệt" : "từ chối"} ${confirm.items.length} món đã chọn?`
        : `Bạn có chắc muốn ${isApprove ? "duyệt" : "từ chối"} món: ${confirm.item.name}?`,
      showReason: !isApprove,
      btnText: isApprove ? "Duyệt" : "Từ chối",
      btnClass: isApprove ? "ok" : "bad",
    };
  }, [confirm]);

  return (
    <div className="foods-page food-review-page">
      {/* Breadcrumb */}
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
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
        <span className="current-page">Duyệt món ăn</span>
      </nav>

      {/* Card */}
      <div className="card">
        <div className="page-head">
          <h2>Duyệt món ăn ({total} món chờ)</h2>
          <div className="head-actions">
            <button className="btn ok-ghost" onClick={onBulkApproveAsk} disabled={selectedIds.length === 0}>
              <i className="fa-regular fa-circle-check" /> <span>Duyệt đã chọn</span>
            </button>
            <button className="btn danger" onClick={onBulkRejectAsk} disabled={selectedIds.length === 0}>
              <i className="fa-regular fa-circle-xmark" /> <span>Từ chối đã chọn</span>
            </button>
            <button className="btn ghost" onClick={load} disabled={loading}>
              <i className="fa-solid fa-arrows-rotate" /> <span>{loading ? "Đang tải..." : "Tải lại"}</span>
            </button>
          </div>
        </div>

        <div className="table">
          <div className="thead review-thead">
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
            <div className="cell name">Tên món ăn</div>
            <div className="cell kcal">Calo</div>
            <div className="cell macrosR">Đạm / Đường bột / Chất Béo</div>
            <div className="cell creator">Người tạo</div>
            <div className="cell email">Email</div>
            <div className="cell created">Thời gian tạo</div>
            <div className="cell status">Trạng thái</div>
            <div className="cell act">Thao tác</div>
          </div>

          {loading && <div className="empty">Đang tải danh sách...</div>}
          {!loading && items.length === 0 && <div className="empty">Không có món ăn nào chờ duyệt.</div>}

          {!loading && items.map((it) => (
            <div key={it._id} className="trow review-trow">
              <label className="cell cb">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(it._id)}
                  onChange={() => toggleOne(it._id)}
                  aria-label={`Chọn ${it.name}`}
                />
              </label>

              <div className="cell img">
                {it.imageUrl ? (
                  <img
                    src={toAbs(it.imageUrl)}
                    alt={it.name}
                    onError={(e) => { e.currentTarget.src = "/images/food-placeholder.jpg"; }}
                  />
                ) : (
                  <div className="img-fallback"><i className="fa-regular fa-image"></i></div>
                )}
              </div>

              <div className="cell name">
                <div className="title">{it.name || "—"}</div>
                <div className="sub">#{String(it._id).slice(-6)}</div>
              </div>

              <div className="cell kcal">{it.kcal ?? "—"}</div>

              <div className="cell macros">
                <span className="chip p">{it.proteinG ?? 0}g</span>
                <span className="chip c">{it.carbG ?? 0}g</span>
                <span className="chip f">{it.fatG ?? 0}g</span>
              </div>

              <div className="cell creator">{it.createdBy?.profile?.nickname || it.createdBy?.username || "N/A"}</div>
              <div className="cell email">{it.createdBy?.email || "N/A"}</div>
              <div className="cell created">{fmtTime(it.createdAt)}</div>

              <div className="cell status">
                {/* Chỉ pending được đưa vào table, nên badge cố định */}
                <span className="status-badge is-pending">Chờ duyệt</span>
              </div>

              <div className="cell act">
                <button className="btn-sm ok"  title="Duyệt"   onClick={() => onApproveAsk(it)}>
                  <i className="fa-regular fa-circle-check"></i> <span>Duyệt</span>
                </button>
                <button className="btn-sm bad" title="Từ chối" onClick={() => onRejectAsk(it)}>
                  <i className="fa-regular fa-circle-xmark"></i> <span>Từ chối</span>
                </button>
              </div>
            </div>
          ))}
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
              Trang {page + 1} / {pageCount > 0 ? pageCount : 1} (Tổng: {total})
            </span>
            <button className="btn-page" onClick={() => handlePageChange(skip - limit)} disabled={skip === 0}>
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button className="btn-page" onClick={() => handlePageChange(skip + limit)} disabled={skip + limit >= total}>
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      {confirm && (
        <div className="cm-backdrop" role="presentation" onClick={() => setConfirm(null)}>
          <div
            className={`cm-modal ${confirmInfo.btnClass === "ok" ? "is-approve" : "is-reject"}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cm-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cm-head">
              <div className="cm-icon" aria-hidden="true">
                {confirmInfo.btnClass === "ok"
                  ? <i className="fa-regular fa-circle-check"></i>
                  : <i className="fa-regular fa-circle-xmark"></i>}
              </div>
              <h1 id="cm-title" className="cm-title">{confirmInfo.title}</h1>
            </div>
            <div id="cm-desc" className="cm-body">
              {confirmInfo.description}
              {confirmInfo.showReason && (
                <div className="cr-reason">
                  <label className="cr-label">Lý do từ chối <span className="req">*</span></label>
                  <textarea
                    className="cr-textarea"
                    rows={3}
                    value={confirm.reason}
                    onChange={(e)=>setConfirm(s=>({...s, reason: e.target.value}))}
                    placeholder="Ví dụ: Thông tin dinh dưỡng chưa rõ ràng…"
                  />
                  <div className="cr-hint">
                    <span>{(confirm?.reason || "").length}/500</span>
                    {reasonTooLong && <span className="cr-err">Tối đa 500 ký tự</span>}
                    {reasonEmpty && <span className="cr-err"> Bắt buộc nhập lý do</span>}
                  </div>
                </div>
              )}
            </div>
            <div className="cm-foot">
              <button className="btn ghost" onClick={() => setConfirm(null)}>Hủy</button>
              <button
                className={`btn ${confirmInfo.btnClass}`}
                onClick={onConfirm}
                disabled={confirmInfo.showReason && (reasonEmpty || reasonTooLong)}
              >
                {confirmInfo.btnText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
