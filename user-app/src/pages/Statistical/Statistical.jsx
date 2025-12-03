// src/pages/Statistical/Statistical.jsx
import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import "dayjs/locale/vi"; // Import locale tiếng Việt nếu cần
import "./Statistical.css";

import {
  getDayLogs,
  getWater,
  incWater,
  getStreak,
} from "../../api/nutrition";
import { listMyWorkouts } from "../../api/workouts";
import api from "../../lib/api";
import { toast } from "react-toastify";

// --- IMPORT CÁC MODAL (Nếu bạn tách file, hãy import từ file riêng) ---
// import { WorkoutSelectModal, WeightModal, StepsModal } from "./StatisticalModals";

/* ===== Helpers chung ===== */
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
const round1 = (v) => Math.round((v || 0) * 10) / 10;
const toNum = (v, def = 0) => (v == null || v === "" || isNaN(+v) ? def : +v);

const LS_KEY = "fm_daily_stats_v1";
const STEP_GOAL = 8000;

// ... (Giữ nguyên các hàm helper readAllStatLocal, writeAllStatLocal, readStatFor, mapWorkoutToOption như cũ)
function readAllStatLocal() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
function writeAllStatLocal(all) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}
function readStatFor(dateISO) {
  const all = readAllStatLocal();
  return all[dateISO] || { steps: 0, weightKg: null, workouts: [] };
}
function mapWorkoutToOption(p) {
  const t = p?.totals || {};
  return {
    id: p._id,
    name: p.name || "(Không tên)",
    kcal: t.kcal ?? t.calories ?? p.totalKcal ?? 0,
  };
}

