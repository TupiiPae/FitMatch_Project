// src/pages/Nutrition/DailyJournal.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import { getDayLogs, deleteLog, getStreak, getWater, incWater } from "../../api/nutrition";
import "./DailyJournal.css";
import { toast } from "react-toastify";
import api from "../../lib/api";

// === Imports cho MUI Date Picker ===
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

// Import logic tìm kiếm và thêm món ăn
import { searchFoods, addLog } from "../../api/foods";

const HOURS = Array.from({ length: 18 }, (_, i) => 6 + i); // 6..23

// ===== Helper =====
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};
const PLACEHOLDER = "/images/food-placeholder.jpg";
const round1 = (v) => Math.round(v * 10) / 10;
const toNum = (v, def = 0) => (v == null || v === "" || isNaN(+v) ? def : +v);

// Chuẩn hóa/định dạng ngày
const fmtDisplay = (iso) => (iso ? dayjs(iso).format("DD/MM/YYYY") : "");
const parseDisplayToISO = (str) => {
  // Cho phép nhập dd/mm/yyyy
  const m = String(str || "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [_, dd, mm, yyyy] = m;
  const iso = dayjs(`${yyyy}-${mm}-${dd}`, "YYYY-MM-DD", true);
  return iso.isValid() ? iso.format("YYYY-MM-DD") : null;
};

// --- Helper tìm kiếm (từ RecordMeal) ---
const vnNorm = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export default function DailyJournal() {
  const [date, setDate] = useState(() => dayjs().format("YYYY-MM-DD")); // ISO
  const [weekDays, setWeekDays] = useState([]);
  const [streak, setStreak] = useState(0);
  const [hot, setHot] = useState(false);

  // logs từ DB
  const [logs, setLogs] = useState([]);
  // totals/targets từ DB
  const [totals, setTotals] = useState({
    kcal: 0,
    proteinG: 0,
    carbG: 0,
    fatG: 0,
    sugarG: 0,
    saltG: 0,
    fiberG: 0,
  });
  const [targets, setTargets] = useState({
    kcal: 0,
    proteinG: 0,
    carbG: 0,
    fatG: 0,
    sugarG: 0,
    saltG: 0,
    fiberG: 0,
  });

  const [waterMl, setWaterMl] = useState(0);
  const [stepMl, setStepMl] = useState(100);

  // === State cho Modal Thêm Món Ăn ===
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState(null);

  // ==== Logic cho Date input (top bar) ====
  const onTopDateHiddenChange = (e) => {
    const iso = e.target.value; // YYYY-MM-DD
    if (iso) setDate(iso);
  };

  function calcWeek(dISO) {
    const base = dayjs(dISO);
    const start = base.startOf("week"); // CN
    const arr = Array.from({ length: 7 }, (_, i) => start.add(i, "day"));
    setWeekDays(arr);
  }

  // --- GHIM DỮ LIỆU DB VÀO BIẾN ---
  async function load() {
    const { data } = await getDayLogs(date);
    const safeLogs = (data?.items || []).map((it) => {
      const food = it.food || {};
      const foodAbs = food.imageUrl ? toAbs(food.imageUrl) : PLACEHOLDER;
      return {
        ...it,
        hour: Number(it.hour),
        quantity: Number(it.quantity ?? 1),
        massG: it.massG ?? null,
        food,
        foodAbs,
      };
    });
    setLogs(safeLogs);
    const t = data?.totals || {};
    setTotals({
      kcal: Number(t.kcal || 0),
      proteinG: Number(t.proteinG || 0),
      carbG: Number(t.carbG || 0),
      fatG: Number(t.fatG || 0),
      sugarG: Number(t.sugarG || 0),
      saltG: Number(t.saltG || 0),
      fiberG: Number(t.fiberG || 0),
    });
    const g = data?.targets || {};
    setTargets({
      kcal: Number(g.kcal || 0),
      proteinG: Number(g.proteinG || 0),
      carbG: Number(g.carbG || 0),
      fatG: Number(g.fatG || 0),
      sugarG: Number(g.sugarG || 0),
      saltG: Number(g.saltG || 0),
      fiberG: Number(g.fiberG || 0),
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

  useEffect(() => {
    calcWeek(date);
  }, [date]);

  useEffect(() => {
    load();
    loadWater();
    // eslint-disable-next-line
  }, [date]);

  useEffect(() => {
    loadStreak();
  }, []);

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
      if (!window.confirm("Bạn có chắc muốn xóa món ăn này khỏi nhật ký?")) return;
      await deleteLog(logId);
      await load();
      toast.success("Xóa khỏi nhật ký thành công");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Xóa khỏi nhật ký thất bại");
    }
  }

  function pct(v, t) {
    if (!t) return 0;
    const p = (v / t) * 100;
    return Math.max(0, Math.min(100, p));
  }

  async function waterDelta(delta) {
    const want = Math.max(0, Math.min(10000, waterMl + delta));
    const toApply = want - waterMl;
    if (toApply === 0) return;
    await incWater({ date, deltaMl: toApply });
    setWaterMl(want);
  }

  // === Modal Add ===
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
    load();
  };

  // ====== Popup CHỈNH LOG trên timeline ======
  const [showEdit, setShowEdit] = useState(false);
  const [editLog, setEditLog] = useState(null);
  const [editQty, setEditQty] = useState(1);
  const [editHour, setEditHour] = useState(12);

  const openEditLog = (log) => {
    setEditLog(log);
    setEditQty(Number(log?.quantity || 1));
    setEditHour(Number(log?.hour || 12));
    setShowEdit(true);
  };
  const closeEditLog = () => {
    setShowEdit(false);
    setEditLog(null);
  };

  const saveEditLog = async () => {
    if (!editLog) return;
    try {
      // Chưa có API update ⇒ delete + add
      await deleteLog(editLog._id);
      await addLog({
        foodId: editLog.food?._id || editLog.food,
        date,
        hour: editHour,
        quantity: editQty,
        massG: null,
      });
      toast.success("Cập nhật món trong nhật ký");
      closeEditLog();
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Cập nhật thất bại");
    }
  };

  return (
    <div className="dj-page">
      {/* Banner full width */}
      <div className="dj-banner">
        <img
          src="/images/dailyjournal-banner.png"
          alt="Daily Journal"
        />
      </div>

      <div className="dj-wrap">
        <div className="dj-container">
          {/* Thanh bar nằm trên dj-grid */}
          <div className="dj-bar">
            <div className="left">
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  format="DD/MM/YYYY"
                  value={date ? dayjs(date) : null}
                  onChange={(newValue) => {
                    const newDateString = newValue
                      ? newValue.format("YYYY-MM-DD")
                      : "";
                    onTopDateHiddenChange({ target: { value: newDateString } });
                  }}
                  slotProps={{
                    textField: {
                      placeholder: "DD/MM/YYYY",
                      style: { width: 150 },
                      size: "small",
                    },
                  }}
                />
              </LocalizationProvider>
            </div>
            <div className="week">
              {weekDays.map((d, i) => (
                <button
                  key={i}
                  className={`wbtn ${
                    dayjs(date).isSame(d, "day") ? "on" : ""
                  }`}
                  onClick={() => setDate(d.format("YYYY-MM-DD"))}
                >
                  {["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.day()]}
                </button>
              ))}
            </div>

            <div className="right">
              <i className={`fa-solid fa-fire ${hot ? "hot" : "cold"}`} />
              <span className="streak-num">{streak}</span>
            </div>
          </div>

          {/* GRID 2/3 : 1/3 */}
          <div className="dj-grid">
            {/* LEFT main (2/3) */}
            <div className="dj-main">
              <div className="col-title">Nhật ký dinh dưỡng</div>

              {/* Grid header */}
              <div className="dj-grid-header">
                <div className="h-col-1">Thời gian</div>
                <div className="h-col-2">Món ăn</div>
                <div className="h-col-3">Thêm</div>
              </div>

              <div className="hour-grid">
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="hour-row"
                    style={{
                      minHeight: logsByHour[h]?.length ? "auto" : "50px",
                    }}
                  >
                    <div className="hh">{h}:00</div>
                    <div className="entries">
                      {logsByHour[h].map((item) => {
                        const q = toNum(item.quantity, 1);
                        const unit = item.food?.unit || "g";
                        const baseMass = item.massG ?? item.food?.massG;
                        const massShow =
                          baseMass != null
                            ? Math.round(toNum(baseMass, 0) * q)
                            : null;
                        const kcalBase = toNum(item.food?.kcal, NaN);
                        const kcalShow = isNaN(kcalBase)
                          ? null
                          : Math.round(kcalBase * q);

                        return (
                          <div
                            key={item._id}
                            className="entry"
                            onClick={() => openEditLog(item)}
                          >
                            <img
                              src={item.foodAbs || PLACEHOLDER}
                              alt={item.food?.name}
                            />
                            <div className="einfo">
                              <div className="etitle">{item.food?.name}</div>
                              <div className="esub">
                                {massShow != null
                                  ? `${massShow} ${unit}`
                                  : "-"}{" "}
                                ·{" "}
                                {kcalShow != null
                                  ? `${kcalShow} cal`
                                  : "- cal"}{" "}
                                · x{q}
                              </div>
                            </div>
                            <button
                              className="edel"
                              title="Xoá"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(item._id);
                              }}
                            >
                              <i className="fa-regular fa-trash-can" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    {/* Nút thêm */}
                    <div className="hour-add">
                      <button
                        title={`Thêm món ăn lúc ${h}:00`}
                        onClick={() => handleOpenAddModal(h)}
                      >
                        <i className="fa-solid fa-plus" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT sidebar (1/3) */}
            <div className="dj-side">
              {/* Macro panel */}
              <div className="panel macro">
                <div className="cal-wrapper">
                  <div className="cal-ring">
                    {(() => {
                      const size = 132;
                      const stroke = 10;
                      const r = (size - stroke) / 2;
                      const C = 2 * Math.PI * r;
                      const ratio =
                        (targets.kcal || 0) > 0
                          ? (totals.kcal || 0) / targets.kcal
                          : 0;
                      const progress = Math.max(0, Math.min(1, ratio));
                      const dashOffset = C * (1 - progress);
                      return (
                        <svg
                          width={size}
                          height={size}
                          viewBox={`0 0 ${size} ${size}`}
                        >
                          <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={r}
                            className="ring-bg"
                            strokeWidth={stroke}
                            fill="none"
                          />
                          <circle
                            cx={size / 2}
                            cy={size / 2}
                            r={r}
                            className="ring-fg"
                            strokeWidth={stroke}
                            fill="none"
                            strokeDasharray={C}
                            strokeDashoffset={dashOffset}
                            strokeLinecap="round"
                          />
                        </svg>
                      );
                    })()}
                    <div className="cal-center">
                      <div className="cc-label">Calorie</div>
                      <div className="cc-val">
                        {Math.round(totals.kcal || 0)}
                        <span className="cc-unit">
                          /{Math.round(targets.kcal || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="macro-grid">
                  <div className="col">
                    <div className="mitem">
                      <div className="mhead">
                        <span>Chất đạm</span>
                        <span className="mval">
                          {round1(totals.proteinG || 0)}/
                          {Math.round(targets.proteinG || 0)}g
                        </span>
                      </div>
                      <div className="mbar red">
                        <span
                          style={{
                            width: `${pct(
                              totals.proteinG,
                              targets.proteinG
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="mitem">
                      <div className="mhead">
                        <span>Đường bột</span>
                        <span className="mval">
                          {round1(totals.carbG || 0)}/
                          {Math.round(targets.carbG || 0)}g
                        </span>
                      </div>
                      <div className="mbar purple">
                        <span
                          style={{
                            width: `${pct(totals.carbG, targets.carbG)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="mitem">
                      <div className="mhead">
                        <span>Chất béo</span>
                        <span className="mval">
                          {round1(totals.fatG || 0)}/
                          {Math.round(targets.fatG || 0)}g
                        </span>
                      </div>
                      <div className="mbar green">
                        <span
                          style={{
                            width: `${pct(totals.fatG, targets.fatG)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col">
                    <div className="mitem">
                      <div className="mhead">
                        <span>Muối</span>
                        <span className="mval">
                          {round1(totals.saltG || 0)}/
                          {Math.round(targets.saltG || 0)}g
                        </span>
                      </div>
                      <div className="mbar gray">
                        <span
                          style={{
                            width: `${pct(totals.saltG, targets.saltG)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="mitem">
                      <div className="mhead">
                        <span>Đường</span>
                        <span className="mval">
                          {round1(totals.sugarG || 0)}/
                          {Math.round(targets.sugarG || 0)}g
                        </span>
                      </div>
                      <div className="mbar orange">
                        <span
                          style={{
                            width: `${pct(
                              totals.sugarG,
                              targets.sugarG
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="mitem">
                      <div className="mhead">
                        <span>Chất xơ</span>
                        <span className="mval">
                          {round1(totals.fiberG || 0)}/
                          {Math.round(targets.fiberG || 0)}g
                        </span>
                      </div>
                      <div className="mbar teal">
                        <span
                          style={{
                            width: `${pct(
                              totals.fiberG,
                              targets.fiberG
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nước uống */}
              <div className="panel water">
                <div className="wtop">
                  <div className="wleft">
                    <i className="fa-solid fa-glass-water" />
                    <div>
                      <div className="wlabel">Lượng nước</div>
                      <div className="wval">{waterMl} ml</div>
                    </div>
                  </div>

                  <div className="wctl">
                    <button type="button" onClick={() => waterDelta(-stepMl)}>
                      –
                    </button>
                    <div className="input-unit-wrapper">
                      <input
                        type="number"
                        min="50"
                        max="10000"
                        step="50"
                        value={stepMl}
                        onChange={(e) =>
                          setStepMl(
                            Math.max(
                              50,
                              Math.min(10000, +e.target.value || 100)
                            )
                          )
                        }
                        className="input-with-unit"
                      />
                      <span className="input-unit">ml</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => waterDelta(+stepMl)}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {/* end dj-side */}
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

      {/* === MODAL CHỈNH LOG TRÊN TIMELINE === */}
      {showEdit && editLog && (
        <div className="modal-backdrop" onClick={closeEditLog}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              Chỉnh sửa món trong nhật ký
              <button className="modal-close" onClick={closeEditLog}>
                &times;
              </button>
            </h3>

            {/* --- Ảnh và tên món --- */}
            <div className="am-head">
              <img
                className="am-thumb2"
                src={toAbs(editLog.food?.imageUrl) || PLACEHOLDER}
                alt={editLog.food?.name || "food"}
              />
              <div className="am-info">
                <div className="am-name">{editLog.food?.name}</div>
                <div className="am-sub">
                  {(editLog.food?.portionName || "Khẩu phần tiêu chuẩn")} ·{" "}
                  {editLog.food?.massG ?? "-"} {editLog.food?.unit || "g"} ·{" "}
                  {editLog.food?.kcal ?? "-"} cal
                </div>
              </div>
            </div>

            {/* --- Ngày + giờ --- */}
            <div className="am-when">
              <div className="am-when-item">
                <i className="fa-regular fa-calendar" />
                <div className="am-field">
                  <label>Ngày</label>
                  <input type="text" value={fmtDisplay(date)} readOnly />
                </div>
              </div>
              <div className="am-when-item">
                <i className="fa-regular fa-clock" />
                <div className="am-field">
                  <label>Thời gian</label>
                  <select
                    value={editHour}
                    onChange={(e) => setEditHour(+e.target.value)}
                  >
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {h}:00
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* --- Số lượng khẩu phần --- */}
            <div className="am-qtygrid">
              <div className="am-qty">
                <label>Số lượng khẩu phần</label>
                <div className="am-qty-ctl">
                  <button
                    type="button"
                    onClick={() =>
                      setEditQty((q) =>
                        Math.max(0.1, Math.round((q - 0.5) * 10) / 10)
                      )
                    }
                  >
                    –
                  </button>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={editQty}
                    onChange={(e) =>
                      setEditQty(Math.max(0.1, +e.target.value || 1))
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditQty((q) =>
                        Math.round((q + 0.5) * 10) / 10
                      )
                    }
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="am-portion">
                <label>Khẩu phần (g)</label>
                <input
                  type="text"
                  value={
                    editLog.food?.massG != null
                      ? `${Math.round(editLog.food.massG * editQty)} g`
                      : "-"
                  }
                  readOnly
                  className="readonly"
                />
                <div className="am-note">
                  * Khối lượng mặc định theo món
                </div>
              </div>
            </div>

            {/* --- Macro hiển thị theo số lượng --- */}
            <div className="am-macros">
              <div className="am-macro calo">
                <div className="m-label">Calo</div>
                <div className="m-val">
                  {Math.round((editLog.food?.kcal || 0) * editQty)}{" "}
                  <span>cal</span>
                </div>
              </div>
              <div className="am-macro protein">
                <div className="m-label">Đạm</div>
                <div className="m-val">
                  {Math.round(
                    (editLog.food?.proteinG || 0) * editQty * 10
                  ) / 10}{" "}
                  <span>g</span>
                </div>
              </div>
              <div className="am-macro carb">
                <div className="m-label">Đường bột</div>
                <div className="m-val">
                  {Math.round(
                    (editLog.food?.carbG || 0) * editQty * 10
                  ) / 10}{" "}
                  <span>g</span>
                </div>
              </div>
              <div className="am-macro fat">
                <div className="m-label">Béo</div>
                <div className="m-val">
                  {Math.round(
                    (editLog.food?.fatG || 0) * editQty * 10
                  ) / 10}{" "}
                  <span>g</span>
                </div>
              </div>
            </div>

            {/* --- Nút hành động --- */}
            <div className="am-actions">
              <button className="btn ghost" onClick={closeEditLog}>
                Đóng
              </button>
              <button className="btn primary" onClick={saveEditLog}>
                Cập nhật
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// #####     COMPONENT MODAL TÌM KIẾM & THÊM MÓN ĂN               #####

const HOUR_OPTIONS_MODAL = Array.from({ length: 18 }, (_, i) => 6 + i); // 6..23

function FoodSearchModal({ date: initialISO, hour: initialHour, onClose, onFoodAdded }) {
  // === State của Tìm kiếm ===
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [skip, setSkip] = useState(0);
  const [limit] = useState(20);
  const [hasMore, setHasMore] = useState(false);
  const searchTimer = useRef(null);

  // === State của Modal "Thêm" ===
  const [showAdd, setShowAdd] = useState(false);
  const [addFood, setAddFood] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [dateISO, setDateISO] = useState(initialISO); // ISO
  const [hour, setHour] = useState(initialHour);

  // === Logic cho Date input (trong modal) ===
  const onAddHiddenDateChange = (e) => {
    const iso = e.target.value;
    if (iso) setDateISO(iso);
  };

  // --- Logic Tìm kiếm ---
  async function load(reset = false) {
    setLoading(true);
    try {
      const params = {
        q: q || undefined,
        scope: "all",
        limit,
        skip: reset ? 0 : skip,
      };
      const { data } = await searchFoods(params);
      const list = data?.items || [];
      setHasMore(!!data?.hasMore);
      setItems(reset ? list : [...items, ...list]);
      setSkip(reset ? list.length : skip + list.length);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(true);
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      load(true);
    }, 300);
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line
  }, [q]);

  const filteredItems = useMemo(() => {
    const key = vnNorm(q);
    if (!key) return items;
    return items.filter((it) => vnNorm(it.name).includes(key));
  }, [items, q]);

  // POPUP CHI TIẾT TRONG SEARCH
  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState(null);
  const openDetail = (it) => {
    setDetail(it);
    setShowDetail(true);
  };
  const closeDetail = () => {
    setShowDetail(false);
    setDetail(null);
  };

  // Mở modal Xác nhận thêm
  async function openAdd(it) {
    setAddFood(it);
    setQuantity(1);
    setShowAdd(true);
  }

  // Xác nhận thêm
  async function confirmAdd() {
    try {
      await addLog({
        foodId: addFood._id,
        date: dateISO,
        hour,
        quantity,
        massG: null,
      });
      setShowAdd(false);
      onFoodAdded();
      toast.success("Thêm vào nhật ký thành công");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Thêm vào nhật ký thất bại");
    }
  }

  const gStr = (x) => x ?? "-";
  const f = addFood || {};
  const qNum = Number(quantity || 1);
  const fmt = (v) => (v == null ? "-" : Math.round(v * qNum * 10) / 10);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Bước 1: Tìm kiếm */}
        {!showAdd && (
          <>
            <h3 className="modal-title">
              Thêm món ăn {fmtDisplay(dateISO)} lúc {hour}:00
              <button className="modal-close" onClick={onClose}>
                &times;
              </button>
            </h3>

            <div className="modal-search-bar">
              <i className="fa-solid fa-magnifying-glass" />
              <input
                placeholder="Tìm kiếm thực phẩm hoặc món ăn"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
            </div>

            <div className="modal-nm-list">
              {filteredItems.map((it) => (
                <div
                  key={it._id}
                  className="modal-nm-item"
                  onClick={() => openDetail(it)}
                >
                  <img src={toAbs(it.imageUrl) || PLACEHOLDER} alt={it.name} />
                  <div className="info">
                    <div className="title">{it.name}</div>
                    <div className="sub">
                      {it.portionName || "Khẩu phần"} · {it.massG ?? "-"}{" "}
                      {it.unit || "g"} · {it.kcal ?? "-"} cal
                    </div>
                    <div className="macro">
                      <span className="protein">
                        <i className="fa-solid fa-drumstick-bite"></i>{" "}
                        {it.proteinG ?? "-"} g
                      </span>
                      <span className="carb">
                        <i className="fa-solid fa-bread-slice"></i>{" "}
                        {it.carbG ?? "-"} g
                      </span>
                      <span className="fat">
                        <i className="fa-solid fa-bacon"></i>{" "}
                        {it.fatG ?? "-"} g
                      </span>
                    </div>
                  </div>
                  <div className="act" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="add add-round"
                      title="Thêm vào nhật ký"
                      onClick={() => openAdd(it)}
                    >
                      <i className="fa-solid fa-plus"></i>
                    </button>
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

        {/* Modal Chi tiết món trong Tìm kiếm */}
        {showDetail && detail && !showAdd && (
          <div className="djd-detail-backdrop" onClick={closeDetail}>
            <div
              className="djd-detail-card djd--small"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="djd-detail-close"
                onClick={closeDetail}
                aria-label="Đóng"
              >
                ×
              </button>

              <div className="djd-detail-head">
                <img
                  className="djd-detail-thumb"
                  src={toAbs(detail.imageUrl) || PLACEHOLDER}
                  alt={detail.name}
                />
                <div className="djd-detail-titlebox">
                  <h3 className="djd-detail-title">{detail.name}</h3>
                  <div className="djd-detail-sub">
                    {(detail.portionName || "Khẩu phần tiêu chuẩn")} ·{" "}
                    {detail.massG ?? "-"} {detail.unit || "g"} ·{" "}
                    {detail.kcal ?? "-"} cal
                  </div>
                  <div className="djd-detail-chips">
                    <span className="djd-chip red">
                      <i className="fa-solid fa-drumstick-bite"></i> Đạm{" "}
                      {detail.proteinG ?? "-"}g
                    </span>
                    <span className="djd-chip purple">
                      <i className="fa-solid fa-bread-slice"></i> Carb{" "}
                      {detail.carbG ?? "-"}g
                    </span>
                    <span className="djd-chip green">
                      <i className="fa-solid fa-bacon"></i> Béo{" "}
                      {detail.fatG ?? "-"}g
                    </span>
                  </div>
                </div>
              </div>

              <div className="djd-detail-grid">
                <div className="djd-detail-kv">
                  <div>
                    <span>Khối lượng</span>
                    <b>
                      {detail.massG ?? "-"} {detail.unit || "g"}
                    </b>
                  </div>
                  <div>
                    <span>Calo</span>
                    <b>{detail.kcal ?? "-"} cal</b>
                  </div>
                  <div>
                    <span>Đạm</span>
                    <b>{detail.proteinG ?? "-"} g</b>
                  </div>
                  <div>
                    <span>Đường bột</span>
                    <b>{detail.carbG ?? "-"} g</b>
                  </div>
                </div>
                <div className="djd-detail-kv">
                  <div>
                    <span>Chất béo</span>
                    <b>{detail.fatG ?? "-"} g</b>
                  </div>
                  <div>
                    <span>Muối (NaCl)</span>
                    <b>{detail.saltG ?? "-"} g</b>
                  </div>
                  <div>
                    <span>Đường</span>
                    <b>{detail.sugarG ?? "-"} g</b>
                  </div>
                  <div>
                    <span>Chất xơ</span>
                    <b>{detail.fiberG ?? "-"} g</b>
                  </div>
                </div>
              </div>

              {detail.sourceType && (
                <div className="djd-detail-note">
                  <span className="badge">{detail.sourceType}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bước 2: Xác nhận thêm */}
        {showAdd && addFood && (
          <>
            <div className="am-head">
              <button className="am-back" onClick={() => setShowAdd(false)}>
                <i className="fa-solid fa-arrow-left" /> Quay lại
              </button>
              <div className="am-thumb-wrap">
                <img
                  className="am-thumb"
                  src={toAbs(addFood?.imageUrl) || PLACEHOLDER}
                  alt={addFood?.name || "food"}
                />
              </div>
              <div className="am-hmeta">
                <h3 className="am-title">Thêm vào nhật ký</h3>
                <div className="am-sub">{addFood?.name}</div>
              </div>
            </div>

            <div className="am-when">
              <div className="am-when-item">
                <i className="fa-regular fa-calendar" />

                <div className="am-field">
                  <label>Ngày</label>
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                      format="DD/MM/YYYY"
                      value={dateISO ? dayjs(dateISO) : null}
                      onChange={(newValue) => {
                        const newDateString = newValue
                          ? newValue.format("YYYY-MM-DD")
                          : "";
                        onAddHiddenDateChange({ target: { value: newDateString } });
                      }}
                      slotProps={{
                        textField: {
                          placeholder: "DD/MM/YYYY",
                          style: { width: 170 },
                          size: "small",
                        },
                      }}
                    />
                  </LocalizationProvider>
                </div>
              </div>
              <div className="am-when-item">
                <i className="fa-regular fa-clock" />
                <div className="am-field">
                  <label>Thời gian</label>
                  <select value={hour} onChange={(e) => setHour(+e.target.value)}>
                    {HOUR_OPTIONS_MODAL.map((h) => (
                      <option key={h} value={h}>{`${h}:00`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="am-qtygrid">
              <div className="am-qty">
                <label>Số lượng khẩu phần</label>
                <div className="am-qty-ctl">
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((q) => Math.max(0.1, round1((q || 1) - 0.5)))
                    }
                  >
                    –
                  </button>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={quantity}
                    onChange={(e) =>
                      setQuantity(Math.max(0.1, +e.target.value || 1))
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((q) => round1((q || 1) + 0.5))
                    }
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="am-portion">
                <label>Khẩu phần (g)</label>
                <input
                  type="text"
                  value={addFood?.massG != null ? `${addFood.massG} g` : "-"}
                  readOnly
                  className="readonly"
                />
                <div className="am-note">* Khối lượng mặc định theo món</div>
              </div>
            </div>

            <div className="am-macros">
              <div className="am-macro calo">
                <div className="m-label">Calo</div>
                <div className="m-val">
                  {fmt(f.kcal)} <span>cal</span>
                </div>
              </div>
              <div className="am-macro protein">
                <div className="m-label">Đạm</div>
                <div className="m-val">
                  {fmt(f.proteinG)} <span>g</span>
                </div>
              </div>
              <div className="am-macro carb">
                <div className="m-label">Đường bột</div>
                <div className="m-val">
                  {fmt(f.carbG)} <span>g</span>
                </div>
              </div>
              <div className="am-macro fat">
                <div className="m-label">Béo</div>
                <div className="m-val">
                  {fmt(f.fatG)} <span>g</span>
                </div>
              </div>
            </div>

            <div className="am-actions">
              <button className="btn ghost" onClick={onClose}>
                Hủy
              </button>
              <button className="btn primary" onClick={confirmAdd}>
                Xác nhận thêm
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
