import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./WorkoutList.css";
import { listMyWorkouts, listSavedWorkouts } from "../../api/workouts";

// Map từ schema BE -> UI item
function mapPlanToUi(p) {
  const t = p?.totals || {};
  return {
    _id: p._id,
    title: p.name || "(Không tên)",
    exCount: t.exercises ?? 0,
    setCount: t.sets ?? 0,
    repCount: t.reps ?? 0,
    updatedAt: p.updatedAt,
  };
}

export default function WorkoutList() {
  const nav = useNavigate();

  // search + filter
  const [q, setQ] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [showMine, setShowMine] = useState(true);
  const [showSaved, setShowSaved] = useState(true);

  // data
  const [mine, setMine] = useState([]);
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(false);

  const headRef = useRef(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([
        listMyWorkouts({ q, limit: 50, skip: 0 }),
        listSavedWorkouts({ q, limit: 50, skip: 0 }),
      ]);
      setMine((a.items || []).map(mapPlanToUi));
      // Chưa có data gợi ý -> vẫn map nhưng nếu rỗng sẽ hiển thị “chưa có”
      setSaved((b.items || []).map(mapPlanToUi));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); /* mount */ }, []);
  useEffect(() => {
    const t = setTimeout(loadAll, 250);
    return () => clearTimeout(t);
  }, [q]);

  // click outside: đóng dropdown
  useEffect(() => {
    const fn = (e) => { if (!headRef.current?.contains(e.target)) setFilterOpen(false); };
    document.addEventListener("click", fn);
    return () => document.removeEventListener("click", fn);
  }, []);

  const listMine = useMemo(() => mine, [mine]);
  const listSaved = useMemo(() => saved, [saved]);

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

        {/* Filter dropdown giống RecordMeal */}
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
        {/* Mục “Tạo bởi bạn” — luôn có tiêu đề */}
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
                listMine.map((w) => <WorkoutItem key={w._id} item={w} mine />)
              )}
            </div>
          ) : (
            <div className="wl-muted">Đang ẩn danh sách này (bỏ lọc để xem).</div>
          )}
        </div>

        {/* Line phân cách 2 danh sách */}
        <hr className="wl-line" />

        {/* Mục “Gợi ý đã lưu” — luôn có tiêu đề */}
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
                listSaved.map((w) => <WorkoutItem key={w._id} item={w} />)
              )}
            </div>
          ) : (
            <div className="wl-muted">Đang ẩn danh sách này (bỏ lọc để xem).</div>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkoutItem({ item, mine }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const goDetail = () => nav(`/tap-luyen/tao-lich/${item._id}`); // TODO: đổi sang route detail của bạn

  return (
    <div className="wl-item" onClick={goDetail}>
      <div className="wl-info">
        <div className="wl-title">{item.title}</div>
        <div className="wl-chips">
          <span className="chip"><b>{item.exCount ?? 0}</b> bài</span>
          <span className="chip"><b>{item.setCount ?? 0}</b> set</span>
          <span className="chip"><b>{item.repCount ?? 0}</b> reps</span>
        </div>
      </div>

      <div className="wl-acts" onClick={(e) => e.stopPropagation()}>
        {mine && (
          <div className="more-wrap">
            <button
              className="more-btn"
              onClick={() => setOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={open}
              title="Tùy chọn"
            >
              <i className="fa-solid fa-ellipsis-vertical"></i>
            </button>
            {open && (
              <div className="menu" role="menu">
                <button className="menu-item" onClick={() => alert("Chỉnh sửa")}>
                  Chỉnh sửa
                </button>
                <button className="menu-item danger" onClick={() => alert("Xóa")}>
                  Xóa
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
