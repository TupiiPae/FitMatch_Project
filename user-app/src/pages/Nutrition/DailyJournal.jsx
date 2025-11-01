// src/pages/Nutrition/DailyJournal.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import dayjs from "dayjs";
import { getDayLogs, deleteLog, getStreak, getWater, incWater } from "../../api/nutrition";
import "./DailyJournal.css";
import { toast } from "react-toastify";
import api from "../../lib/api";

// Import logic tìm kiếm và thêm món ăn
import { searchFoods, addLog } from "../../api/foods";

const HOURS = Array.from({ length: 18 }, (_, i) => 6 + i); // 6..23

// ===== Helper giống Account.jsx =====
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => { if (!u) return u; try { return new URL(u, API_ORIGIN).toString(); } catch { return u; } };
const PLACEHOLDER = "/images/food-placeholder.jpg";

// ====== NEW: helper hiển thị theo quantity ======
const round1 = (v) => Math.round(v * 10) / 10;
const toNum = (v, def = 0) => (v == null || v === "" || isNaN(+v) ? def : +v);

// --- Helper tìm kiếm (từ RecordMeal) ---
const vnNorm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();


export default function DailyJournal() {
  const [date, setDate] = useState(() => dayjs().format("YYYY-MM-DD"));
  const [weekDays, setWeekDays] = useState([]);
  const [curDow, setCurDow] = useState(dayjs(date).day()); // 0..6 (CN..T7)
  const [streak, setStreak] = useState(0);
  const [hot, setHot] = useState(false);

  // logs từ DB
  const [logs, setLogs] = useState([]);
  // totals/targets từ DB
  const [totals, setTotals] = useState({ kcal: 0, proteinG: 0, carbG: 0, fatG: 0, sugarG: 0, saltG: 0, fiberG: 0 });
  const [targets, setTargets] = useState({ kcal: 0, proteinG: 0, carbG: 0, fatG: 0, sugarG: 0, saltG: 0, fiberG: 0 });

  const [waterMl, setWaterMl] = useState(0);
  const [stepMl, setStepMl] = useState(100);

  // === State cho Modal Thêm Món Ăn ===
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState(null);
  // ===================================

  function calcWeek(d) {
    const base = dayjs(d);
    const start = base.startOf("week"); // CN
    const arr = Array.from({ length: 7 }, (_, i) => start.add(i, "day"));
    setWeekDays(arr);
    setCurDow(base.day());
  }

  // --- GHIM DỮ LIỆU DB VÀO BIẾN ---
  async function load() {
    const { data } = await getDayLogs(date);
    const safeLogs = (data?.items || []).map((it) => {
      const food = it.food || {};
      const foodAbs = food.imageUrl ? toAbs(food.imageUrl) : PLACEHOLDER;
      return { ...it, hour: Number(it.hour), quantity: Number(it.quantity ?? 1), massG: it.massG ?? null, food, foodAbs };
    });
    setLogs(safeLogs);
    const t = data?.totals || {};
    setTotals({
      kcal: Number(t.kcal || 0), proteinG: Number(t.proteinG || 0), carbG: Number(t.carbG || 0), fatG: Number(t.fatG || 0),
      sugarG: Number(t.sugarG || 0), saltG: Number(t.saltG || 0), fiberG: Number(t.fiberG || 0),
    });
    const g = data?.targets || {};
    setTargets({
      kcal: Number(g.kcal || 0), proteinG: Number(g.proteinG || 0), carbG: Number(g.carbG || 0), fatG: Number(g.fatG || 0),
      sugarG: Number(g.sugarG || 0), saltG: Number(g.saltG || 0), fiberG: Number(g.fiberG || 0),
    });
  }

  async function loadStreak() {
    const { data } = await getStreak();
    const s = Number(data?.streak || 0);
    setStreak(s);
    setHot(s >= 2);
  }
  async function loadWater() {
    const { data } = await getWater(date);
    setWaterMl(Number(data?.amountMl || 0));
  }

  useEffect(() => { calcWeek(date); }, [date]);
  useEffect(() => { load(); loadWater(); /* eslint-disable-next-line */ }, [date]);
  useEffect(() => { loadStreak(); }, []);

  const logsByHour = useMemo(() => {
    const map = {};
    for (const h of HOURS) map[h] = [];
    for (const it of logs) {
      if (map.hasOwnProperty(it.hour)) map[it.hour].push(it);
    }
    return map;
  }, [logs]);

  async function onDelete(logId) {
    try {
      // (Thêm confirm)
      if (!window.confirm("Bạn có chắc muốn xóa món ăn này khỏi nhật ký?")) {
        return;
      }
      await deleteLog(logId);
      await load();
      toast.success("Xóa khỏi nhật ký thành công");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Xóa khỏi nhật ký thất bại");
    }
  }

  function pct(v, t) { if (!t) return 0; const p = (v / t) * 100; return Math.max(0, Math.min(100, p)); }

  async function waterDelta(delta) {
    const want = Math.max(0, Math.min(10000, waterMl + delta));
    const toApply = want - waterMl;
    if (toApply === 0) return;
    await incWater({ date, deltaMl: toApply });
    setWaterMl(want);
  }

  // === Hàm điều khiển Modal ===
  const handleOpenAddModal = (hour) => {
    setSelectedHour(hour);
    setAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setAddModalOpen(false);
    setSelectedHour(null);
  };

  const handleFoodAdded = () => {
    handleCloseAddModal();
    load(); // Tải lại nhật ký sau khi thêm
  };
  // =============================

  return (
    <div className="dj-wrap">
      <div className="dj-container">
        {/* TOP BAR */}
        <div className="dj-bar">
          <div className="left">
            <i className="fa-regular fa-calendar-days"></i>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          <div className="week">
            {weekDays.map((d, i) => (
              <button key={i}
                className={`wbtn ${dayjs(date).isSame(d, "day") ? "on" : ""}`}
                onClick={() => setDate(d.format("YYYY-MM-DD"))}
              >
                {["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.day()]}
              </button>
            ))}
          </div>

          <div className="right">
            <i className={`fa-solid fa-fire ${hot ? "hot" : "cold"}`}></i>
            <span className="streak-num">{streak}</span>
          </div>
        </div>

        {/* BODY */}
        <div className="dj-grid">
          {/* LEFT main (2/3) */}
          <div className="dj-main">
            <div className="col-title">Nhật ký dinh dưỡng</div>
            
            {/* === TIÊU ĐỀ GRID (ĐÃ THÊM) === */}
            <div className="dj-grid-header">
              <div className="h-col-1">Thời gian</div>
              <div className="h-col-2">Món ăn</div>
              <div className="h-col-3">Thêm</div>
            </div>
            {/* === HẾT TIÊU ĐỀ GRID === */}

            <div className="hour-grid">
              {HOURS.map(h => (
                <div key={h} className="hour-row" style={{ minHeight: (logsByHour[h]?.length ? "auto" : "50px") }}>
                  <div className="hh">{h}:00</div>
                  <div className="entries">
                    {logsByHour[h].map(item => {
                      const q = toNum(item.quantity, 1);
                      const unit = item.food?.unit || "g";
                      const baseMass = (item.massG ?? item.food?.massG);
                      const massShow = baseMass != null ? Math.round(toNum(baseMass, 0) * q) : null;
                      const kcalBase = toNum(item.food?.kcal, NaN);
                      const kcalShow = isNaN(kcalBase) ? null : Math.round(kcalBase * q);

                      return (
                        <div key={item._id} className="entry">
                          <img src={item.foodAbs || PLACEHOLDER} alt={item.food?.name} />
                          <div className="einfo">
                            <div className="etitle">{item.food?.name}</div>
                            <div className="esub">
                              {massShow != null ? `${massShow} ${unit}` : "-"} · {kcalShow != null ? `${kcalShow} cal` : "- cal"} · x{q}
                            </div>
                          </div>
                          <button className="edel" title="Xoá" onClick={() => onDelete(item._id)}>
                            <i className="fa-regular fa-trash-can"></i>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {/* === NÚT THÊM MÓN ĂN MỚI === */}
                  <div className="hour-add">
                    <button 
                      title={`Thêm món ăn lúc ${h}:00`}
                      onClick={() => handleOpenAddModal(h)}
                    >
                      <i className="fa-solid fa-plus"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT sidebar (1/3) */}
          <div className="dj-side">
            {/* ======= BẢNG GIÁ TRỊ ĐA LƯỢNG MỚI ======= */}
            <div className="panel macro">
              <div className="cal-wrapper">
                <div className="cal-ring">
                  {(() => {
                    const size = 132;
                    const stroke = 10;
                    const r = (size - stroke) / 2;
                    const C = 2 * Math.PI * r;
                    const ratio = (targets.kcal || 0) > 0 ? (totals.kcal || 0) / targets.kcal : 0;
                    const progress = Math.max(0, Math.min(1, ratio));
                    const dashOffset = C * (1 - progress);
                    return (
                      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                        <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" strokeWidth={stroke} fill="none" />
                        <circle cx={size / 2} cy={size / 2} r={r} className="ring-fg" strokeWidth={stroke} fill="none" strokeDasharray={C} strokeDashoffset={dashOffset} strokeLinecap="round" />
                      </svg>
                    );
                  })()}
                  <div className="cal-center">
                    <div className="cc-label">Calorie</div>
                    <div className="cc-val">
                      {Math.round(totals.kcal || 0)}
                      <span className="cc-unit">/{Math.round(targets.kcal || 0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="macro-grid">
                <div className="col">
                  <div className="mitem">
                    <div className="mhead">
                      <span>Chất đạm</span>
                      <span className="mval">{round1(totals.proteinG || 0)}/{Math.round(targets.proteinG || 0)}g</span>
                    </div>
                    <div className="mbar red"><span style={{ width: `${pct(totals.proteinG, targets.proteinG)}%` }} /></div>
                  </div>
                  <div className="mitem">
                    <div className="mhead">
                      <span>Đường bột</span>
                      <span className="mval">{round1(totals.carbG || 0)}/{Math.round(targets.carbG || 0)}g</span>
                    </div>
                    <div className="mbar purple"><span style={{ width: `${pct(totals.carbG, targets.carbG)}%` }} /></div>
                  </div>
                  <div className="mitem">
                    <div className="mhead">
                      <span>Chất béo</span>
                      <span className="mval">{round1(totals.fatG || 0)}/{Math.round(targets.fatG || 0)}g</span>
                    </div>
                    <div className="mbar green"><span style={{ width: `${pct(totals.fatG, targets.fatG)}%` }} /></div>
                  </div>
                </div>
                <div className="col">
                  <div className="mitem">
                    <div className="mhead">
                      <span>Muối</span>
                      <span className="mval">{round1(totals.saltG || 0)}/{Math.round(targets.saltG || 0)}g</span>
                    </div>
                    <div className="mbar gray"><span style={{ width: `${pct(totals.saltG, targets.saltG)}%` }} /></div>
                  </div>
                  <div className="mitem">
                    <div className="mhead">
                      <span>Đường</span>
                      <span className="mval">{round1(totals.sugarG || 0)}/{Math.round(targets.sugarG || 0)}g</span>
                    </div>
                    <div className="mbar orange"><span style={{ width: `${pct(totals.sugarG, targets.sugarG)}%` }} /></div>
                  </div>
                  <div className="mitem">
                    <div className="mhead">
                      <span>Chất xơ</span>
                      <span className="mval">{round1(totals.fiberG || 0)}/{Math.round(targets.fiberG || 0)}g</span>
                    </div>
                    <div className="mbar teal"><span style={{ width: `${pct(totals.fiberG, targets.fiberG)}%` }} /></div>
                  </div>
                </div>
              </div>
            </div>

            {/* ======= NƯỚC UỐNG ======= */}
            <div className="panel water">
              <div className="wtop">
                <div className="wleft">
                  <i className="fa-solid fa-glass-water"></i>
                  <div>
                    <div className="wlabel">Lượng nước</div>
                    <div className="wval">{waterMl} ml</div>
                  </div>
                </div>

                <div className="wctl">
                  <button type="button" onClick={() => waterDelta(-stepMl)}>–</button>
                  <input
                    type="number"
                    min="50" max="10000" step="50"
                    value={stepMl}
                    onChange={e => setStepMl(Math.max(50, Math.min(10000, +e.target.value || 100)))}
                  />
                  <button type="button" onClick={() => waterDelta(+stepMl)}>+</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* === MODAL THÊM MÓN ĂN === */}
      {isAddModalOpen && (
        <FoodSearchModal
          date={date}
          hour={selectedHour}
          onClose={handleCloseAddModal}
          onFoodAdded={handleFoodAdded}
        />
      )}
    </div>
  );
}


// ####################################################################
// #####          COMPONENT MODAL TÌM KIẾM & THÊM MÓN ĂN          #####
// ####################################################################

const HOUR_OPTIONS_MODAL = Array.from({ length: 18 }, (_, i) => 6 + i); // 6..23

function FoodSearchModal({ date: initialDate, hour: initialHour, onClose, onFoodAdded }) {
  
  // === State của Tìm kiếm ===
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [skip, setSkip] = useState(0);
  const [limit] = useState(20);
  const [hasMore, setHasMore] = useState(false);
  const searchTimer = useRef(null);

  // === State của Modal "Thêm" (lấy từ RecordMeal) ===
  const [showAdd, setShowAdd] = useState(false);
  const [addFood, setAddFood] = useState(null); // Món ăn đang được chọn để thêm
  const [quantity, setQuantity] = useState(1);
  const [massG, setMassG] = useState(""); // massG không dùng nữa
  const [date, setDate] = useState(initialDate);
  const [hour, setHour] = useState(initialHour);

  // --- Logic Tìm kiếm (từ RecordMeal) ---
  async function load(reset = false) {
    setLoading(true);
    try {
      const params = {
        q: q || undefined,
        scope: "all",
        limit,
        skip: reset ? 0 : skip
      };
      const { data } = await searchFoods(params);
      const list = data?.items || [];
      setHasMore(!!data?.hasMore);
      setItems(reset ? list : [...items, ...list]);
      setSkip(reset ? list.length : skip + list.length);
    } finally { setLoading(false); }
  }

  // Tải lần đầu khi mở modal
  useEffect(() => { load(true); /* eslint-disable-next-line */ }, []);
  
  // Tự động tìm kiếm khi gõ
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      load(true);
    }, 300); // debounce 300ms
    return () => clearTimeout(searchTimer.current);
  /* eslint-disable-next-line */
  }, [q]);

  // Lọc kết quả ngay lập tức
  const filteredItems = useMemo(() => {
    const key = vnNorm(q);
    if (!key) return items;
    return items.filter(it => vnNorm(it.name).includes(key));
  }, [items, q]);


  // --- Logic Modal "Thêm" (từ RecordMeal) ---
  
  // Mở modal "Thêm" (bước 2)
  async function openAdd(it) {
    setAddFood(it);
    setQuantity(1);
    // setMassG(it.massG ?? ""); // Bỏ massG
    // Giữ date và hour từ props
    setShowAdd(true);
  }

  // Xác nhận thêm
  async function confirmAdd() {
    try {
      await addLog({ 
        foodId: addFood._id, 
        date, 
        hour, 
        quantity, 
        massG: null // Luôn null
      });
      setShowAdd(false);
      onFoodAdded(); // Gọi callback để đóng modal và refresh
      toast.success("Thêm vào nhật ký thành công");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Thêm vào nhật ký thất bại");
    }
  }

  // Hiển thị macro
  const gStr = (x) => (x ?? "-");
  const f = addFood || {};
  const qNum = Number(quantity || 1);
  const fmt = (v) => (v == null ? "-" : Math.round(v * qNum * 10) / 10);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        
        {/* === Giao diện Bước 1: TÌM KIẾM === */}
        {!showAdd && (
          <>
            <h3 className="modal-title">
              Thêm món ăn lúc {hour}:00
              <button className="modal-close" onClick={onClose}>&times;</button>
            </h3>
            
            <div className="modal-search-bar">
              <i className="fa-solid fa-magnifying-glass"></i>
              <input
                placeholder="Tìm kiếm thực phẩm hoặc món ăn"
                value={q}
                onChange={e => setQ(e.target.value)}
                autoFocus
              />
            </div>

            <div className="modal-nm-list">
              {filteredItems.map(it => (
                <div key={it._id} className="modal-nm-item">
                  <img src={toAbs(it.imageUrl) || PLACEHOLDER} alt={it.name} />
                  <div className="info">
                    <div className="title">{it.name}</div>
                    <div className="sub">
                      {it.portionName || "Khẩu phần"} · {it.massG ?? "-"} {it.unit || "g"} · {it.kcal ?? "-"} cal
                    </div>
                    <div className="macro">
                      <span className="protein"><i className="fa-solid fa-drumstick-bite"></i> {gStr(it.proteinG)} g</span>
                      <span className="carb"><i className="fa-solid fa-bread-slice"></i> {gStr(it.carbG)} g</span>
                      <span className="fat"><i className="fa-solid fa-bacon"></i> {gStr(it.fatG)} g</span>
                    </div>
                  </div>
                  <div className="act">
                    <button className="add" onClick={() => openAdd(it)}>Thêm</button>
                  </div>
                </div>
              ))}
              {hasMore && (
                <div className="modal-more">
                  <button disabled={loading} onClick={() => load(false)}>
                    {loading ? "Đang tải..." : "Xem thêm"}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* === Giao diện Bước 2: XÁC NHẬN THÊM (từ RecordMeal) === */}
        {showAdd && addFood && (
          <>
            <div className="am-head">
              <button className="am-back" onClick={() => setShowAdd(false)}>
                <i className="fa-solid fa-arrow-left"></i> Quay lại
              </button>
              <div className="am-thumb-wrap">
                <img className="am-thumb" src={toAbs(addFood?.imageUrl) || PLACEHOLDER} alt={addFood?.name || "food"} />
              </div>
              <div className="am-hmeta">
                <h3 className="am-title">Thêm vào nhật ký</h3>
                <div className="am-sub">{addFood?.name}</div>
              </div>
            </div>

            <div className="am-when">
              <div className="am-when-item">
                <i className="fa-regular fa-calendar"></i>
                <div className="am-field">
                  <label>Ngày</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
              </div>
              <div className="am-when-item">
                <i className="fa-regular fa-clock"></i>
                <div className="am-field">
                  <label>Thời gian</label>
                  <select value={hour} onChange={e => setHour(+e.target.value)}>
                    {HOUR_OPTIONS_MODAL.map(h => <option key={h} value={h}>{`${h}:00`}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="am-qtygrid">
              <div className="am-qty">
                <label>Số lượng khẩu phần</label>
                <div className="am-qty-ctl">
                  <button type="button" onClick={() => setQuantity(q => Math.max(0.1, round1((q || 1) - 0.5)))}>–</button>
                  <input type="number" min="0.1" step="0.1" value={quantity} onChange={e => setQuantity(Math.max(0.1, +e.target.value || 1))} />
                  <button type="button" onClick={() => setQuantity(q => round1((q || 1) + 0.5))}>+</button>
                </div>
              </div>
              <div className="am-portion">
                <label>Khẩu phần (g)</label>
                <input type="text" value={addFood?.massG != null ? `${addFood.massG} g` : "-"} readOnly className="readonly" />
                <div className="am-note">* Khối lượng mặc định theo món</div>
              </div>
            </div>

            <div className="am-macros">
              <div className="am-macro calo"><div className="m-label">Calo</div><div className="m-val">{fmt(f.kcal)} <span>cal</span></div></div>
              <div className="am-macro protein"><div className="m-label">Đạm</div><div className="m-val">{fmt(f.proteinG)} <span>g</span></div></div>
              <div className="am-macro carb"><div className="m-label">Đường bột</div><div className="m-val">{fmt(f.carbG)} <span>g</span></div></div>
              <div className="am-macro fat"><div className="m-label">Béo</div><div className="m-val">{fmt(f.fatG)} <span>g</span></div></div>
            </div>

            <div className="am-actions">
              <button className="btn ghost" onClick={() => setShowAdd(false)}>Hủy</button>
              <button className="btn primary" onClick={confirmAdd}>Xác nhận thêm</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

