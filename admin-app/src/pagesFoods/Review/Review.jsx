// src/pages/Admin/Foods/Review.jsx
import React, { useEffect, useState } from "react";
import { listFoods, approveFood, rejectFood, api } from "../../lib/api"; // <- dùng named import cho api
import "./Review.css";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => { if (!u) return u; try { return new URL(u, API_ORIGIN).toString(); } catch { return u; } };

export default function FoodsReview() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [confirm, setConfirm] = useState(null); // {mode:'approve'|'reject', item, reason?}

  const load = async () => {
    setLoading(true);
    try {
      const res = await listFoods({ status: "pending", limit: 100, skip: 0 });
      const list = (res?.items || []).map((it) => ({
        ...it,
        imageAbs: it.imageUrl ? toAbs(it.imageUrl) : "/images/food-placeholder.jpg",
      }));
      setItems(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onApproveAsk = (item) => setConfirm({ mode: "approve", item });
  const onRejectAsk  = (item) => setConfirm({ mode: "reject", item, reason: "" });

  const onConfirm = async () => {
    if (!confirm) return;
    try {
      if (confirm.mode === "approve") await approveFood(confirm.item._id);
      else await rejectFood(confirm.item._id, confirm.reason || "");
      setConfirm(null);
      setDetail(null);
      await load();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "Thao tác thất bại");
    }
  };

  const fmtTime = (iso) => {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleString();
  };

  return (
    <div className="fr-wrap">
      <div className="fr-head">
        <h2>Duyệt món người dùng</h2>
        <button className="btn light" onClick={load} disabled={loading}>
          {loading ? "Đang tải..." : "Tải lại"}
        </button>
      </div>

      {/* BẢNG DANH SÁCH (có kéo ngang khi tràn) */}
      <div className="fr-table-wrap">
        {items.length === 0 ? (
          <div className="muted">{loading ? "Đang tải..." : "Không có món pending"}</div>
        ) : (
          <table className="fr-table">
            <thead>
              <tr>
                <th style={{minWidth:120}}>Hình ảnh</th>
                <th style={{minWidth:220}}>Tên món</th>
                <th style={{minWidth:160}}>Khẩu phần</th>
                <th style={{minWidth:160}}>Người tạo</th>
                <th style={{minWidth:240}}>Email</th>
                <th style={{minWidth:180}}>Thời gian tạo</th>
                <th style={{minWidth:180}}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it._id} className="fr-row" onClick={() => setDetail(it)}>
                  <td>
                    <div className="fr-thumb">
                      <img
                        src={it.imageAbs}
                        alt={it.name}
                        onClick={(e)=>e.stopPropagation()}
                      />
                    </div>
                  </td>
                  <td className="fr-cell-name">
                    <div className="fr-name">{it.name}</div>
                  </td>
                  <td className="fr-cell-portion">
                    {(it.portionName || "Khẩu phần tiêu chuẩn")} · {(it.massG ?? "-")} {(it.unit || "g")}
                  </td>
                  <td className="fr-cell-user">
                    {it.createdBy?.profile?.nickname || it.createdBy?.username || "User"}
                  </td>
                  <td className="fr-cell-mail">
                    <a
                      href={`mailto:${it.createdBy?.email || ""}`}
                      onClick={(e)=> e.stopPropagation()}
                      title={it.createdBy?.email || "-"}
                    >
                      {it.createdBy?.email || "-"}
                    </a>
                  </td>
                  <td className="fr-cell-time">{fmtTime(it.createdAt)}</td>
                  <td className="fr-cell-actions" onClick={(e)=> e.stopPropagation()}>
                    <button className="btn ok"  onClick={() => onApproveAsk(it)}>Duyệt</button>
                    <button className="btn bad" onClick={() => onRejectAsk(it)}>Từ chối</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Popup chi tiết */}
      {detail && (
        <div className="modal" onClick={()=>setDetail(null)}>
          <div className="modal-box" onClick={(e)=>e.stopPropagation()}>
            <div className="modal-head">
              <h3>{detail.name}</h3>
              <button className="btn ghost" onClick={()=>setDetail(null)}>Đóng</button>
            </div>
            <div className="modal-body">
              <div className="md-left">
                <img src={detail.imageUrl ? toAbs(detail.imageUrl) : "/images/food-placeholder.jpg"} alt={detail.name} />
              </div>
              <div className="md-right">
                <div className="md-row"><b>Người tạo:</b> {detail.createdBy?.profile?.nickname || detail.createdBy?.username || "-"}</div>
                <div className="md-row"><b>Email:</b> {detail.createdBy?.email || "-"}</div>
                <div className="md-row"><b>Thời gian tạo:</b> {fmtTime(detail.createdAt)}</div>
                <div className="md-row"><b>Khối lượng:</b> {detail.massG}{detail.unit || "g"}</div>
                <div className="md-row"><b>Khẩu phần:</b> {detail.portionName || "-"}</div>
                <div className="md-row"><b>Nguồn:</b> {detail.sourceType || "-"}</div>
                <div className="md-row split">
                  <div><b>Calo:</b> {detail.kcal ?? "-"}</div>
                  <div><b>Đạm:</b> {detail.proteinG ?? "-"}</div>
                  <div><b>Carb:</b> {detail.carbG ?? "-"}</div>
                  <div><b>Béo:</b> {detail.fatG ?? "-"}</div>
                </div>
                <div className="md-row split">
                  <div><b>Muối:</b> {detail.saltG ?? "-"}</div>
                  <div><b>Đường:</b> {detail.sugarG ?? "-"}</div>
                  <div><b>Xơ:</b> {detail.fiberG ?? "-"}</div>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn ok" onClick={()=>onApproveAsk(detail)}>Duyệt</button>
              <button className="btn bad" onClick={()=>onRejectAsk(detail)}>Từ chối</button>
            </div>
          </div>
        </div>
      )}

      {/* Popup xác nhận */}
      {confirm && (
      <div
        className="cr-backdrop"
        role="presentation"
        onClick={() => setConfirm(null)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setConfirm(null);
          if (e.key === "Enter") onConfirm();
        }}
      >
        <div
          className={`cr-modal ${confirm.mode === "approve" ? "is-approve" : "is-reject"}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cr-title"
          aria-describedby="cr-desc"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="cr-head">
            <div className="cr-icon" aria-hidden="true">
              {confirm.mode === "approve"
                ? <i className="fa-regular fa-circle-check"></i>
                : <i className="fa-regular fa-circle-xmark"></i>
              }
            </div>
            <h3 id="cr-title" className="cr-title">
              {confirm.mode === "approve" ? "Xác nhận duyệt món" : "Xác nhận từ chối món"}
            </h3>
          </div>

          <div id="cr-desc" className="cr-body">
            <div className="cr-line">
              Món: <b>{confirm.item?.name}</b>
            </div>
            {confirm.mode === "reject" && (
              <div className="cr-reason">
                <label className="cr-label">Lý do từ chối (tùy chọn)</label>
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

          <div className="cr-foot">
            <button type="button" className="btn ghost" onClick={() => setConfirm(null)}>
              Hủy
            </button>
            <button
              type="button"
              className={`btn ${confirm.mode === "approve" ? "ok" : "bad"}`}
              onClick={onConfirm}
            >
              {confirm.mode === "approve" ? "Duyệt" : "Từ chối"}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
