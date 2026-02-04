import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

import "../../pagesContact/Contact_List.css";
import "./Premium_Config.css";

import {
  listPremiumPlansAdmin,
  createPremiumPlanAdmin,
  updatePremiumPlanAdmin,
  deletePremiumPlanAdmin,
} from "../../../lib/api";

import PremiumPlanModal from "./PremiumPlanModal.jsx";

const STATUS_FILTERS = [
  { value: "active", label: "Hoạt động" },
  { value: "inactive", label: "Không hoạt động" },
  { value: "all", label: "Tất cả trạng thái" },
];

// helper nhỏ đặt gần đầu file
const unwrapDoc = (v) => v?.data ?? v;

const doToggle = async (it, nextActive) => {
  setProcessingId(it._id);
  try {
    const savedRaw = await updatePremiumPlanAdmin(it._id, { isActive: nextActive });
    const saved = unwrapDoc(savedRaw);

    setItems((prev) => prev.map((x) => (x._id === it._id ? { ...x, ...saved } : x)));
    toast.success("Cập nhật trạng thái gói Premium thành công");
  } catch (err) {
    console.error(err);
    toast.error(err?.response?.data?.message || "Không thể cập nhật trạng thái gói");
  } finally {
    setProcessingId(null);
  }
};

const handleSubmit = async (form, id) => {
  try {
    let savedRaw;
    if (id) {
      savedRaw = await updatePremiumPlanAdmin(id, form);
      const saved = unwrapDoc(savedRaw);

      toast.success("Cập nhật gói Premium thành công");
      setItems((prev) => prev.map((x) => (x._id === id ? { ...x, ...saved } : x)));
    } else {
      savedRaw = await createPremiumPlanAdmin(form);
      const saved = unwrapDoc(savedRaw);

      toast.success("Tạo gói Premium thành công");
      setItems((prev) => [saved, ...(prev || [])]);
      setTotal((t) => (t || 0) + 1);
    }

    loadPlans().catch(() => {});
    return true;
  } catch (err) {
    console.error(err);
    toast.error(err?.response?.data?.message || "Lưu gói Premium thất bại");
    throw err;
  }
};

const MONTHS_OPTIONS = [1, 3, 6, 12];

const fmtCode = (id) => (!id ? "—" : `#${String(id).slice(-6)}`);

const fmtMoney = (v, currency = "VND") => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (String(currency).toUpperCase() === "VND") return `${n.toLocaleString("vi-VN")} ₫`;
  return `${n.toLocaleString("vi-VN")} ${currency}`;
};

