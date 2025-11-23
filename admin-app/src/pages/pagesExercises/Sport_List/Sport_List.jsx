import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, listExercisesAdminOnly, deleteExercise, getExerciseMeta } from "../../../lib/api";
import CannotDeleteModal from "../../../components/CannotDeleteModal";
import "./Sport_List.css";
import { toast } from "react-toastify";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => { if (!u) return u; try { return new URL(u, API_ORIGIN).toString(); } catch { return u; } };

export default function Sport_List() {
  const nav = useNavigate();
  const location = useLocation();

  // Filters
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const [level, setLevel] = useState("");

  // Meta
  const [MUSCLES, setMUSCLES] = useState([]);
  const [LEVELS, setLEVELS] = useState([]);

  // Data
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);

  // selection
  const [selectedIds, setSelectedIds] = useState([]);
  const allChecked = items.length > 0 && selectedIds.length === items.length;
  const someChecked = selectedIds.length > 0 && selectedIds.length < items.length;

  // confirm modal (single/bulk)
  const [confirm, setConfirm] = useState(null); // { mode:'single'|'bulk', ids:[] }
  const [flashId, setFlashId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [cannotDelete, setCannotDelete] = useState({
    open: false,
    message: "",
    details: null,
  });

  useEffect(() => {
    (async () => {
      try {
        const meta = await getExerciseMeta();
        setMUSCLES(meta?.MUSCLE_GROUPS || []);
        setLEVELS(meta?.LEVELS || []);
      } catch {}
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    setSelectedIds([]);
    try {
      const params = { type: "Sport", limit, skip };
      const qTrim = (q || "").trim();
      if (qTrim) params.q = qTrim;
      if (muscle) params.primary = muscle;
      if (level) params.level = level;

      const res = await listExercisesAdminOnly(params);
      const arr = Array.isArray(res?.items) ? res.items : [];
      setItems(arr);
      setTotal(typeof res?.total === "number" ? res.total : arr.length);
    } catch (e) {
      console.error(e);
      setItems([]); setTotal(0);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [limit, skip]);

  // debounce filters
  useEffect(() => {
    const t = setTimeout(() => { if (skip !== 0) setSkip(0); else load(); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, muscle, level]);

  // flash sau khi tạo
  useEffect(() => {
    const s = location.state;
    if (s?.justCreated) {
      (async () => {
        try {
          if (s.createdId) {
            if (skip !== 0) setSkip(0);
            await load();
            setFlashId(s.createdId);
            setTimeout(() => setFlashId(null), 2500);
          } else {
            await load();
          }
        } catch {}
      })();
      nav(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "—");
  const toggleAll = () => setSelectedIds(allChecked ? [] : items.map(x => x._id));
  const toggleOne = (id) => setSelectedIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const onDeleteOne = async (id) => {
    try {
      setDeletingId(id);
      await deleteExercise(id);

      if (items.length === 1 && skip > 0) {
        setSkip(Math.max(0, skip - limit));
      } else {
        setItems((prev) => prev.filter((x) => x._id !== id));
        setTotal((t) => Math.max(0, (t || 0) - 1));
        setSelectedIds((sel) => sel.filter((x) => x !== id));
      }

      toast.success("Đã xóa môn thể thao");
      } catch (e) {
        const status = e?.response?.status;
        const data = e?.response?.data;
        const code = data?.code;
        const msg = data?.message;

        if (status === 409) {
          let fallbackMsg;
          if (code === "EXERCISE_IN_USE_SUGGEST_PLAN") {
            fallbackMsg =
              "Không thể xoá bài tập này vì đang được sử dụng trong một hoặc nhiều Lịch tập gợi ý.";
          } else if (code === "EXERCISE_IN_USE_ACTIVE_USERS") {
            fallbackMsg =
              "Bài tập này đang được người dùng hoạt động sử dụng trong lịch tập cá nhân 7 ngày gần đây, không thể xoá.";
          } else {
            fallbackMsg =
              "Bài tập này đang được sử dụng nên không thể xoá.";
          }

          const detailLines =
            Array.isArray(data?.plans) && data.plans.length
              ? data.plans.map(
                  (p) =>
                    p.name ||
                    `#${String(p.id || p._id || "").slice(-6)}`
                )
              : null;

          setCannotDelete({
            open: true,
            message: msg || fallbackMsg,
            details: detailLines,
          });
        } else {
          console.error(e);
          toast.error(msg || "Xóa thất bại");
        }
      } finally {
      setDeletingId(null);
    }
  };

  const onBulkDelete = async (ids) => {
    if (!ids?.length) return;
    try {
      setBulkDeleting(true);
      const results = await Promise.allSettled(
        ids.map((id) => deleteExercise(id))
      );

      const successIds = [];
      const blocked = [];
      const otherErrors = [];

      results.forEach((r, idx) => {
        if (r.status === "fulfilled") {
          successIds.push(ids[idx]);
        } else {
          const status = r.reason?.response?.status;
          if (status === 409) blocked.push(r);
          else otherErrors.push(r);
        }
      });

      const ok = successIds.length;
      const otherFail = otherErrors.length;

      const deletingAll = ids.length >= items.length;
      if (deletingAll && skip > 0) {
        setSkip(Math.max(0, skip - limit));
      } else {
        setItems((prev) =>
          prev.filter((x) => !successIds.includes(x._id))
        );
        setTotal((t) => Math.max(0, (t || 0) - ok));
        setSelectedIds([]);
      }

      if (ok) toast.success(`Đã xóa ${ok} môn`);
      if (otherFail) toast.error(`${otherFail} môn xóa thất bại`);

      if (blocked.length > 0) {
        const first = blocked[0].reason?.response?.data;
        const code = first?.code;
        const msg = first?.message;

        let fallbackMsg;
        if (code === "EXERCISE_IN_USE_SUGGEST_PLAN") {
          fallbackMsg =
            "Một số bài tập không thể xoá vì đang được sử dụng trong các Lịch tập gợi ý.";
        } else if (code === "EXERCISE_IN_USE_ACTIVE_USERS") {
          fallbackMsg =
            "Một số bài tập không thể xoá vì đang được người dùng hoạt động sử dụng trong lịch tập cá nhân 7 ngày gần đây.";
        } else {
          fallbackMsg =
            "Một số bài tập không thể xoá vì đang được sử dụng.";
        }

        const detailLines =
          Array.isArray(first?.plans) && first.plans.length
            ? first.plans.map(
                (p) =>
                  p.name ||
                  `#${String(p.id || p._id || "").slice(-6)}`
              )
            : null;

        setCannotDelete({
          open: true,
          message: msg || fallbackMsg,
          details: detailLines,
        });
      }
    } finally {
      setBulkDeleting(false);
    }
  };

  // CSV (trang hiện tại)
  const csv = useMemo(() => {
    const head = ["name","type","primaryMuscles","level","caloriePerRep","createdAt"].join(",");
    const rows = items.map(x => ([
      x.name, x.type,
      (x.primaryMuscles||[]).join("|"),
      x.level, x.caloriePerRep ?? "", x.createdAt || ""
    ].map(v => v ?? "").join(",")));
    return [head, ...rows].join("\n");
  }, [items]);

  const downloadCSV = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "exercises_sport.csv";
    a.click();
  };

  // pagination
  const page = Math.floor(skip / limit);
  const pageCount = Math.max(1, Math.ceil((total || 0) / limit));
  const handleLimitChange = (e) => { setLimit(Number(e.target.value)); setSkip(0); };
  const handlePageChange = (newSkip) => { if (newSkip >= 0 && newSkip < Math.max(total, 1)) setSkip(newSkip); };

  return (
    <div className="sp-page">
      {/* breadcrumb */}
      <nav className="sp-breadcrumb" aria-label="breadcrumb">
        <Link to="/"><i className="fa-solid fa-house" /> <span>Trang chủ</span></Link>
        <span className="sp-sep">/</span>
        <span className="sp-grp"><i className="fa-solid fa-football" /> <span>Quản lý Bài tập</span></span>
        <span className="sp-sep">/</span>
        <span className="sp-cur">Danh sách môn thể thao - Sport</span>
      </nav>

      <div className="sp-card">
        <div className="sp-head">
          <h2>Danh sách môn thể thao - Sport ({total})</h2>
          <div className="sp-actions">
            <button className="btn ghost" type="button" onClick={downloadCSV}>
              <i className="fa-solid fa-file-export" /> <span>Xuất danh sách</span>
            </button>
            <button
              className="btn danger"
              type="button"
              disabled={!selectedIds.length || bulkDeleting}
              onClick={() => setConfirm({ mode: "bulk", ids: selectedIds.slice() })}
            >
              <i className="fa-regular fa-trash-can" /> <span>{bulkDeleting ? "Đang xóa..." : "Xóa"}</span>
            </button>
            <Link className="btn primary" to="/exercises/sport/create">
              <span>Tạo môn</span>
            </Link>
          </div>
        </div>

        {/* Search + filters */}
        <div className="sp-filters">
          <div className="sp-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Tìm theo tên môn..." />
          </div>
          <div className="sp-filter-row">
            <select value={muscle} onChange={(e)=>setMuscle(e.target.value)}>
              <option value="">Nhóm cơ chính</option>
              {MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={level} onChange={(e)=>setLevel(e.target.value)}>
              <option value="">Mức độ</option>
              {LEVELS.map(lv => <option key={lv} value={lv}>{lv}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="sp-table">
          <div className="sp-thead">
            <label className="sp-cell cb">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => { if (el) el.indeterminate = someChecked; }}
                onChange={toggleAll}
              />
            </label>
            <div className="sp-cell img">Hình</div>
            <div className="sp-cell name">Tên môn thể thao</div>
            <div className="sp-cell type">Phân loại</div>
            <div className="sp-cell pmus">Nhóm cơ chính</div>
            <div className="sp-cell lvl">Mức độ</div>
            <div className="sp-cell cal">Giá trị MET</div>
            <div className="sp-cell created">Tạo lúc</div>
            <div className="sp-cell act">Thao tác</div>
          </div>

          {loading && <div className="sp-empty">Đang tải...</div>}
          {!loading && items.length === 0 && <div className="sp-empty">Chưa có môn thể thao.</div>}

          {!loading && items.map(it => (
            <div key={it._id} className={`sp-trow ${flashId === it._id ? "sp-row--flash" : ""}`}>
              <label className="sp-cell cb">
                <input type="checkbox" checked={selectedIds.includes(it._id)} onChange={()=>toggleOne(it._id)} />
              </label>

              <div className="sp-cell img">
                {it.imageUrl
                  ? <img src={toAbs(it.imageUrl)} alt={it.name} onError={(e)=>{e.currentTarget.src="/images/food-placeholder.jpg"}} />
                  : <div className="sp-img-fallback"><i className="fa-regular fa-image" /></div>}
              </div>

              <div className="sp-cell name">
                <div className="sp-title">{it.name || "—"}</div>
                <div className="sp-sub">#{String(it._id).slice(-6)}</div>
              </div>

              <div className="sp-cell type">{it.type || "—"}</div>
              <div className="sp-cell pmus">
                {(it.primaryMuscles?.length ? it.primaryMuscles : []).map(m => <span key={m} className="sp-mchip primary">{m}</span>) || "—"}
              </div>

              <div className="sp-cell lvl">{it.level || "—"}</div>
              <div className="sp-cell cal">{it.caloriePerRep ?? "—"}</div>
              <div className="sp-cell created">{fmtDate(it.createdAt)}</div>

              <div className="sp-cell act">
                <button className="sp-iconbtn" title="Chỉnh sửa" onClick={() => nav(`/exercises/sport/${it._id}/edit`)}>
                  <i className="fa-regular fa-pen-to-square" />
                </button>
                <button
                  className="sp-iconbtn danger"
                  title="Xóa"
                  onClick={() => setConfirm({ mode: "single", ids: [it._id] })}
                  disabled={deletingId === it._id}
                >
                  <i className="fa-solid fa-trash-can" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="sp-pagination">
          <div className="sp-per-page">
            <span>Hiển thị:</span>
            <select value={limit} onChange={handleLimitChange}>
              <option value="10">10 hàng</option>
              <option value="25">25 hàng</option>
              <option value="50">50 hàng</option>
            </select>
          </div>
          <div className="sp-page-nav">
            <span className="sp-page-info">Trang {page + 1} / {Math.max(pageCount,1)} (Tổng: {total})</span>
            <button className="sp-btn-page" onClick={()=>handlePageChange(skip - limit)} disabled={skip===0}>
              <i className="fa-solid fa-chevron-left" />
            </button>
            <button className="sp-btn-page" onClick={()=>handlePageChange(skip + limit)} disabled={skip + limit >= total}>
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Delete (single/bulk) */}
      {confirm && (
        <div className="cm-backdrop" onClick={()=>setConfirm(null)}>
          <div className="cm-modal" onClick={(e)=>e.stopPropagation()}>
            <div className="cm-head">
              <h1 className="cm-title">
                {confirm.mode === "bulk" ? `Xóa ${confirm.ids.length} môn đã chọn?` : "Xóa môn thể thao?"}
              </h1>
            </div>
            <div className="cm-body">Thao tác không thể hoàn tác.</div>
            <div className="cm-foot">
              <button className="btn ghost" onClick={()=>setConfirm(null)}>Hủy</button>
              {confirm.mode === "bulk" ? (
                <button className="btn danger" disabled={bulkDeleting} onClick={async ()=>{ await onBulkDelete(confirm.ids); setConfirm(null); }}>
                  {bulkDeleting ? "Đang xóa..." : `Xóa ${confirm.ids.length}`}
                </button>
              ) : (
                <button className="btn danger" disabled={deletingId===confirm.ids[0]} onClick={async ()=>{ await onDeleteOne(confirm.ids[0]); setConfirm(null); }}>
                  {deletingId===confirm.ids[0] ? "Đang xóa..." : "Xóa"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <CannotDeleteModal
        open={cannotDelete.open}
        title="Không thể xoá môn thể thao"
        message={cannotDelete.message}
        details={cannotDelete.details}
        onClose={() =>
          setCannotDelete({
            open: false,
            message: "",
            details: null,
          })
        }
      />
    </div>
  );
}
