// user-app/src/pages/Workout/WorkoutList.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./WorkoutList.css";
import { listMyWorkouts, listSavedWorkouts, deletePlan } from "../../api/workouts";
import { toast } from "react-toastify";

function mapPlanToUi(p) {
  const t = p?.totals || {};
  const names = (p?.items || [])
    .map(it => it?.exerciseName || it?.name)
    .filter(Boolean);
  const raw = names.join(", ");
  const MAX = 120;
  const note = raw.length > MAX ? raw.slice(0, MAX).replace(/\s+[^,]*$/, "") + "…" : raw;

  return {
    _id: p._id,
    title: p.name || "(Không tên)",
    note,
    exCount: t.exercises ?? 0,
    setCount: t.sets ?? 0,
    repCount: t.reps ?? 0,
    kcal: t.kcal ?? t.calories ?? p.totalKcal ?? 0,   // <— tổng calorie đã lưu
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
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(false);

  const [menuId, setMenuId] = useState(null);
  const [confirmDel, setConfirmDel] = useState({ open: false, id: null, name: "" });

  const headRef = useRef(null);
  const nf = new Intl.NumberFormat("vi-VN");

  async function loadAll() {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        listMyWorkouts({ q, limit: 50, skip: 0 }),
        listSavedWorkouts({ q, limit: 50, skip: 0 }),
      ]);
      const pick = (r) => r?.data?.data || r?.data || r || {};
      setMine((pick(a).items || []).map(mapPlanToUi));
      setSaved((pick(b).items || []).map(mapPlanToUi));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { const t = setTimeout(loadAll, 250); return () => clearTimeout(t); }, [q]);

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

  const openConfirmDelete = (it) => setConfirmDel({ open: true, id: it._id, name: it.title });
  const closeConfirmDelete = () => setConfirmDel({ open: false, id: null, name: "" });
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

  return (
    <div className="wl-wrap">
      {/* ===== HEAD ===== */}
      <div className="wl-head" ref={headRef} onClick={(e) => e.stopPropagation()}>
        <div className="search">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            placeholder="Tìm lịch tập"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className={`filter ${filterOpen ? "open" : ""}`} onClick={(e) => e.stopPropagation()}>
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
                Đã lưu
              </label>
            </div>
          )}
        </div>

        <Link to="/tap-luyen/lich-cua-ban/tao" className="create-btn">
          Tạo lịch tập mới
        </Link>
      </div>

      {/* ===== LIST FRAME ===== */}
      <div className="wl-list-frame">
        {/* Mine */}
        <div className="wl-section">
          <div className="wl-sec-head">
            <div className="wl-sec-title">Lịch tập tạo bởi bạn</div>
          </div>

          {showMine ? (
            <div className="wl-list">
              {listMine.length === 0 ? (
                <div className="wl-empty">
                  {loading ? "Đang tải..." : "Chưa có lịch tập nào do bạn tạo."}
                </div>
              ) : (
                listMine.map((w) => (
                  <WorkoutItem
                    key={w._id}
                    item={w}
                    mine
                    menuOpen={menuId === w._id}
                    onToggleMenu={() => setMenuId(menuId === w._id ? null : w._id)}
                    onDelete={() => openConfirmDelete(w)}
                    onEdit={() => { 
                      setMenuId(null);
                      // mở WorkoutCreate ở chế độ edit
                      // dùng query param cho an toàn router
                      nav(`/tap-luyen/lich-cua-ban/tao?id=${w._id}`);
                    }}
                    onMarkDone={() => { toast.success("Đã đánh dấu là đã thực hiện"); setMenuId(null); }}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="wl-muted">Đang ẩn danh sách này (bỏ lọc để xem).</div>
          )}
        </div>

        <hr className="wl-line" />

        {/* Saved */}
        <div className="wl-section">
          <div className="wl-sec-head">
            <div className="wl-sec-title">Lịch tập gợi ý đã lưu</div>
          </div>

          {showSaved ? (
            <div className="wl-list">
              {listSaved.length === 0 ? (
                <div className="wl-empty">
                  {loading ? "Đang tải..." : "Chưa lưu lịch tập gợi ý nào."}
                </div>
              ) : (
                listSaved.map((w) => (
                  <WorkoutItem
                    key={w._id}
                    item={w}
                    menuOpen={menuId === w._id}
                    onToggleMenu={() => setMenuId(menuId === w._id ? null : w._id)}
                    onDelete={null}
                    onEdit={null}
                    onMarkDone={() => { toast.success("Đã đánh dấu là đã thực hiện"); setMenuId(null); }}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="wl-muted">Đang ẩn danh sách này (bỏ lọc để xem).</div>
          )}
        </div>
      </div>

      {/* confirm delete */}
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
                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
              </div>
            </div>
            <div className="cm-body">
              Bạn chắc chắn muốn xóa <b>{confirmDel.name}</b>?<br />
              Thao tác này không thể hoàn tác.
            </div>
            <div className="cm-foot">
              <button className="btn ghost" onClick={closeConfirmDelete}>Hủy</button>
              <button className="btn bad" onClick={confirmDeleteNow}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkoutItem({ item, mine, menuOpen, onToggleMenu, onDelete, onEdit, onMarkDone }) {
  const nav = useNavigate();
  const goDetail = () => nav(`/tap-luyen/tao-lich/${item._id}`); // giữ placeholder nếu bạn có trang chi tiết

  const nf = new Intl.NumberFormat("vi-VN");

  return (
    <div className="wl-item" onClick={goDetail}>
      <div className="wl-top">
        <div className="wl-tmeta">
          <div className="wl-title">{item.title}</div>
          {!!item.note && <div className="wl-note" title={item.note}>{item.note}</div>}
        </div>

        <div className="wl-acts" onClick={(e) => e.stopPropagation()}>
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
              <div className="menuWL" role="menu" onClick={(e) => e.stopPropagation()}>
                {mine && onDelete && (
                  <button className="menu-item danger" onClick={onDelete}>Xóa</button>
                )}
                {mine && onEdit && (
                  <button className="menu-item" onClick={onEdit}>Chỉnh sửa</button>
                )}
                <button className="menu-item" onClick={onMarkDone}>Đánh dấu đã thực hiện</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="wl-metrics" aria-label="Tóm tắt lịch tập">
        <div className="mcol">
          <div className="num">{item.exCount ?? 0}</div>
          <div className="lab">Tổng số bài tập</div>
        </div>
        <div className="mcol">
          <div className="num">{item.setCount ?? 0}</div>
          <div className="lab">Tổng số set</div>
        </div>
        <div className="mcol">
          <div className="num">{item.repCount ?? 0}</div>
          <div className="lab">Tổng số reps</div>
        </div>
        <div className="mcol">
          <div className="num calo"><i className="fa-solid fa-fire-flame-curved" /> {nf.format(item.kcal || 0)} kcal</div>
          <div className="lab">Tổng lượng Calorie đốt</div>
        </div>
      </div>
    </div>
  );
}