export default function Premium_Config() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(false);

  const [modal, setModal] = useState(null); // { initial } | null
  const [confirm, setConfirm] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const page = Math.floor(skip / limit);
  const pageCount = Math.max(1, Math.ceil((total || 0) / limit));

  const loadPlans = async () => {
    setLoading(true);
    try {
        const params = { limit, skip };
        const qTrim = (q || "").trim();
        if (qTrim) params.q = qTrim;

        // map FE status -> BE active
        if (status === "active") params.active = "true";
        else if (status === "inactive") params.active = "false";
        // status === "all" => không set gì

        const res = await listPremiumPlansAdmin(params);
        const arr = Array.isArray(res?.items) ? res.items : [];
        setItems(arr);
        setTotal(typeof res?.total === "number" ? res.total : arr.length);
    } catch (err) {
        console.error(err);
        toast.error("Không thể tải danh sách gói Premium");
        setItems([]);
        setTotal(0);
    } finally {
        setLoading(false);
    }
    };

  useEffect(() => {
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, skip]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (skip !== 0) setSkip(0);
      else loadPlans();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  const csv = useMemo(() => {
    const head = ["code", "planCode", "name", "months", "price", "currency", "isActive", "updatedAt"].join(",");
    const rows = items.map((x) =>
      [
        fmtCode(x._id),
        x.code,
        x.name,
        x.months,
        x.price,
        x.currency,
        x.isActive ? "active" : "inactive",
        x.updatedAt || "",
      ]
        .map((v) => (v ?? "").toString().replace(/"/g, '""'))
        .map((v) => `"${v}"`)
        .join(",")
    );
    return [head, ...rows].join("\n");
  }, [items]);

  const downloadCSV = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "premium_plans.csv";
    a.click();
  };

  const handleToggle = (it) => {
    const next = !it.isActive;
    setConfirm({
      kind: "toggle",
      item: it,
      nextActive: next,
      message: next
        ? "Bật hoạt động gói này? Gói sẽ hiển thị và có thể được mua."
        : "Tắt hoạt động gói này? Gói sẽ KHÔNG hiển thị và không thể mua.",
    });
  };

  const doToggle = async (it, nextActive) => {
    setProcessingId(it._id);
    try {
      const saved = await updatePremiumPlanAdmin(it._id, { isActive: nextActive });
      setItems((prev) => prev.map((x) => (x._id === it._id ? { ...x, ...saved } : x)));
      toast.success("Cập nhật trạng thái gói Premium thành công");
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Không thể cập nhật trạng thái gói");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = (it) => {
    setConfirm({
      kind: "delete",
      item: it,
      message: "Xóa gói Premium này? Nếu gói đã phát sinh giao dịch, hệ thống sẽ chặn xoá (khuyến nghị: tắt hoạt động).",
    });
  };

  const doDelete = async (it) => {
    setProcessingId(it._id);
    try {
      await deletePremiumPlanAdmin(it._id);

      if (items.length === 1 && skip > 0) setSkip(Math.max(0, skip - limit));
      else {
        setItems((prev) => prev.filter((x) => x._id !== it._id));
        setTotal((t) => Math.max(0, (t || 0) - 1));
      }
      toast.success("Đã xoá gói Premium");
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Không thể xoá gói Premium");
    } finally {
      setProcessingId(null);
    }
  };

  const handleSubmit = async (form, id) => {
    try {
      let saved;
      if (id) {
        saved = await updatePremiumPlanAdmin(id, form);
        toast.success("Cập nhật gói Premium thành công");
        setItems((prev) => prev.map((x) => (x._id === id ? { ...x, ...saved } : x)));
      } else {
        saved = await createPremiumPlanAdmin(form);
        toast.success("Tạo gói Premium thành công");
        setItems((prev) => [saved, ...(prev || [])]);
        setTotal((t) => (t || 0) + 1);
      }
      loadPlans().catch(() => {});
      return true;
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Lưu gói Premium thất bại");
      throw err;
    }
  };

  return (
    <div className="ct-page-admin">
      <nav className="ct-breadcrumb" aria-label="breadcrumb">
        <Link to="/">
          <i className="fa-solid fa-house" /> <span>Trang chủ</span>
        </Link>
        <span className="sep">/</span>
        <span className="grp">
          <i className="fa-solid fa-crown" /> <span>Premium</span>
        </span>
        <span className="sep">/</span>
        <span className="cur">Cấu hình gói Premium</span>
      </nav>

      <div className="ct-card">
        <div className="ct-head">
          <h2>Quản lý gói Premium ({total})</h2>
          <div className="ct-actions">
            {items.length > 0 && (
              <button className="btn ghost" type="button" onClick={downloadCSV}>
                <i className="fa-solid fa-file-export" /> <span>Xuất danh sách</span>
              </button>
            )}
            <button className="btn primary" type="button" onClick={() => setModal({ initial: null })}>
              <span>Tạo gói</span>
            </button>
          </div>
        </div>

        <div className="ct-filters">
          <div className="ct-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo mã gói, tên, số tháng, giá..."
            />
          </div>

          <div className="ct-filter-row">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_FILTERS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <select
              value=""
              onChange={(e) => {
                const m = e.target.value;
                if (!m) return;
                setQ(String(m));
              }}
              title="Lọc nhanh theo tháng"
            >
              <option value="">Lọc nhanh theo tháng</option>
              {MONTHS_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} tháng
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="ct-table">
          <div className="ct-thead pm-head">
            <div className="cell code">Mã</div>
            <div className="cell name">Gói</div>
            <div className="cell months">Thời hạn</div>
            <div className="cell price">Giá</div>
            <div className="cell status">Trạng thái</div>
            <div className="cell act">Thao tác</div>
          </div>

          {loading && <div className="ct-empty">Đang tải...</div>}
          {!loading && items.length === 0 && <div className="ct-empty">Chưa có gói Premium nào.</div>}

          {!loading &&
            items.map((it) => (
              <div key={it._id} className="ct-trow pm-row">
                <div className="cell code">
                  <div className="pm-code">{fmtCode(it._id)}</div>
                  <div className="pm-sub">{it.code || "—"}</div>
                </div>

                <div className="cell name">
                  <div className="ct-name-main">{it.name || "—"}</div>
                  {it.description ? (
                    <div className="pm-desc" title={it.description}>
                      {it.description}
                    </div>
                  ) : (
                    <div className="pm-desc empty">—</div>
                  )}
                </div>

                <div className="cell months">
                  <span className="pm-pill">{Number(it.months || 0)} tháng</span>
                  {typeof it.sortOrder === "number" && (
                    <span className="pm-sort">Sort: {it.sortOrder}</span>
                  )}
                </div>

                <div className="cell price">
                  <div className="pm-price">{fmtMoney(it.price, it.currency)}</div>
                </div>

                <div className="cell status">
                  <button
                    type="button"
                    className={"pm-toggle" + (it.isActive ? " on" : " off")}
                    disabled={processingId === it._id}
                    onClick={() => handleToggle(it)}
                  >
                    <span className="knob" />
                    <span className="label">{it.isActive ? "Hoạt động" : "Không hoạt động"}</span>
                  </button>
                </div>

                <div className="cell act">
                  <button className="iconbtn" title="Chỉnh sửa" onClick={() => setModal({ initial: it })}>
                    <i className="fa-regular fa-pen-to-square" />
                  </button>
                  <button
                    className="iconbtn danger"
                    title="Xóa"
                    disabled={processingId === it._id}
                    onClick={() => handleDelete(it)}
                  >
                    <i className="fa-solid fa-trash-can" />
                  </button>
                </div>
              </div>
            ))}
        </div>

        <div className="ct-pagination">
          <div className="per-page">
            <span>Hiển thị:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setSkip(0);
              }}
            >
              <option value="10">10 hàng</option>
              <option value="25">25 hàng</option>
              <option value="50">50 hàng</option>
            </select>
          </div>
          <div className="page-nav">
            <span className="page-info">
              Trang {page + 1} / {Math.max(pageCount, 1)} (Tổng: {total})
            </span>
            <button className="btn-page" onClick={() => setSkip(Math.max(0, skip - limit))} disabled={skip === 0}>
              <i className="fa-solid fa-chevron-left" />
            </button>
            <button
              className="btn-page"
              onClick={() => setSkip(skip + limit >= total ? skip : skip + limit)}
              disabled={skip + limit >= total}
            >
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        </div>
      </div>

      {confirm && (
        <div className="cm-backdrop" onClick={() => setConfirm(null)}>
          <div className="cm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cm-head">
              <h1 className="cm-title">
                {confirm.kind === "delete" ? "Xóa gói Premium?" : "Thay đổi trạng thái gói"}
              </h1>
            </div>
            <div className="cm-body">{confirm.message}</div>
            <div className="cm-foot">
              <button className="btn ghost" onClick={() => setConfirm(null)}>
                Đóng
              </button>
              <button
                className="btn primary"
                disabled={processingId === confirm?.item?._id}
                onClick={async () => {
                  const { kind, item, nextActive } = confirm;
                  if (kind === "delete") await doDelete(item);
                  else await doToggle(item, nextActive);
                  setConfirm(null);
                }}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <PremiumPlanModal
          initial={modal.initial}
          onClose={() => setModal(null)}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}