export default function Statistical() {
  const [date, setDate] = useState(() => dayjs().format("YYYY-MM-DD"));
  
  // Dữ liệu API
  const [logs, setLogs] = useState([]);
  const [totals, setTotals] = useState({}); // kcal, protein...
  const [targets, setTargets] = useState({});
  const [waterMl, setWaterMl] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hot, setHot] = useState(false);

  // Local Data
  const [activity, setActivity] = useState(() => readStatFor(dayjs().format("YYYY-MM-DD")));
  const [workOptions, setWorkOptions] = useState([]);
  const [loadingWork, setLoadingWork] = useState(false);

  // Modal Controls
  const [modalType, setModalType] = useState(null); // 'WORKOUT', 'STEPS', 'WEIGHT'

  /* --- Calculated States --- */
  const selectedWorkoutIds = useMemo(() => new Set((activity.workouts || []).map((w) => w.id)), [activity.workouts]);
  const totalBurnedKcal = useMemo(() => (activity.workouts || []).reduce((sum, w) => sum + (w.kcal || 0), 0), [activity.workouts]);

  const kcalTarget = Math.round(targets.kcal || 0);
  const kcalAte = Math.round(totals.kcal || 0);
  const kcalBurned = Math.round(totalBurnedKcal || 0);
  const kcalBudget = Math.max(0, kcalTarget + kcalBurned);
  const kcalRemaining = Math.max(0, kcalBudget - kcalAte);
  // Tính % cho gauge chart (nửa vòng tròn)
  const kcalProgressPct = kcalBudget ? Math.min(100, (kcalAte / kcalBudget) * 100) : 0;

  // Group logs theo giờ
  const timeSlots = useMemo(() => {
    const map = {};
    for (const it of logs) {
      const h = Number(it.hour);
      if (!map[h]) map[h] = [];
      map[h].push(it);
    }
    return Object.entries(map)
      .map(([h, arr]) => ({ hour: Number(h), items: arr }))
      .sort((a, b) => a.hour - b.hour);
  }, [logs]);

  // Lịch sử cân nặng (cho biểu đồ)
  const weightHistory = useMemo(() => {
    const all = readAllStatLocal();
    return Object.entries(all)
      .filter(([, v]) => v && v.weightKg != null)
      .sort(([d1], [d2]) => (d1 < d2 ? -1 : 1))
      .slice(-10) // Lấy 10 ngày gần nhất
      .map(([d, v]) => ({ date: d, weight: Number(v.weightKg) }));
  }, [activity.weightKg, date]);

  /* --- Actions --- */
  const updateActivity = (patch) => {
    setActivity((prev) => {
      const next = { ...prev, ...patch };
      const all = readAllStatLocal();
      all[date] = next;
      writeAllStatLocal(all);
      return next;
    });
  };

  const loadNutrition = async () => {
    try {
      const { data } = await getDayLogs(date);
      // Process logs... (giữ logic cũ)
      const safeLogs = (data?.items || []).map((it) => ({
        ...it,
        hour: Number(it.hour),
        quantity: Number(it.quantity ?? 1),
        foodAbs: it.food?.imageUrl ? toAbs(it.food.imageUrl) : PLACEHOLDER,
      }));
      setLogs(safeLogs);
      setTotals(data?.totals || {});
      setTargets(data?.targets || {});
    } catch(e) { console.error(e) }
  };

  const loadWater = async () => {
    const { data } = await getWater(date);
    setWaterMl(Number(data?.amountMl || 0));
  };

  const handleWaterChange = async (newAmount) => {
    const delta = newAmount - waterMl;
    if (delta === 0) return;
    await incWater({ date, deltaMl: delta });
    setWaterMl(newAmount);
  };

  useEffect(() => {
    loadNutrition();
    loadWater();
    setActivity(readStatFor(date));
  }, [date]);

  useEffect(() => {
    (async () => {
      const { data } = await getStreak();
      setStreak(Number(data?.streak || 0));
      setHot(Number(data?.streak || 0) >= 2);
      
      setLoadingWork(true);
      try {
        const res = await listMyWorkouts({ limit: 100 });
        const items = (res?.data?.data?.items || []).map(mapWorkoutToOption);
        setWorkOptions(items);
      } catch {} finally { setLoadingWork(false); }
    })();
  }, []);

  return (
    <div className="st-page">
      <div className="st-wrap">
        {/* LAYOUT GRID 4 CỘT - 4 HÀNG */}
        <div className="st-grid-layout">
          
          {/* --- CỘT 1: TỔNG QUAN (Full chiều cao) --- */}
          <section className="st-col-overview">
            <div className="st-card st-card-full-height">
              <div className="st-overview-header">
                <div className="st-card-title-lg">Tổng quan <span className="st-fire-icon">{hot ? "🔥" : "❄️"} {streak}</span></div>
                
                {/* Date Slider Custom */}
                <DateSlider date={date} setDate={setDate} />
              </div>

              {/* Danh sách nhật ký (Dọc) */}
              <div className="st-overview-body">
                 <div className="st-total-kcal-label">
                    Thời gian - {kcalAte} kcal
                 </div>
                 <div className="st-log-list">
                    {timeSlots.length === 0 ? (
                      <div className="st-empty-text">Chưa có nhật ký</div>
                    ) : (
                      timeSlots.map(({ hour, items }) => (
                        <div key={hour} className="st-log-group">
                          <div className="st-log-hour">{hour}:00</div>
                          {items.map(item => (
                            <div key={item._id} className="st-log-item">
                               <img src={item.foodAbs} alt="" />
                               <div>
                                 <div className="st-food-name">{item.food?.name}</div>
                                 <div className="st-food-sub">{Math.round(item.food?.kcal * item.quantity)} kcal</div>
                               </div>
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                 </div>
              </div>
            </div>
          </section>

          {/* --- CỘT 2 (Hàng 1-2): MỤC TIÊU CALO --- */}
          <section className="st-box-calories">
            <div className="st-card h-full">
              <div className="st-card-header">Mục tiêu Calo</div>
              <div className="st-cal-gauge-area">
                <SemiCircleGauge percent={kcalProgressPct} remaining={kcalRemaining} />
              </div>
              <div className="st-cal-stats-row">
                 <div className="st-cal-stat">
                    <div className="st-stat-val">{kcalTarget}</div>
                    <div className="st-stat-lbl">Mục tiêu</div>
                 </div>
                 <div className="st-cal-stat">
                    <div className="st-stat-val">{kcalAte}</div>
                    <div className="st-stat-lbl">Đã nạp</div>
                 </div>
                 <div className="st-cal-stat">
                    <div className="st-stat-val">{kcalBurned}</div>
                    <div className="st-stat-lbl">Tập luyện</div>
                 </div>
              </div>
            </div>
          </section>

          {/* --- CỘT 3 (Hàng 1): TẬP LUYỆN --- */}
          <section className="st-box-workout">
            <div className="st-card h-full relative">
              <button className="st-btn-add-corner" onClick={() => setModalType('WORKOUT')}>+</button>
              <div className="st-card-header">Tập luyện</div>
              <div className="st-box-content">
                <div className="st-big-num">{kcalBurned} <small>kcal</small></div>
                <div className="st-sub-text">Đã đốt cháy</div>
                <div className="st-sub-text mt-1">{activity.workouts?.length || 0} bài tập</div>
              </div>
            </div>
          </section>

          {/* --- CỘT 4 (Hàng 1): BƯỚC CHÂN --- */}
          <section className="st-box-steps">
            <div className="st-card h-full relative">
              <button className="st-btn-add-corner" onClick={() => setModalType('STEPS')}>+</button>
              <div className="st-card-header">Bước chân</div>
              <div className="st-box-content">
                <div className="st-big-num">{(activity.steps || 0).toLocaleString()}</div>
                <div className="st-sub-text">/ {STEP_GOAL.toLocaleString()} bước</div>
                
                <div className="st-progress-bar-wrapper">
                   <div className="st-progress-bar" style={{width: `${Math.min(100, (activity.steps/STEP_GOAL)*100)}%`}}></div>
                </div>
              </div>
            </div>
          </section>

          {/* --- CỘT 3-4 (Hàng 2): LƯỢNG NƯỚC --- */}
          <section className="st-box-water">
            <div className="st-card h-full">
               <div className="st-water-flex">
                  <div className="st-water-icon">💧</div>
                  <div className="st-water-info">
                     <div className="st-card-header">Lượng nước</div>
                     <div className="st-big-num-water">{waterMl} <small>ml</small></div>
                  </div>
                  <div className="st-water-controls">
                     <button onClick={() => handleWaterChange(Math.max(0, waterMl - 250))}>-</button>
                     <span>250ml</span>
                     <button onClick={() => handleWaterChange(waterMl + 250)}>+</button>
                  </div>
               </div>
            </div>
          </section>

          {/* --- HÀNG 3 (Cột 2-3-4): GIÁ TRỊ DINH DƯỠNG --- */}
          <section className="st-box-nutrition">
             <div className="st-card h-full">
                <div className="st-nutrition-grid">
                   <MacroBar label="Chất đạm" val={totals.proteinG} max={targets.proteinG} color="#ef4444" />
                   <MacroBar label="Đường bột" val={totals.carbG} max={targets.carbG} color="#8b5cf6" />
                   <MacroBar label="Chất béo" val={totals.fatG} max={targets.fatG} color="#10b981" />
                   <MacroBar label="Muối" val={totals.saltG} max={targets.saltG} color="#9ca3af" />
                   <MacroBar label="Đường" val={totals.sugarG} max={targets.sugarG} color="#f59e0b" />
                   <MacroBar label="Chất xơ" val={totals.fiberG} max={targets.fiberG} color="#14b8a6" />
                </div>
             </div>
          </section>

          {/* --- HÀNG 4 (Cột 2-3-4): CÂN NẶNG --- */}
          <section className="st-box-weight">
             <div className="st-card h-full relative">
                <button className="st-btn-add-corner" onClick={() => setModalType('WEIGHT')}>+</button>
                <div className="st-card-header">Cân nặng gần nhất</div>
                <div className="st-weight-chart-area">
                   {/* Vẽ biểu đồ đơn giản bằng SVG */}
                   {weightHistory.length > 0 ? (
                      <SimpleLineChart data={weightHistory} />
                   ) : (
                      <div className="st-empty-text center">Chưa có dữ liệu cân nặng</div>
                   )}
                </div>
             </div>
          </section>

        </div>
      </div>

      {/* --- MODALS --- */}
      {modalType === 'WORKOUT' && (
        <WorkoutModal 
          options={workOptions} 
          selected={selectedWorkoutIds} 
          onClose={() => setModalType(null)} 
          onSave={(list) => updateActivity({ workouts: list })}
        />
      )}
      {modalType === 'STEPS' && (
        <StepsModal 
          current={activity.steps || 0}
          onClose={() => setModalType(null)}
          onSave={(steps) => updateActivity({ steps })}
        />
      )}
      {modalType === 'WEIGHT' && (
        <WeightModal
           current={activity.weightKg}
           onClose={() => setModalType(null)}
           onSave={(w) => updateActivity({ weightKg: w })}
        />
      )}
    </div>
  );
}

/* ==========================================================
   COMPONENT CON (Date Slider, Gauge, Charts, Modals)
   ========================================================== */

function DateSlider({ date, setDate }) {
  const current = dayjs(date);
  // Tạo danh sách 5 ngày: -2, -1, current, +1, +2
  const days = Array.from({length: 5}, (_, i) => current.add(i - 2, 'day'));

  return (
    <div className="st-date-slider">
       <button className="st-ds-arrow" onClick={() => setDate(current.add(-1, 'day').format("YYYY-MM-DD"))}>
         <i className="fa-solid fa-chevron-left"></i>
       </button>
       <div className="st-ds-days">
          {days.map(d => {
            const isToday = d.isSame(current, 'day');
            return (
              <div 
                key={d.format()} 
                className={`st-ds-item ${isToday ? 'active' : ''}`}
                onClick={() => setDate(d.format("YYYY-MM-DD"))}
              >
                 <span className="st-ds-date">{d.date()}</span>
                 <span className="st-ds-month">Thg {d.month() + 1}</span>
              </div>
            )
          })}
       </div>
       <button className="st-ds-arrow" onClick={() => setDate(current.add(1, 'day').format("YYYY-MM-DD"))}>
         <i className="fa-solid fa-chevron-right"></i>
       </button>
    </div>
  )
}

function SemiCircleGauge({ percent, remaining }) {
  // SVG gauge bán nguyệt
  const r = 58;
  const c = Math.PI * r; // Nửa chu vi
  const offset = c * (1 - percent / 100);
  
  return (
    <div className="st-gauge-wrapper">
       <svg width="140" height="80" viewBox="0 0 140 80" className="st-gauge-svg">
          {/* Background Arc */}
          <path d="M 10 70 A 60 60 0 0 1 130 70" fill="none" stroke="#1f2937" strokeWidth="12" strokeLinecap="round" />
          {/* Foreground Arc */}
          <path 
             d="M 10 70 A 60 60 0 0 1 130 70" 
             fill="none" 
             stroke="#22c55e" 
             strokeWidth="12" 
             strokeLinecap="round"
             strokeDasharray={c}
             strokeDashoffset={offset}
             className="st-gauge-progress"
          />
       </svg>
       <div className="st-gauge-text">
          <div className="st-gauge-val">{remaining}</div>
          <div className="st-gauge-sub">Calo còn lại</div>
       </div>
    </div>
  )
}

function MacroBar({ label, val, max, color }) {
  const pct = max ? Math.min(100, (val/max)*100) : 0;
  return (
    <div className="st-macro-col">
       <div className="st-macro-header">
         <span>{label}</span>
       </div>
       <div className="st-macro-bar-bg">
         <div className="st-macro-bar-fill" style={{width: `${pct}%`, background: color}}></div>
       </div>
       <div className="st-macro-nums">
          <span style={{color: color, fontWeight: 'bold'}}>{Math.round(val || 0)}</span>
          <span className="text-gray-500">/{max || 0}g</span>
       </div>
    </div>
  )
}

function SimpleLineChart({ data }) {
  if(!data.length) return null;
  const maxW = Math.max(...data.map(d => d.weight)) + 2;
  const minW = Math.min(...data.map(d => d.weight)) - 2;
  const range = maxW - minW || 1;
  
  // Map points to SVG coordinates (100% width, 100px height)
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100; // %
    const y = 100 - ((d.weight - minW) / range) * 80 - 10; // px
    return `${x},${y}`;
  }).join(" "); // Format cho polyline trong SVG nhưng ta dùng HTML div absolute cho dễ style dot
  
  return (
    <div className="st-chart-container">
       <div className="st-chart-line-bg"></div>
       <svg className="st-chart-svg" preserveAspectRatio="none">
          <polyline points={data.map((d, i) => {
             const x = (i / (data.length - 1 || 1)) * 1000; // scale up 
             const y = 100 - ((d.weight - minW) / range) * 80 - 10;
             return `${x},${y}`;
          }).join(" ")} fill="none" stroke="#14b8a6" strokeWidth="3" vectorEffect="non-scaling-stroke"/>
       </svg>
       {data.map((d, i) => {
          const left = (i / (data.length - 1 || 1)) * 100;
          const top = 100 - ((d.weight - minW) / range) * 80 - 10;
          return (
             <div key={i} className="st-chart-dot-wrap" style={{left: `${left}%`, top: `${top}px`}}>
                <div className="st-chart-dot"></div>
                <div className="st-chart-tooltip">{d.weight}</div>
                <div className="st-chart-date">{dayjs(d.date).format("DD/MM")}</div>
             </div>
          )
       })}
    </div>
  )
}

/* --- SEPARATE MODALS (Có thể cắt ra file riêng) --- */

function WorkoutModal({ options, selected, onClose, onSave }) {
  const [tempSelected, setTempSelected] = useState([...selected]);
  const toggle = (id) => setTempSelected(prev => prev.includes(id) ? prev.filter(x => x!==id) : [...prev, id]);
  
  return (
    <div className="st-modal-overlay" onClick={onClose}>
      <div className="st-modal-content" onClick={e => e.stopPropagation()}>
        <h3>Log tập luyện</h3>
        <div className="st-modal-list">
          {options.map(w => (
            <div key={w.id} className={`st-opt-row ${tempSelected.includes(w.id) ? 'active' : ''}`} onClick={() => toggle(w.id)}>
              <span>{w.name} ({w.kcal} kcal)</span>
              {tempSelected.includes(w.id) && <i className="fa-solid fa-check text-green-500"></i>}
            </div>
          ))}
        </div>
        <div className="st-modal-actions">
           <button onClick={onClose}>Hủy</button>
           <button className="primary" onClick={() => { 
             const list = options.filter(o => tempSelected.includes(o.id));
             onSave(list); onClose(); 
           }}>Lưu</button>
        </div>
      </div>
    </div>
  )
}

function StepsModal({ current, onClose, onSave }) {
  const [val, setVal] = useState(current);
  return (
    <div className="st-modal-overlay" onClick={onClose}>
       <div className="st-modal-content sm" onClick={e => e.stopPropagation()}>
         <h3>Cập nhật bước chân</h3>
         <input type="number" className="st-inp-full" value={val} onChange={e => setVal(Number(e.target.value))} />
         <div className="st-modal-actions">
           <button onClick={onClose}>Hủy</button>
           <button className="primary" onClick={() => { onSave(val); onClose(); }}>Lưu</button>
         </div>
       </div>
    </div>
  )
}

function WeightModal({ current, onClose, onSave }) {
  const [val, setVal] = useState(current || "");
  return (
    <div className="st-modal-overlay" onClick={onClose}>
       <div className="st-modal-content sm" onClick={e => e.stopPropagation()}>
         <h3>Nhập cân nặng (kg)</h3>
         <input type="number" step="0.1" className="st-inp-full" value={val} onChange={e => setVal(e.target.value)} />
         <div className="st-modal-actions">
           <button onClick={onClose}>Hủy</button>
           <button className="primary" onClick={() => { onSave(val); onClose(); }}>Lưu</button>
         </div>
       </div>
    </div>
  )
}