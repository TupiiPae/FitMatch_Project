// admin-app/src/pagesFoods/List/List.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, listFoods, deleteFood, approveFood } from "../../lib/api.js";
import "./List.css";

// Chuẩn hoá URL ảnh giống user-app
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try { return new URL(u, API_ORIGIN).toString(); }
  catch { return u; }
};

export default function FoodsList() {
  const nav = useNavigate();

  // ===== Filters & state
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState(""); // yyyy-mm-dd
  const [dateTo, setDateTo] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // selection
  const [selectedIds, setSelectedIds] = useState([]);
  const allChecked = items.length > 0 && selectedIds.length === items.length;
  const someChecked = selectedIds.length > 0 && selectedIds.length < items.length;

  // confirm modal
  const [confirmId, setConfirmId] = useState(null);

  // ===== Load data
  const load = async () => {
    setLoading(true);
    try {
      const params = { q, limit: 100, skip: 0 };
      // Khi lọc thời gian → chỉ món đã approved
      if (dateFrom || dateTo) {
        params.status = "approved";
        if (dateFrom) params.approvedFrom = dateFrom;
        if (dateTo) params.approvedTo = dateTo;
      }

      const { items: docs = [] } = await listFoods(params);

      // Fallback nếu API chưa hỗ trợ approvedFrom/approvedTo
      let filtered = docs;
      if (dateFrom || dateTo) {
        const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00Z").getTime() : -Infinity;
        const toTs = dateTo ? new Date(dateTo + "T23:59:59Z").getTime() : Infinity;
        filtered = docs.filter((x) => {
          const t = x.approvedAt ? new Date(x.approvedAt).getTime() : 0;
          return x.status === "approved" && t >= fromTs && t <= toTs;
        });
      }

      // Tìm kiếm theo tên (includes)
      const qq = q.trim().toLowerCase();
      if (qq) filtered = filtered.filter((x) => (x.name || "").toLowerCase().includes(qq));

      setItems(filtered);
      setSelectedIds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q, dateFrom, dateTo]);

  // ===== Actions
  const onQuickApprove = async (id) => {
    await approveFood(id);
    await load();
  };

  const onDeleteOne = async (id) => {
    await deleteFood(id);
    await load();
  };

  const onBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!confirm(`Xóa ${selectedIds.length} món đã chọn?`)) return;
    for (const id of selectedIds) { try { await deleteFood(id); } catch {} }
    await load();
  };

  const toggleAll = () => {
    if (allChecked) setSelectedIds([]);
    else setSelectedIds(items.map((x) => x._id));
  };
  const toggleOne = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // ===== CSV (Xuất danh sách)
  const csv = useMemo(() => {
    const head = [
      "name","massG","unit","kcal","proteinG","carbG","fatG","creator","approvedAt","status"
    ].join(",");
    const rows = items.map((x) => {
      const creator = x.createdByAdmin ? "admin" : (x.createdBy ? "user" : "");
      return [
        x.name, x.massG, x.unit, x.kcal ?? "", x.proteinG ?? "", x.carbG ?? "", x.fatG ?? "",
        creator, x.approvedAt || "", x.status
      ].join(",");
    });
    return [head, ...rows].join("\n");
  }, [items]);

  const downloadCSV = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "foods.csv";
    a.click();
  };

  // ===== UI helpers
  const badgeRole = (it) => {
    if (it.createdByAdmin) return <span className="role-badge is-admin">Admin</span>;
    if (it.createdBy) return <span className="role-badge is-user">User</span>;
    return <span className="role-badge">N/A</span>;
  };
  const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "—");

  return (
    <div className="foods-page">
      {/* ===== Title row + actions ===== */}
      <div className="page-head">
        <h2>Danh sách món ăn</h2>
        <div className="head-actions">
          <button className="btn ghost" type="button" onClick={() => alert("TODO: Nhập danh sách")}>
            <i className="fa-solid fa-file-import" /> <span>Nhập danh sách</span>
          </button>
          <button className="btn ghost" type="button" onClick={downloadCSV}>
            <i className="fa-solid fa-file-export" /> <span>Xuất danh sách</span>
          </button>
          <button className="btn danger" type="button" onClick={onBulkDelete} disabled={!selectedIds.length}>
            <i className="fa-regular fa-trash-can" /> <span>Xóa</span>
          </button>
          <Link to="/foods/create" className="btn primary">
            <span>Tạo món ăn</span>
          </Link>
        </div>
      </div>

      {/* ===== Card: search + filters ===== */}
      <div className="card">
        <div className="card-head">
          <div className="search">
            <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm kiếm theo tên món ăn..."
            />
          </div>

          <div className="filters">
            <div className="date-range" title="Lọc theo thời gian tạo thành công (approvedAt)">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <span className="sep">–</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="hint"></div>
          </div>
        </div>

        {/* ===== Table ===== */}
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
            <div className="cell img">Hình ảnh</div>
            <div className="cell name">Tên</div>
            <div className="cell mass">Khối lượng (g)</div>
            <div className="cell kcal">Calorie (kcal)</div>
            <div className="cell macros">Đạm / Đường bột / Chất béo</div>
            <div className="cell creator">Người tạo</div>
            <div className="cell approved">Thời gian tạo thành công</div>
            <div className="cell act">Thao tác</div>
          </div>

          {loading && <div className="empty">Đang tải...</div>}
          {!loading && items.length === 0 && <div className="empty">Không có món nào.</div>}

          {!loading && items.map((it) => (
            <div key={it._id} className="trow">
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
                    <>
                      {/* dùng toAbs để đảm bảo URL tuyệt đối */}
                      <img
                        src={toAbs(it.imageUrl)}
                        alt={it.name}
                        onError={(e) => { e.currentTarget.src = "/images/food-placeholder.jpg"; }}
                      />
                    </>
                  )
                  : <div className="img-fallback"><i className="fa-regular fa-image"></i></div>}
              </div>

              <div className="cell name">
                <div className="title">{it.name || "—"}</div>
                <div className="sub">#{String(it._id).slice(-6)}</div>
              </div>

              <div className="cell mass">{it.massG ?? "—"}</div>
              <div className="cell kcal">{it.kcal ?? "—"}</div>

              <div className="cell macros">
                <span className="chip p">{it.proteinG ?? 0}g</span>
                <span className="chip c">{it.carbG ?? 0}g</span>
                <span className="chip f">{it.fatG ?? 0}g</span>
              </div>

              <div className="cell creator">{badgeRole(it)}</div>

              <div className="cell approved">{fmtDate(it.approvedAt)}</div>

              <div className="cell act">
                <button className="iconbtn" title="Chỉnh sửa" onClick={() => nav(`/foods/${it._id}/edit`)}>
                  <i className="fa-regular fa-pen-to-square"></i>
                </button>
                <button className="iconbtn danger" title="Xóa" onClick={() => setConfirmId(it._id)}>
                  <i className="fa-regular fa-trash-can"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Confirm Delete Modal ===== */}
      {confirmId && (
        <div
          className="cm-backdrop"
          role="presentation"
          onClick={() => setConfirmId(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setConfirmId(null);
            if (e.key === "Enter") { (async () => { await onDeleteOne(confirmId); setConfirmId(null); })(); }
          }}
        >
          <div
            className="cm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cm-title"
            aria-describedby="cm-desc"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cm-head">
              <h1 id="cm-title" className="cm-title">Xóa món ăn?</h1>
            </div>

            <div id="cm-desc" className="cm-body">
              Hành động này sẽ xóa món ăn khỏi danh sách và cơ sở dữ liệu. Thao tác không thể hoàn tác.
            </div>

            <div className="cm-foot">
              <button className="btn ghost" onClick={() => setConfirmId(null)}>Hủy</button>
              <button
                className="btn danger"
                onClick={async () => { await onDeleteOne(confirmId); setConfirmId(null); }}
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
