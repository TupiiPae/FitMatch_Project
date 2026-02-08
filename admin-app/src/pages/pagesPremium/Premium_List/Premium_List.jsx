// admin-app/src/pages/pagesPremium/Premium_List/Premium_List.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  listPremiumUsersAdmin,
  listPremiumTransactionsAdmin,
  revokePremiumAdmin,
} from "../../../lib/api.js";
import "./Premium_List.css";

const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "—");
const fmtMoney = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("vi-VN");
};
const daysLeft = (expiresAt) => {
  if (!expiresAt) return null;
  const t = new Date(expiresAt).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = t - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
};

function ConfirmRevokeModal({ open, onClose, onSubmit, user, loading }) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) setReason("");
  }, [open]);
  if (!open) return null;

  const name = user?.profile?.nickname || user?.username || user?.email || "Người dùng";
  return (
    <div
      className="cm-backdrop"
      onMouseDown={(e) => e.target.classList.contains("cm-backdrop") && onClose()}
    >
      <div className="cm-modal" role="dialog" aria-modal="true">
        <div className="cm-head">
          <h3 className="cm-title">
            <i className="fa-solid fa-ban" /> Hủy Premium
          </h3>
        </div>
        <div className="cm-body">
          <p style={{ marginTop: 0 }}>
            Bạn chắc chắn muốn hủy Premium của <b>{name}</b>?
          </p>

          <label className="fc-field" style={{ width: "100%", marginTop: 10 }}>
            <span className="fc-label">Lý do (tuỳ chọn)</span>
            <textarea
              className="auth-input"
              rows={4}
              placeholder="Nhập lý do (nếu có)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          </label>
        </div>
        <div className="cm-foot">
          <button type="button" className="btn ghost" onClick={onClose} disabled={loading}>
            Hủy
          </button>
          <button
            type="button"
            className={`btn danger ${loading ? "loading" : ""}`}
            onClick={() => onSubmit(reason.trim())}
            disabled={loading}
          >
            <i className="fa-solid fa-ban" /> <span>Hủy Premium</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function TxModal({
  open,
  onClose,
  user,
  loading,
  items,
  summary,
  status,
  setStatus,
  q,
  setQ,
  page,
  pages,
  total,
  setPage,
}) {
  if (!open) return null;

  const name = user?.profile?.nickname || user?.username || user?.email || "Người dùng";
  const email = user?.email || "—";

  const stLabel = (s) => {
    const x = String(s || "").toUpperCase();
    if (x === "PAID") return "Đã thanh toán";
    if (x === "PENDING") return "Chờ thanh toán";
    if (x === "CANCELLED") return "Đã hủy";
    return x || "—";
  };

  return (
    <div
      className="cm-backdrop"
      onMouseDown={(e) => e.target.classList.contains("cm-backdrop") && onClose()}
    >
      <div className="cm-modal tx-modal" role="dialog" aria-modal="true">
        <div className="tx-head">
          <div className="tx-user">
            <div className="tx-ico">
              <i className="fa-solid fa-receipt" />
            </div>
            <div className="tx-meta">
              <div className="tx-name">{name}</div>
              <div className="tx-sub">{email}</div>
            </div>
          </div>
          <button className="btn-close" type="button" title="Đóng" onClick={onClose}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="tx-summary">
          <div className="tx-chip">
            <b>Tổng giao dịch:</b> {summary?.totalTx ?? 0}
          </div>
          <div className="tx-chip ok">
            <b>Đã thanh toán:</b> {summary?.paidCount ?? 0}
          </div>
          <div className="tx-chip">
            <b>Tổng tiền:</b> {fmtMoney(summary?.paidAmount)} đ
          </div>
          {summary?.lastPaidAt && (
            <div className="tx-chip">
              <b>Thanh toán gần nhất:</b> {fmtDate(summary.lastPaidAt)}
            </div>
          )}
        </div>

        <div className="tx-filters">
          <div className="seg">
            <button
              type="button"
              className={`seg-btn ${status === "all" ? "is-active" : ""}`}
              onClick={() => {
                setStatus("all");
                setPage(1);
              }}
            >
              Tất cả
            </button>
            <button
              type="button"
              className={`seg-btn ${status === "PAID" ? "is-active" : ""}`}
              onClick={() => {
                setStatus("PAID");
                setPage(1);
              }}
            >
              PAID
            </button>
            <button
              type="button"
              className={`seg-btn ${status === "PENDING" ? "is-active" : ""}`}
              onClick={() => {
                setStatus("PENDING");
                setPage(1);
              }}
            >
              PENDING
            </button>
            <button
              type="button"
              className={`seg-btn ${status === "CANCELLED" ? "is-active" : ""}`}
              onClick={() => {
                setStatus("CANCELLED");
                setPage(1);
              }}
            >
              CANCELLED
            </button>
          </div>

          <div className="tx-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm orderCode / planCode / status..."
            />
          </div>
        </div>

        <div className="tx-body">
          {loading && <div className="empty">Đang tải giao dịch...</div>}
          {!loading && (!Array.isArray(items) || items.length === 0) && (
            <div className="empty">Không có giao dịch nào.</div>
          )}

          {!loading &&
            Array.isArray(items) &&
            items.map((t) => (
              <div key={t._id} className="tx-item">
                <div className="tx-row">
                  <div className="tx-left">
                    <div className="tx-line1">
                      <span className={`tx-status ${String(t.status || "").toLowerCase()}`}>
                        {stLabel(t.status)}
                      </span>
                      <span className="tx-time">{fmtDate(t.createdAt)}</span>
                      <span className="tx-oc">OrderCode: <b>{t.orderCode}</b></span>
                    </div>
                    <div className="tx-line2">
                      <span className="tx-tag">{t.planCode}</span>
                      <span className="tx-tag">{t.months} tháng</span>
                      <span className="tx-amount">{fmtMoney(t.amount)} đ</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>

        <div className="tx-foot">
          <div className="tx-pageinfo">
            Trang {page} / {pages} (Tổng: {total || 0})
          </div>
          <div className="tx-pagenav">
            <button
              className="btn-page"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <i className="fa-solid fa-chevron-left" />
            </button>
            <button
              className="btn-page"
              onClick={() => setPage((p) => Math.min(pages || 1, p + 1))}
              disabled={page >= (pages || 1)}
            >
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Premium_List() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("active"); // active|expired|all

  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({ all: 0, active: 0, expired: 0 });

  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);

  const [revokeOpen, setRevokeOpen] = useState(false);
  const [revokeUser, setRevokeUser] = useState(null);
  const [revokeLoading, setRevokeLoading] = useState(false);

  const [txOpen, setTxOpen] = useState(false);
  const [txUser, setTxUser] = useState(null);
  const [txLoading, setTxLoading] = useState(false);
  const [txItems, setTxItems] = useState([]);
  const [txSummary, setTxSummary] = useState(null);
  const [txStatus, setTxStatus] = useState("all");
  const [txQ, setTxQ] = useState("");
  const [txPage, setTxPage] = useState(1);
  const [txPages, setTxPages] = useState(1);
  const [txTotal, setTxTotal] = useState(0);

  const txReqRef = useRef(0);

  const load = async () => {
    setLoading(true);
    try {
      const res = await listPremiumUsersAdmin({
        q,
        status: statusFilter,
        limit,
        skip,
      });
      setItems(res?.items || []);
      setTotal(Number(res?.total || 0));
      setCounts(res?.counts || { all: 0, active: 0, expired: 0 });
    } catch (e) {
      setItems([]);
      setTotal(0);
      toast.error(e?.response?.data?.message || "Không tải được danh sách Premium.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [limit, skip, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (skip !== 0) setSkip(0);
      else load();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q]);

  const page = Math.floor(skip / limit);
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const openRevoke = (u) => {
    setRevokeUser(u);
    setRevokeOpen(true);
  };

  const submitRevoke = async (reason) => {
    if (!revokeUser?._id) return;
    setRevokeLoading(true);
    try {
      await revokePremiumAdmin(revokeUser._id, reason || "");
      toast.success("Đã hủy Premium.");
      setRevokeOpen(false);
      setRevokeUser(null);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Hủy Premium thất bại.");
    } finally {
      setRevokeLoading(false);
    }
  };

  const openTx = (u) => {
    txReqRef.current += 1;
    setTxUser(u);
    setTxOpen(true);

    setTxLoading(true);
    setTxItems([]);
    setTxSummary(null);
    setTxTotal(0);
    setTxPages(1);
    setTxStatus("all");
    setTxQ("");
    setTxPage(1);
  };

  const loadTx = async () => {
    if (!txOpen || !txUser?._id) return;
    const req = ++txReqRef.current;

    setTxLoading(true);
    try {
      const res = await listPremiumTransactionsAdmin(txUser._id, {
        status: txStatus,
        q: txQ.trim(),
        limit: 10,
        skip: (txPage - 1) * 10,
      });

      if (req !== txReqRef.current) return;

      setTxItems(res?.items || []);
      setTxSummary(res?.summary || null);
      setTxTotal(Number(res?.total || 0));
      setTxPages(res?.pages || Math.max(1, Math.ceil((Number(res?.total || 0) || 0) / 10)));
    } catch (e) {
      if (req !== txReqRef.current) return;
      setTxItems([]);
      setTxSummary(null);
      setTxTotal(0);
      setTxPages(1);
      toast.error(e?.response?.data?.message || "Không tải được lịch sử giao dịch.");
    } finally {
      if (req === txReqRef.current) setTxLoading(false);
    }
  };

  useEffect(() => {
    loadTx();
    // eslint-disable-next-line
  }, [txOpen, txUser?._id, txStatus, txPage]);

  useEffect(() => {
    if (!txOpen) return;
    const t = setTimeout(() => {
      if (txPage !== 1) setTxPage(1);
      else loadTx();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [txQ]);

  const handleLimitChange = (e) => {
    setLimit(Number(e.target.value));
    setSkip(0);
  };
  const handlePageChange = (newSkip) => {
    if (newSkip >= 0 && newSkip < total) setSkip(newSkip);
  };

  const statusBadge = (u) => {
    const exp = u?.premium?.expiresAt;
    const d = daysLeft(exp);
    const active = typeof d === "number" ? d > 0 : false;
    if (active) return <span className="status-badge is-active">Đang Premium</span>;
    return <span className="status-badge is-expired">Hết hạn</span>;
  };

  return (
    <div className="foods-page premium-list-page">
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/"><i className="fa-solid fa-house" /><span>Trang chủ</span></Link>
        <span className="separator">/</span>
        <span className="current-group"><i className="fa-solid fa-crown" /><span>Premium</span></span>
        <span className="separator">/</span>
        <span className="current-page">Danh sách người dùng Premium</span>
      </nav>

      <div className="card">
        <div className="page-head">
          <h2>
            Người dùng Premium ({total})
            <span className="mini-stats">
              <span className="ms-chip">Tổng Premium: <b>{counts?.all ?? 0}</b></span>
              <span className="ms-chip ok">Đang hoạt động: <b>{counts?.active ?? 0}</b></span>
              <span className="ms-chip warn">Hết hạn: <b>{counts?.expired ?? 0}</b></span>
            </span>
          </h2>
        </div>

        <div className="card-head">
          <div className="search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo nickname, username, email, SĐT…" />
          </div>

          <div className="filters">
            <div className="filter-row">
              <span className="hint">Trạng thái:</span>
              <div className="seg">
                <button type="button" className={`seg-btn ${statusFilter === "active" ? "is-active" : ""}`} onClick={() => setStatusFilter("active")}>Đang Premium</button>
                <button type="button" className={`seg-btn ${statusFilter === "expired" ? "is-active" : ""}`} onClick={() => setStatusFilter("expired")}>Hết hạn</button>
                <button type="button" className={`seg-btn ${statusFilter === "all" ? "is-active" : ""}`} onClick={() => setStatusFilter("all")}>Tất cả Premium</button>
              </div>
            </div>
          </div>
        </div>

        <div className="table">
          <div className="thead">
            <div className="cell name">Người dùng</div>
            <div className="cell email">Email</div>
            {/* <div className="cell plan">Gói</div> */}
            <div className="cell provider">Provider</div>
            <div className="cell started">Bắt đầu</div>
            <div className="cell expires">Hết hạn</div>
            <div className="cell status">Trạng thái</div>
            <div className="cell lastpay">Thanh toán gần nhất</div>
            <div className="cell act">Thao tác</div>
          </div>

          {loading && <div className="empty">Đang tải...</div>}
          {!loading && items.length === 0 && <div className="empty">Không có dữ liệu.</div>}

          {!loading && items.map((u) => {
            const name = u?.profile?.nickname || u?.username || "—";
            const exp = u?.premium?.expiresAt;
            const d = daysLeft(exp);
            const dText = typeof d === "number"
              ? (d > 0 ? `Còn ${d} ngày` : `Quá hạn ${Math.abs(d)} ngày`)
              : "—";

            const lt = u?.lastTransaction;
            const lastPayText = lt
              ? `${fmtMoney(lt.lastAmount)}đ • ${lt.lastPaidAt ? fmtDate(lt.lastPaidAt) : fmtDate(lt.lastCreatedAt)} • ${String(lt.lastStatus || "").toUpperCase()}`
              : "—";

            return (
              <div key={u._id} className="trow">
                <div className="cell name">
                  <div className="title">{name}</div>
                  <div className="sub">#{String(u._id).slice(-6)}</div>
                </div>

                <div className="cell email">{u?.email || "—"}</div>
                {/* <div className="cell plan">{u?.premium?.months ? `${u.premium.months} tháng` : "—"}</div> */}
                <div className="cell provider">{u?.premium?.provider || "—"}</div>
                <div className="cell started">{fmtDate(u?.premium?.startedAt)}</div>

                <div className="cell expires">
                  <div className="title">{fmtDate(exp)}</div>
                  <div className="sub">{dText}</div>
                </div>

                <div className="cell status">{statusBadge(u)}</div>

                <div className="cell lastpay" title={lastPayText}>{lastPayText}</div>

                <div className="cell act">
                  <button className="iconbtn" type="button" title="Xem giao dịch" onClick={() => openTx(u)}>
                    <i className="fa-solid fa-receipt" />
                  </button>

                  <button
                    className="iconbtn danger"
                    type="button"
                    title="Hủy Premium"
                    onClick={() => openRevoke(u)}
                  >
                    <i className="fa-solid fa-ban" />
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
            <button className="btn-page" onClick={() => handlePageChange(skip - limit)} disabled={skip === 0} aria-label="Trang trước">
              <i className="fa-solid fa-chevron-left" />
            </button>
            <button className="btn-page" onClick={() => handlePageChange(skip + limit)} disabled={skip + limit >= total} aria-label="Trang sau">
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        </div>
      </div>

      <ConfirmRevokeModal
        open={revokeOpen}
        onClose={() => !revokeLoading && setRevokeOpen(false)}
        onSubmit={submitRevoke}
        user={revokeUser}
        loading={revokeLoading}
      />

      <TxModal
        open={txOpen}
        onClose={() => {
          txReqRef.current += 1;
          setTxOpen(false);
          setTxUser(null);
          setTxItems([]);
          setTxSummary(null);
          setTxTotal(0);
          setTxPages(1);
        }}
        user={txUser}
        loading={txLoading}
        items={txItems}
        summary={txSummary}
        status={txStatus}
        setStatus={setTxStatus}
        q={txQ}
        setQ={setTxQ}
        page={txPage}
        pages={txPages}
        total={txTotal}
        setPage={setTxPage}
      />
    </div>
  );
}
