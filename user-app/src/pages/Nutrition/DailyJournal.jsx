// src/pages/Nutrition/DailyJournal.jsx
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { getDayLogs, deleteLog, getStreak, getWater, incWater } from "../../api/nutrition";
import "./DailyJournal.css";
import { toast } from "react-toastify";
import api from "../../lib/api";

const HOURS = Array.from({ length: 18 }, (_, i) => 6 + i); // 6..23

// ===== Helper giống Account.jsx =====
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => { if (!u) return u; try { return new URL(u, API_ORIGIN).toString(); } catch { return u; } };
const PLACEHOLDER = "/images/food-placeholder.jpg";

export default function DailyJournal() {
  const [date, setDate] = useState(() => dayjs().format("YYYY-MM-DD"));
  const [weekDays, setWeekDays] = useState([]);
  const [curDow, setCurDow] = useState(dayjs(date).day()); // 0..6 (CN..T7)
  const [streak, setStreak] = useState(0);
  const [hot, setHot] = useState(false);

  // logs từ DB: [{_id, hour, quantity, massG, food{...}, foodAbs}]
  const [logs, setLogs] = useState([]);
  // totals/targets từ DB (đã chuẩn hoá về number)
  const [totals, setTotals] = useState({ kcal: 0, proteinG: 0, carbG: 0, fatG: 0, sugarG: 0, saltG: 0, fiberG: 0 });
  const [targets, setTargets] = useState({ kcal: 0, proteinG: 0, carbG: 0, fatG: 0, sugarG: 0, saltG: 0, fiberG: 0 });

  const [waterMl, setWaterMl] = useState(0);
  const [stepMl, setStepMl] = useState(100); // số ml mỗi lần +/- (user nhập)

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

    // logs: chuẩn hoá hour về number, food luôn là object + map ảnh tuyệt đối 1 lần
    const safeLogs = (data?.items || []).map((it) => {
      const food = it.food || {};
      const foodAbs = food.imageUrl ? toAbs(food.imageUrl) : PLACEHOLDER;
      return {
        ...it,
        hour: Number(it.hour),
        quantity: Number(it.quantity ?? 1),
        massG: it.massG ?? null,
        food,
        foodAbs
      };
    });
    setLogs(safeLogs);

    // totals: ép number + fallback 0
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

    // targets từ server
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

  return (
    <div className="dj-wrap">
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
              {["Chủ Nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"][d.day()]}
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
          <div className="hour-grid">
            {HOURS.map(h => (
              <div key={h} className="hour-row" style={{ height: (logsByHour[h]?.length ? "auto" : "36px") }}>
                <div className="hh">{h}:00</div>
                <div className="entries">
                  {logsByHour[h].map(item => (
                    <div key={item._id} className="entry">
                      <img src={item.foodAbs || PLACEHOLDER} alt={item.food?.name} />
                      <div className="einfo">
                        <div className="etitle">{item.food?.name}</div>
                        <div className="esub">
                          {(item.massG ?? item.food?.massG ?? "-")} {item.food?.unit || "g"} · {(item.food?.kcal ?? "-")} cal
                        </div>
                      </div>
                      <button className="edel" title="Xoá" onClick={() => onDelete(item._id)}>
                        <i className="fa-regular fa-trash-can"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT sidebar (1/3) */}
        <div className="dj-side">
          {/* ======= BẢNG GIÁ TRỊ ĐA LƯỢNG MỚI ======= */}
          <div className="panel macro">
            {/* Calorie ring */}
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

            {/* 2 cột macro */}
            <div className="macro-grid">
              <div className="col">
                {/* Đạm */}
                <div className="mitem">
                  <div className="mhead">
                    <span>Chất đạm</span>
                    <span className="mval">{(totals.proteinG || 0)}/{Math.round(targets.proteinG || 0)}g</span>
                  </div>
                  <div className="mbar red"><span style={{ width: `${pct(totals.proteinG, targets.proteinG)}%` }} /></div>
                </div>
                {/* Đường bột */}
                <div className="mitem">
                  <div className="mhead">
                    <span>Đường bột</span>
                    <span className="mval">{(totals.carbG || 0)}/{Math.round(targets.carbG || 0)}g</span>
                  </div>
                  <div className="mbar purple"><span style={{ width: `${pct(totals.carbG, targets.carbG)}%` }} /></div>
                </div>
                {/* Chất béo */}
                <div className="mitem">
                  <div className="mhead">
                    <span>Chất béo</span>
                    <span className="mval">{(totals.fatG || 0)}/{Math.round(targets.fatG || 0)}g</span>
                  </div>
                  <div className="mbar green"><span style={{ width: `${pct(totals.fatG, targets.fatG)}%` }} /></div>
                </div>
              </div>

              <div className="col">
                {/* Muối */}
                <div className="mitem">
                  <div className="mhead">
                    <span>Muối</span>
                    <span className="mval">{(totals.saltG || 0)}/{Math.round(targets.saltG || 0)}g</span>
                  </div>
                  <div className="mbar gray"><span style={{ width: `${pct(totals.saltG, targets.saltG)}%` }} /></div>
                </div>
                {/* Đường */}
                <div className="mitem">
                  <div className="mhead">
                    <span>Đường</span>
                    <span className="mval">{(totals.sugarG || 0)}/{Math.round(targets.sugarG || 0)}g</span>
                  </div>
                  <div className="mbar orange"><span style={{ width: `${pct(totals.sugarG, targets.sugarG)}%` }} /></div>
                </div>
                {/* Chất xơ */}
                <div className="mitem">
                  <div className="mhead">
                    <span>Chất xơ</span>
                    <span className="mval">{(totals.fiberG || 0)}/{Math.round(targets.fiberG || 0)}g</span>
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
                <i className="fa-solid fa-glass-water-droplet"></i>
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
  );
}
