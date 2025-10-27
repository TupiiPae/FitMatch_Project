// admin-app/src/pagesFoods/Review.jsx
import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { listFoods, approveFood, rejectFood, api } from "../../../lib/api";
import "./Review.css"; // Sẽ dùng file CSS mới

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => { if (!u) return u; try { return new URL(u, API_ORIGIN).toString(); } catch { return u; } };

export default function FoodsReview() {
  // ===== State =====
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(null); // {mode, item?, items?, reason?}

  // Pagination state
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);

  // Selection state
  const [selectedIds, setSelectedIds] = useState([]);
  const allChecked = items.length > 0 && selectedIds.length === items.length;
  const someChecked = selectedIds.length > 0 && selectedIds.length < items.length;

  // ===== Load Data =====
  const load = async () => {
    setLoading(true);
    setSelectedIds([]); // Reset selection
    try {
      const res = await listFoods({ status: "pending", limit, skip });
      setItems(res?.items || []);
      setTotal(res?.total || 0);
    } catch (e) {
      console.error(e);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // Tải lại khi phân trang thay đổi
  useEffect(() => { load(); }, [limit, skip]);

  // ===== Actions =====
  const onApproveAsk = (item) => setConfirm({ mode: "approve", item });
  const onRejectAsk = (item) => setConfirm({ mode: "reject", item, reason: "" });
  const onBulkApproveAsk = () => setConfirm({ mode: "approve-bulk", items: selectedIds });
  const onBulkRejectAsk = () => setConfirm({ mode: "reject-bulk", items: selectedIds, reason: "" });

  // Xử lý xác nhận
  const onConfirm = async () => {
    if (!confirm) return;
    setLoading(true);
    try {
      if (confirm.mode === "approve") {
        await approveFood(confirm.item._id);
      } else if (confirm.mode === "reject") {
        await rejectFood(confirm.item._id, confirm.reason || "");
      } else if (confirm.mode === "approve-bulk") {
        for (const id of confirm.items) {
          try { await approveFood(id); } catch {}
        }
      } else if (confirm.mode === "reject-bulk") {
        for (const id of confirm.items) {
          try { await rejectFood(id, confirm.reason || ""); } catch {}
        }
      }
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "Thao tác thất bại");
    } finally {
      setConfirm(null);
      await load(); // Tải lại danh sách
    }
  };

  // ===== Checkbox Logic =====
  const toggleAll = () => {
    if (allChecked) setSelectedIds([]);
    else setSelectedIds(items.map((x) => x._id));
  };
  const toggleOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // ===== Pagination Logic =====
  const page = Math.floor(skip / limit);
  const pageCount = Math.ceil(total / limit);
  const handleLimitChange = (e) => {
    setLimit(Number(e.target.value));
    setSkip(0); // Reset về trang 1
  };
  const handlePageChange = (newSkip) => {
    if (newSkip >= 0 && newSkip < total) {
      setSkip(newSkip);
    }
  };

  // ===== UI Helpers =====
  const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString() : "—");
  
  // Text cho modal
  const confirmInfo = useMemo(() => {
    if (!confirm) return {};
    const isBulk = confirm.mode.includes("bulk");
    const isApprove = confirm.mode.includes("approve");
    
    return {
      title: isApprove
        ? (isBulk ? "Duyệt hàng loạt" : "Xác nhận duyệt món")
        : (isBulk ? "Từ chối hàng loạt" : "Xác nhận từ chối món"),
      description: isBulk
        ? `Bạn có chắc muốn ${isApprove ? "duyệt" : "từ chối"} ${confirm.items.length} món đã chọn?`
        : `Bạn có chắc muốn ${isApprove ? "duyệt" : "từ chối"} món: ${confirm.item.name}?`,
      showReason: !isApprove, // Hiện lý do khi từ chối (đơn lẻ hoặc hàng loạt)
      btnText: isApprove ? "Duyệt" : "Từ chối",
      btnClass: isApprove ? "ok" : "bad", // Dùng class 'ok' hoặc 'bad' từ CSS
    };
  }, [confirm]);


  return (
    <div className="foods-page"> {/* Dùng class chung của List.css */}
      
      {/* ===== Breadcrumb ===== */}
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

      {/* ===== Card Layout ===== */}
      <div className="card">
        
        {/* ===== Page Head (bên trong card) ===== */}
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

        {/* ===== Table (Dùng layout của List.css) ===== */}
        <div className="table">
          <div className="thead review-thead"> {/* Class mới để custom grid */}
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
            <div className="cell macros">Đạm / Đường bột / Béo</div>
            <div className="cell creator">Người tạo</div>
            <div className="cell email">Email</div>
            <div className="cell created">Thời gian tạo</div>
            <div className="cell status">Trạng thái</div>
            <div className="cell act">Thao tác</div>
          </div>

          {loading && <div className="empty">Đang tải danh sách...</div>}
          {!loading && items.length === 0 && <div className="empty">Không có món ăn nào chờ duyệt.</div>}

          {!loading && items.map((it) => (
            <div key={it._id} className="trow review-trow"> {/* Class mới để custom grid */}
              <label className="cell cb">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(it._id)}
                  onChange={() => toggleOne(it._id)}
                  aria-label={`Chọn ${it.name}`}
                />
              </label>

              <div className="cell img">
                {it.imageUrl
                  ? (
                    <img
                      src={toAbs(it.imageUrl)}
                      alt={it.name}
                      onError={(e) => { e.currentTarget.src = "/images/food-placeholder.jpg"; }}
                    />
                  )
                  : <div className="img-fallback"><i className="fa-regular fa-image"></i></div>}
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
                <span className="status-badge is-pending">Chờ duyệt</span>
              </div>

              <div className="cell act">
                {/* Nút nhỏ, dùng class btn-sm mới */}
                <button className="btn-sm ok" title="Duyệt" onClick={() => onApproveAsk(it)}>
                  <i className="fa-regular fa-circle-check"></i> <span>Duyệt</span>
                </button>
                <button className="btn-sm bad" title="Từ chối" onClick={() => onRejectAsk(it)}>
                  <i className="fa-regular fa-circle-xmark"></i> <span>Từ chối</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ===== (MỚI) Pagination Controls ===== */}
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

      {/* ===== (GIỮ LẠI) Confirm Modal (Dùng modal của List.css) ===== */}
      {confirm && (
      <div
        className="cm-backdrop"
        role="presentation"
        onClick={() => setConfirm(null)}
      >
        <div
          className={`cm-modal ${confirmInfo.btnClass === 'ok' ? 'is-approve' : 'is-reject'}`}
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
                 : <i className="fa-regular fa-circle-xmark"></i>
               }
             </div>
            <h1 id="cm-title" className="cm-title">{confirmInfo.title}</h1>
          </div>

          <div id="cm-desc" className="cm-body">
            {confirmInfo.description}
            
            {confirmInfo.showReason && (
              <div className="cr-reason"> {/* Dùng class cũ cr-reason cho tiện */}
                <label className="cr-label">Lý do (tùy chọn)</label>
                <textarea
                  className="cr-textarea"
                  rows={3}
                  value={confirm.reason}
                  onChange={(e)=>setConfirm(s=>({...s, reason: e.target.value}))}
                  placeholder="Ví dụ: Thông tin dinh dưỡng chưa rõ ràng…"
                />
              </div>
            )}
          </div>

          <div className="cm-foot">
            <button className="btn ghost" onClick={() => setConfirm(null)}>Hủy</button>
            <button
              className={`btn ${confirmInfo.btnClass}`} // Dùng 'ok' hoặc 'bad'
              onClick={onConfirm}
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