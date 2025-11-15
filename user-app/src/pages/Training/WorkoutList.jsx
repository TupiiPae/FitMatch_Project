// user-app/src/pages/Workout/WorkoutList.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./WorkoutList.css";
import "../Training/SuggestPlanList.css"; // dùng lại style card gợi ý
import { listMyWorkouts, deletePlan } from "../../api/workouts";
import {
  listSavedSuggestPlans,
  getSuggestPlanDetail,
  toggleSaveSuggestPlan,
} from "../../api/suggestPlans";
import { toast } from "react-toastify";
import api from "../../lib/api";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

// helper strip html (dùng cho mô tả lịch gợi ý trong modal)
function stripHtml(html = "") {
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapPlanToUi(p) {
  const t = p?.totals || {};
  const names = (p?.items || [])
    .map((it) => it?.exerciseName || it?.name)
    .filter(Boolean);
  const raw = names.join(", ");
  const MAX = 120;
  const note =
    raw.length > MAX
      ? raw.slice(0, MAX).replace(/\s+[^,]*$/, "") + "…"
      : raw;

  return {
    _id: p._id,
    title: p.name || "(Không tên)",
    note,
    exCount: t.exercises ?? 0,
    setCount: t.sets ?? 0,
    repCount: t.reps ?? 0,
    kcal: t.kcal ?? t.calories ?? p.totalKcal ?? 0,
    updatedAt: p.updatedAt,
  };
}

export default function WorkoutList() {
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [showMine, setShowMine] = useState(true);
  const [showSaved, setShowSaved] = useState(true);

  const [mine, setMine] = useState([]);
  const [saved, setSaved] = useState([]); // Lịch tập gợi ý đã lưu
  const [loading, setLoading] = useState(false);

  const [menuId, setMenuId] = useState(null);
  const [confirmDel, setConfirmDel] = useState({
    open: false,
    id: null,
    name: "",
  });

  // xác nhận bỏ lưu lịch tập gợi ý
  const [confirmUnsave, setConfirmUnsave] = useState({
    open: false,
    id: null,
    name: "",
  });

  // modal chi tiết lịch tập
  const [showPlanDetail, setShowPlanDetail] = useState(false);
  const [planDetail, setPlanDetail] = useState(null);
  const [detailKind, setDetailKind] = useState("workout"); // "workout" | "suggest"

  const headRef = useRef(null);
  const nf = new Intl.NumberFormat("vi-VN");

  async function loadAll() {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        listMyWorkouts({ q, limit: 50, skip: 0 }),
        listSavedSuggestPlans({ q, limit: 100, skip: 0 }), // chỉ lấy lịch tập gợi ý đã lưu
      ]);
      const pick = (r) => r?.data?.data || r?.data || r || {};
      setMine((pick(a).items || []).map(mapPlanToUi));
      setSaved(b.items || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(loadAll, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    const fn = (e) => {
      if (!headRef.current?.contains(e.target)) setFilterOpen(false);
      setMenuId(null);
    };
    document.addEventListener("click", fn);
    return () => document.removeEventListener("click", fn);
  }, []);

  const listMine = useMemo(() => mine, [mine]);
  const listSaved = useMemo(() => saved, [saved]);

  const openConfirmDelete = (it) =>
    setConfirmDel({ open: true, id: it._id, name: it.title });
  const closeConfirmDelete = () =>
    setConfirmDel({ open: false, id: null, name: "" });
  const confirmDeleteNow = async () => {
    if (!confirmDel.id) return;
    try {
      await deletePlan(confirmDel.id);
      toast.success("Đã xóa lịch tập");
      setMenuId(null);
      closeConfirmDelete();
      loadAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Xóa thất bại");
    }
  };

  // mở confirm bỏ lưu lịch tập gợi ý
  const openConfirmUnsave = (p) =>
    setConfirmUnsave({
      open: true,
      id: p._id,
      name: p.name || "(Không tên)",
    });
  const closeConfirmUnsave = () =>
    setConfirmUnsave({ open: false, id: null, name: "" });

  const confirmUnsaveNow = async () => {
    if (!confirmUnsave.id) return;
    try {
      const res = await toggleSaveSuggestPlan(confirmUnsave.id);
      const savedFlag = !!res.saved;
      if (!savedFlag) {
        setSaved((prev) =>
          prev.filter((p) => p._id !== confirmUnsave.id)
        );
        toast.success("Đã bỏ lưu lịch tập gợi ý");
      } else {
        // trường hợp hiếm: vẫn còn saved
        toast.error("Không thể bỏ lưu lịch tập gợi ý");
      }
    } catch (err) {
      console.error(err);
      toast.error("Không thể bỏ lưu lịch tập gợi ý");
    } finally {
      closeConfirmUnsave();
    }
  };

  // mở modal chi tiết lịch tập (tạo bởi bạn)
  async function openPlanDetailWorkout(id) {
    try {
      const r = await api.get(`/user/workouts/${id}`);
      const plan = r?.data?.data || r?.data || {};
      setPlanDetail(plan);
      setDetailKind("workout");
      setShowPlanDetail(true);
    } catch {
      toast.error("Không tải được chi tiết lịch tập");
    }
  }

  // mở modal chi tiết lịch tập gợi ý đã lưu
  async function openPlanDetailSuggest(id) {
    try {
      const plan = await getSuggestPlanDetail(id);
      setPlanDetail(plan);
      setDetailKind("suggest");
      setShowPlanDetail(true);
    } catch {
      toast.error("Không tải được chi tiết lịch tập gợi ý");
    }
  }

  // helpers hiển thị cho từng dòng bài tập (lịch do bạn tạo)
  const calcSetStats = (sets = []) => {
    const hiệp = sets.length || 0;
    const repsArr = sets
      .map((s) => Number(s?.reps || 0))
      .filter((x) => x > 0);
    const restArr = sets
      .map((s) => Number(s?.restSec || 0))
      .filter((x) => x > 0);
    const avg = (arr) =>
      arr.length
        ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
        : null;
    return {
      hiep: hiệp,
      reps: avg(repsArr),
      rest: avg(restArr),
    };
  };

  return (
    <div className="wl-wrap">
      {/* ===== HEAD ===== */}
      <div
        className="wl-head"
        ref={headRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="search">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            placeholder="Tìm lịch tập"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div
          className={`filter ${filterOpen ? "open" : ""}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="filter-btn"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen((v) => !v)}
          >
            Lọc <i className="fa-solid fa-caret-down"></i>
          </button>
          {filterOpen && (
            <div className="filter-dd">
              <label>
                <input
                  type="checkbox"
                  checked={showMine}
                  onChange={(e) => setShowMine(e.target.checked)}
                />{" "}
                Tạo bởi bạn
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showSaved}
                  onChange={(e) => setShowSaved(e.target.checked)}
                />{" "}
                Lịch tập gợi ý đã lưu
              </label>
            </div>
          )}
        </div>

        <Link
          to="/tap-luyen/lich-cua-ban/tao"
          className="create-btn"
        >
          Tạo lịch tập mới
        </Link>
      </div>

      {/* ===== LIST FRAME ===== */}
      <div className="wl-list-frame">
        {/* Mine */}
        <div className="wl-section">
          <div className="wl-sec-head">
            <div className="wl-sec-title">
              Lịch tập tạo bởi bạn
            </div>
          </div>

          {showMine ? (
            <div className="wl-list">
              {listMine.length === 0 ? (
                <div className="wl-empty">
                  {loading
                    ? "Đang tải..."
                    : "Chưa có lịch tập nào do bạn tạo."}
                </div>
              ) : (
                listMine.map((w) => (
                  <WorkoutItem
                    key={w._id}
                    item={w}
                    mine
                    menuOpen={menuId === w._id}
                    onToggleMenu={() =>
                      setMenuId(
                        menuId === w._id ? null : w._id
                      )
                    }
                    onDelete={() => openConfirmDelete(w)}
                    onEdit={() => {
                      setMenuId(null);
                      nav(
                        `/tap-luyen/lich-cua-ban/tao?id=${w._id}`
                      );
                    }}
                    onOpenDetail={() =>
                      openPlanDetailWorkout(w._id)
                    }
                    onMarkDone={() => {
                      toast.success(
                        "Đã đánh dấu là đã thực hiện"
                      );
                      setMenuId(null);
                    }}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="wl-muted">
              Đang ẩn danh sách này (bỏ lọc để xem).
            </div>
          )}
        </div>

        <hr className="wl-line" />

        {/* Saved suggest plans */}
        <div className="wl-section">
          <div className="wl-sec-head">
            <div className="wl-sec-title">
              Lịch tập gợi ý đã lưu
            </div>
          </div>

          {showSaved ? (
            <div className="wl-list">
              {listSaved.length === 0 ? (
                <div className="wl-empty">
                  {loading
                    ? "Đang tải..."
                    : "Chưa lưu lịch tập gợi ý nào."}
                </div>
              ) : (
                listSaved.map((p) => (
                  <SavedSuggestItem
                    key={p._id}
                    plan={p}
                    onOpenDetail={() =>
                      openPlanDetailSuggest(p._id)
                    }
                    onAskUnsave={() =>
                      openConfirmUnsave(p)
                    }
                  />
                ))
              )}
            </div>
          ) : (
            <div className="wl-muted">
              Đang ẩn danh sách này (bỏ lọc để xem).
            </div>
          )}
        </div>
      </div>

      {/* confirm delete lịch do bạn tạo (giữ nguyên) */}
      {confirmDel.open && (
        <div className="modal" onClick={closeConfirmDelete}>
          <div
            className="modal-card confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-del-title"
          >
            <div className="cm-head">
              <div className="cm-icon">
                <i
                  className="fa-solid fa-triangle-exclamation"
                  aria-hidden="true"
                ></i>
              </div>
            </div>
            <div className="cm-body">
              Bạn chắc chắn muốn xóa{" "}
              <b>{confirmDel.name}</b>?
              <br />
              Thao tác này không thể hoàn tác.
            </div>
            <div className="cm-foot">
              <button
                className="btn ghost"
                onClick={closeConfirmDelete}
              >
                Hủy
              </button>
              <button
                className="btn bad"
                onClick={confirmDeleteNow}
              >
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* confirm bỏ lưu lịch tập gợi ý */}
      {confirmUnsave.open && (
        <div className="modal" onClick={closeConfirmUnsave}>
          <div
            className="modal-card confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="cm-head">
              <div className="cm-icon">
                <i className="fa-solid fa-bookmark" />
              </div>
            </div>
            <div className="cm-body">
              Bạn chắc chắn muốn bỏ lưu{" "}
              <b>{confirmUnsave.name}</b>?
              <br />
              Bạn vẫn có thể tìm lại lịch tập này trong
              mục "Lịch tập gợi ý".
            </div>
            <div className="cm-foot">
              <button
                className="btn ghost"
                onClick={closeConfirmUnsave}
              >
                Hủy
              </button>
              <button
                className="btn bad"
                onClick={confirmUnsaveNow}
              >
                Bỏ lưu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PLAN DETAIL MODAL (dùng chung cho 2 loại) ===== */}
      {showPlanDetail && !!planDetail && (
        <div
          className="modal"
          onClick={() => setShowPlanDetail(false)}
        >
          <div
            className="modal-card wp-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              className="wp-close"
              title="Đóng"
              onClick={() => setShowPlanDetail(false)}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>

            {/* HEAD */}
            {detailKind === "workout" ? (
              <div className="wp-head">
                <img
                  className="wp-thumb"
                  src="/images/workout-plan.png"
                  alt="Workout plan"
                />
                <div className="wp-titlebox">
                  <h3 className="wp-title">
                    {planDetail?.name || "(Không tên)"}
                  </h3>
                  <div className="wp-sub">
                    {(planDetail?.note || "").trim() ||
                      "Không có ghi chú lịch tập"}
                  </div>
                  <div className="wp-chips">
                    <span className="chip chip-blue">
                      Tổng bài{" "}
                      {planDetail?.totals?.exercises ?? 0}
                    </span>
                    <span className="chip chip-gray">
                      Tổng hiệp{" "}
                      {planDetail?.totals?.sets ?? 0}
                    </span>
                    <span className="chip chip-gray">
                      Tổng reps{" "}
                      {planDetail?.totals?.reps ?? 0}
                    </span>
                    <span className="chip chip-red">
                      <i className="fa-solid fa-fire-flame-curved"></i>{" "}
                      {nf.format(
                        planDetail?.totals?.kcal || 0
                      )}{" "}
                      kcal
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="wp-head">
                <img
                  className="wp-thumb"
                  src={
                    planDetail?.imageUrl ||
                    "/images/workout-plan.png"
                  }
                  alt={planDetail?.name || "Workout plan"}
                />
                <div className="wp-titlebox">
                  <h3 className="wp-title">
                    {planDetail?.name || "(Không tên)"}
                  </h3>
                  <div className="wp-sub">
                    {stripHtml(
                      planDetail?.descriptionHtml || ""
                    ) || "Không có mô tả lịch tập"}
                  </div>
                  <div className="wp-chips">
                    <span className="chip chip-blue">
                      Lịch tập{" "}
                      {planDetail?.sessionsCount ??
                        (planDetail?.sessions || [])
                          .length}{" "}
                      buổi
                    </span>
                    {planDetail?.category && (
                      <span className="chip chip-gray">
                        {planDetail.category}
                      </span>
                    )}
                    {planDetail?.level && (
                      <span className="chip chip-gray">
                        {planDetail.level}
                      </span>
                    )}
                    {planDetail?.goal && (
                      <span className="chip chip-gray">
                        {planDetail.goal}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* BODY */}
            <div className="wp-exlist">
              {detailKind === "workout" ? (
                (planDetail?.items || []).map((it, i) => {
                  const s = calcSetStats(it?.sets);
                  const repsText =
                    s.reps != null
                      ? `${s.reps} reps`
                      : "- reps";
                  const restText =
                    s.rest != null
                      ? `${s.rest}s nghỉ`
                      : "0s nghỉ";
                  return (
                    <div className="wp-exrow" key={i}>
                      <img
                        className="wp-eximg"
                        src={
                          toAbs(it?.imageUrl) ||
                          "/images/exercise-placeholder.png"
                        }
                        alt={
                          it?.exerciseName || "exercise"
                        }
                      />
                      <div className="wp-exmeta">
                        <button
                          type="button"
                          className="wp-exname"
                          onClick={() => {
                            setShowPlanDetail(false);
                            nav(
                              `/tap-luyen/bai-tap/${it.exercise}`
                            );
                          }}
                          title="Xem chi tiết bài tập"
                        >
                          {it.exerciseName}
                        </button>
                        <div className="wp-exsub">
                          {s.hiep} hiệp ~ {repsText} ~{" "}
                          {restText}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                // detailKind === "suggest"
                (planDetail?.sessions || []).map(
                  (ses, idxSes) => (
                    <div key={idxSes}>
                      <div className="wp-exsub" style={{ fontWeight: 600, margin: "4px 0 6px", }}>
                        {ses.title ||
                          `Buổi ${idxSes + 1}`}
                      </div>
                      {(ses.exercises || []).map(
                        (ex, i) => (
                          <div
                            className="wp-exrow"
                            key={`${idxSes}-${i}`}
                          >
                            <img
                              className="wp-eximg"
                              src={
                                toAbs(ex?.imageUrl) ||
                                "/images/exercise-placeholder.png"
                              }
                              alt={ex?.name || "exercise"}
                            />
                            <div className="wp-exmeta">
                              <button
                                type="button"
                                className="wp-exname"
                                onClick={() => {
                                  setShowPlanDetail(false);
                                  nav(
                                    `/tap-luyen/bai-tap/chi-tiet/${ex.exerciseId}`
                                  );
                                }}
                              >
                                {ex.name}
                              </button>
                              {ex.repsText && (
                                <div className="wp-exsub">
                                  {ex.repsText}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkoutItem({
  item,
  mine,
  menuOpen,
  onToggleMenu,
  onDelete,
  onEdit,
  onOpenDetail,
  onMarkDone,
}) {
  const nf = new Intl.NumberFormat("vi-VN");
  return (
    <div
      className="wl-item"
      onClick={() => onOpenDetail && onOpenDetail()}
    >
      <div className="wl-top">
        <div className="wl-tmeta">
          <div className="wl-title">{item.title}</div>
          {!!item.note && (
            <div className="wl-note" title={item.note}>
              {item.note}
            </div>
          )}
        </div>

        <div
          className="wl-acts"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="more-wrap">
            <button
              className="more-btn"
              onClick={onToggleMenu}
              aria-haspopup="menu"
              aria-expanded={!!menuOpen}
              title="Tùy chọn"
            >
              <i className="fa-solid fa-ellipsis-vertical"></i>
            </button>
            {menuOpen && (
              <div
                className="menuWL"
                role="menu"
                onClick={(e) => e.stopPropagation()}
              >
                {mine && onDelete && (
                  <button
                    className="menu-item danger"
                    onClick={onDelete}
                  >
                    Xóa
                  </button>
                )}
                {mine && onEdit && (
                  <button
                    className="menu-item"
                    onClick={onEdit}
                  >
                    Chỉnh sửa
                  </button>
                )}
                <button
                  className="menu-item"
                  onClick={onMarkDone}
                >
                  Đánh dấu đã thực hiện
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className="wl-metrics"
        aria-label="Tóm tắt lịch tập"
      >
        <div className="mcol">
          <div className="num">
            {item.exCount ?? 0}
          </div>
          <div className="lab">Tổng số bài tập</div>
        </div>
        <div className="mcol">
          <div className="num">
            {item.setCount ?? 0}
          </div>
          <div className="lab">Tổng số set</div>
        </div>
        <div className="mcol">
          <div className="num">
            {item.repCount ?? 0}
          </div>
          <div className="lab">Tổng số reps</div>
        </div>
        <div className="mcol">
          <div className="num calo">
            <i className="fa-solid fa-fire-flame-curved" />{" "}
            {nf.format(item.kcal || 0)} kcal
          </div>
          <div className="lab">
            Tổng lượng Calorie đốt
          </div>
        </div>
      </div>
    </div>
  );
}

// Card "Lịch tập gợi ý đã lưu" – giống hệt box ở SuggestPlanList
function SavedSuggestItem({ plan, onOpenDetail, onAskUnsave }) {
  const sessionsCount = plan.sessionsCount ?? 0;
  const cate = plan.category || "{Phân loại}";
  const lv = plan.level || "{Mức độ}";
  const go = plan.goal || "{Mục tiêu}";

  return (
    <div
      className="spl-item"
      onClick={onOpenDetail}
    >
      {/* Hình ảnh bên trái */}
      <div className="spl-img">
        {plan.imageUrl ? (
          <img
            src={toAbs(plan.imageUrl)}
            alt={plan.name}
          />
        ) : (
          <div className="spl-thumb-fallback">
            <i className="fa-regular fa-image" />
          </div>
        )}
      </div>

      {/* Thông tin chính */}
      <div className="spl-main">
        <div className="spl-plan-title">
          {plan.name || "(Không tên)"}
        </div>
        <div className="spl-plan-note">
          Lịch tập {sessionsCount} buổi
        </div>
        <div className="spl-plan-meta">
          {cate} - {lv} - {go}
        </div>
      </div>

      {/* Nút ĐÃ LƯU bên phải */}
      <div
        className="spl-actions"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="spl-save-btn saved"
          onClick={(e) => {
            e.stopPropagation();
            onAskUnsave();
          }}
        >
          Đã lưu
        </button>
      </div>
    </div>
  );
}
