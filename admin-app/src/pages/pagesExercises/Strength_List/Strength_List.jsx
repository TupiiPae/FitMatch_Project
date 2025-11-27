// admin-app/src/pages/pagesExercises/Strength_List/Strength_List.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  api,
  listExercisesAdminOnly,
  deleteExercise,
  getExerciseMeta,
} from "../../../lib/api";
import { toast } from "react-toastify";
import CannotDeleteModal from "../../../components/CannotDeleteModal";
import "./Strength_List.css";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

export default function Strength_List() {
  const nav = useNavigate();
  const location = useLocation();

  /* ------------------ Filters ------------------ */
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("");
  const [muscle2, setMuscle2] = useState("");
  const [equipment, setEquipment] = useState("");
  const [level, setLevel] = useState("");

  /* ------------------ Meta ------------------ */
  const [MUSCLES, setMUSCLES] = useState([]);
  const [EQUIPMENTS, setEQUIPMENTS] = useState([]);
  const [LEVELS, setLEVELS] = useState([]);

  /* ------------------ Data ------------------ */
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);

  /* ------------------ Selection ------------------ */
  const [selectedIds, setSelectedIds] = useState([]);
  const allChecked = items.length > 0 && selectedIds.length === items.length;
  const someChecked =
    selectedIds.length > 0 && selectedIds.length < items.length;

  /* ------------------ Delete states ------------------ */
  // confirm modal dùng chung cho single & bulk
  // { mode: 'single'|'bulk', ids: string[] } | null
  const [confirm, setConfirm] = useState(null);
  const [deletingId, setDeletingId] = useState(null); // đang xóa 1
  const [bulkDeleting, setBulkDeleting] = useState(false); // đang xóa nhiều
  const [flashId, setFlashId] = useState(null); // highlight hàng mới tạo

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
        setEQUIPMENTS(meta?.EQUIPMENTS || []);
        setLEVELS(meta?.LEVELS || []);
      } catch {}
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    setSelectedIds([]);
    try {
      const params = { type: "Strength", limit, skip };
      const qTrim = (q || "").trim();
      if (qTrim) params.q = qTrim;
      if (muscle) params.primary = muscle;
      if (muscle2) params.secondary = muscle2;
      if (equipment) params.equipment = equipment;
      if (level) params.level = level;

      const res = await listExercisesAdminOnly(params); // -> { items, total, limit?, skip? }
      const arr = Array.isArray(res?.items) ? res.items : [];
      setItems(arr);
      setTotal(typeof res?.total === "number" ? res.total : arr.length);
    } catch (e) {
      console.error(e);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [limit, skip]);

  // thay đổi filter -> debounce 250ms
  useEffect(() => {
    const t = setTimeout(() => {
      if (skip !== 0) setSkip(0);
      else load();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, muscle, muscle2, equipment, level]);

  // đón state từ trang Create để flash hàng vừa tạo
  useEffect(() => {
    const s = location.state;
    if (s?.justCreated) {
      const doFlash = async () => {
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
      };
      doFlash();
      nav(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "—");

  const toggleAll = () => {
    setSelectedIds(allChecked ? [] : items.map((x) => x._id));
  };
  const toggleOne = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  /* ------------------ Delete: single ------------------ */
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

  /* ------------------ Delete: bulk ------------------ */
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
        // chỉ remove những bài tập xoá thành công
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

  /* ------------------ CSV (trang hiện tại) ------------------ */
  const csv = useMemo(() => {
    const head = [
      "name",
      "type",
      "primaryMuscles",
      "secondaryMuscles",
      "equipment",
      "level",
      "caloriePerRep",
      "createdAt",
    ].join(",");
    const rows = items.map((x) =>
      [
        x.name,
        x.type,
        (x.primaryMuscles || []).join("|"),
        (x.secondaryMuscles || []).join("|"),
        x.equipment,
        x.level,
        x.caloriePerRep ?? "",
        x.createdAt || "",
      ]
        .map((v) => v ?? "")
        .join(",")
    );
    return [head, ...rows].join("\n");
  }, [items]);

  const downloadCSV = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "exercises_strength.csv";
    a.click();
  };

  /* ------------------ Pagination ------------------ */
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
    <div className="ex-page">
      {/* breadcrumb */}
      <nav className="ex-breadcrumb" aria-label="breadcrumb">
        <Link to="/">
          <i className="fa-solid fa-house" /> <span>Trang chủ</span>
        </Link>
        <span className="sep">/</span>
        <span className="grp">
          <i className="fa-solid fa-dumbbell" />{" "}
          <span>Quản lý Bài tập</span>
        </span>
        <span className="sep">/</span>
        <span className="cur">Danh sách bài tập - Strength</span>
      </nav>

      <div className="ex-card">
        <div className="ex-head">
          <h2>Danh sách bài tập - Strength ({total})</h2>
          <div className="ex-actions">
            <button
              className="btn ghost"
              type="button"
              onClick={() =>
                alert("Tính năng nhập danh sách sẽ thêm sau")
              }
            >
              <i className="fa-solid fa-file-import" />{" "}
              <span>Nhập danh sách</span>
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={downloadCSV}
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
              <span>{bulkDeleting ? "Đang xóa..." : "Xóa"}</span>
            </button>
            <Link className="btn primary" to="/exercises/strength/create">
              <span>Tạo bài tập</span>
            </Link>
          </div>
        </div>

        {/* Search + filters */}
        <div className="ex-filters">
          <div className="ex-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên bài tập..."
            />
          </div>
          <div className="ex-filter-row">
            <select
              value={muscle}
              onChange={(e) => setMuscle(e.target.value)}
            >
              <option value="">Phân loại cơ chính</option>
              {MUSCLES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={muscle2}
              onChange={(e) => setMuscle2(e.target.value)}
            >
              <option value="">Nhóm cơ phụ</option>
              {MUSCLES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={equipment}
              onChange={(e) => setEquipment(e.target.value)}
            >
              <option value="">Dụng cụ</option>
              {EQUIPMENTS.map((eq) => (
                <option key={eq} value={eq}>
                  {eq}
                </option>
              ))}
            </select>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="">Mức độ</option>
              {LEVELS.map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="ex-table">
          <div className="ex-thead">
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
            <div className="cell img">Hình ảnh</div>
            <div className="cell name">Tên bài tập</div>
            <div className="cell type">Phân loại</div>
            <div className="cell pmus">Nhóm cơ chính</div>
            <div className="cell smus">Nhóm cơ phụ</div>
            <div className="cell equip">Dụng cụ</div>
            <div className="cell lvl">Mức độ</div>
            <div className="cell cal">Giá trị MET</div>
            <div className="cell created">Thời gian tạo</div>
            <div className="cell act">Thao tác</div>
          </div>

          {loading && <div className="ex-empty">Đang tải...</div>}
          {!loading && items.length === 0 && (
            <div className="ex-empty">Chưa có bài tập.</div>
          )}

          {!loading &&
            items.map((it) => (
              <div
                key={it._id}
                className={`ex-trow ${
                  flashId === it._id ? "ex-row--flash" : ""
                }`}
              >
                <label className="cell cb">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(it._id)}
                    onChange={() => toggleOne(it._id)}
                  />
                </label>

                <div className="cell img">
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
                    <div className="img-fallback">
                      <i className="fa-regular fa-image" />
                    </div>
                  )}
                </div>

                <div className="cell name">
                  <div className="ex-title">{it.name || "—"}</div>
                  <div className="ex-sub">
                    #{String(it._id).slice(-6)}
                  </div>
                </div>

                <div className="cell type">{it.type || "—"}</div>
                <div className="cell pmus">
                  {it.primaryMuscles &&
                  it.primaryMuscles.length > 0
                    ? it.primaryMuscles.map((m) => (
                        <span
                          key={m}
                          className="mchip primary"
                        >
                          {m}
                        </span>
                      ))
                    : "—"}
                </div>
                <div className="cell smus">
                  {it.secondaryMuscles &&
                  it.secondaryMuscles.length > 0
                    ? it.secondaryMuscles.map((m) => (
                        <span key={m} className="mchip">
                          {m}
                        </span>
                      ))
                    : "—"}
                </div>
                <div className="cell equip">{it.equipment || "—"}</div>
                <div className="cell lvl">{it.level || "—"}</div>
                <div className="cell cal">
                  {it.caloriePerRep ?? "—"}
                </div>
                <div className="cell created">{fmtDate(it.createdAt)}</div>

                <div className="cell act">
                  <button
                    className="iconbtn"
                    title="Chỉnh sửa"
                    onClick={() =>
                      nav(`/exercises/${it._id}/edit`)
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
        <div className="ex-pagination">
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

      {/* Confirm Delete (dùng chung cho single & bulk; giữ nguyên className .cm-*) */}
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
                  ? `Xóa ${confirm.ids.length} bài tập?`
                  : "Xóa bài tập?"}
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

      {/* Modal thông báo không thể xoá (ràng buộc 7 ngày) */}
      <CannotDeleteModal
        open={cannotDelete.open}
        title="Không thể xoá bài tập"
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
