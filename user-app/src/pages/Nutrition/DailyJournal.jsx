// src/pages/Nutrition/DailyJournal.jsx
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  getDayLogs,
  deleteLog,
  getStreak,
  getWater,
  incWater,
} from "../../api/nutrition";
import "./DailyJournal.css";
import { toast } from "react-toastify";
import api from "../../lib/api";

// === Imports cho MUI Date Picker ===
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";

// Import logic thêm món ăn (dùng cho Edit)
import { addLog } from "../../api/foods";

// Modal tách riêng
import SearchModal from "./components/SearchModal/SearchModal";
import EditModal from "./components/EditModal/EditModal";

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
  const [stepMl, setStepMl] = useState(0);

  // === State cho Modal Danh sách tìm kiếm (SearchModal) ===
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

  // === Modal Search (danh sách tìm kiếm + AddModal bên trong) ===
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

  // ====== Modal CHỈNH LOG trên timeline (EditModal) ======
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
      <div className="dj-wrap">
        <div className="dj-container">
          {/* ===== HÀNG HEAD: 2/3 TRÁI (TITLE + DESC) ===== */}
          <div className="dj-head">
            <div className="dj-head-left">
              <h1 className="dj-title">Nhật ký dinh dưỡng</h1>
              <p className="dj-desc">
                Tiếp tục theo dõi chế độ dinh dưỡng và lưu lại nhật ký dinh dưỡng
              </p>
            </div>
          </div>

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
                    size: "small",
                    sx: {
                      width: { xs: "100%", sm: 150 },
                      maxWidth: { xs: "100%", sm: 150 },
                      // Root của OutlinedInput
                      "& .MuiOutlinedInput-root": {
                        height: { xs: 40, sm: 34 },
                        borderRadius: "999px",
                        backgroundColor: "#020617",
                        "& fieldset": {
                          borderColor: "#ef4444",
                        },
                        "&:hover fieldset": {
                          borderColor: "#f97373",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: "#ef4444",
                          boxShadow: "0 0 0 1px #f97373",
                        },
                      },
                      // Input text
                      "& .MuiInputBase-input": {
                        padding: { xs: "8px 12px", sm: "6px 12px" },
                        fontSize: { xs: 13, sm: 14 },
                        color: "#f9fafb",
                      },
                      // Icon lịch
                      "& .MuiSvgIcon-root": {
                        color: "#f9fafb",
                        fontSize: { xs: "1.2rem", sm: "1.5rem" },
                      },
                    },
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

          {/* ===== BODY: DƯỚI HEAD – 2/3 TRÁI dj-main, 1/3 PHẢI dj-side ===== */}
          <div className="dj-grid">
            {/* LEFT main (2/3) */}
            <div className="dj-main">
              {/* Header nhỏ cho timeline */}
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

            {/* RIGHT sidebar (1/3) – phía dưới dj-bar */}
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
                        min="0"
                        max="10000"
                        step="500"
                        value={stepMl}
                        onChange={(e) =>
                          setStepMl(
                            Math.max(
                              0,
                              Math.min(10000, +e.target.value || 0)
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

      {/* === MODAL DANH SÁCH TÌM KIẾM (SearchModal) === */}
      {isAddModalOpen && (
        <SearchModal
          date={date}
          hour={selectedHour}
          onClose={handleCloseAddModal}
          onFoodAdded={handleFoodAdded}
        />
      )}

      {/* === MODAL CHỈNH LOG TRÊN TIMELINE (EditModal) === */}
      {showEdit && editLog && (
        <EditModal
          open={showEdit}
          date={date}
          log={editLog}
          quantity={editQty}
          hour={editHour}
          hoursOptions={HOURS}
          onChangeQuantity={setEditQty}
          onChangeHour={setEditHour}
          onClose={closeEditLog}
          onSave={saveEditLog}
        />
      )}
    </div>
  );
}
