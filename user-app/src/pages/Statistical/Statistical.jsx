// src/pages/Statistical/Statistical.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import "./Statistical.css";
import { getDayLogs, getWater, incWater, getStreak } from "../../api/nutrition";
import { listMyWorkouts } from "../../api/workouts";
import {
  getDailyActivity,
  setDailySteps,
  setDailyWeight,
  saveDailyWorkouts,
  getWeightHistory as apiGetWeightHistory,
} from "../../api/activity";
import api from "../../lib/api";
import { toast } from "react-toastify";
import { WorkoutModal, SimpleInputModal } from "./StatisticalModals";

const STEP_GOAL = 8000, PLACEHOLDER = "/images/food-placeholder.jpg";
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => { if (!u) return u; try { return new URL(u, API_ORIGIN).toString(); } catch { return u; } };
const toNum = (v, d = 0) => v == null || v === "" || isNaN(+v) ? d : +v;

function readStatFor(d){ try{const r=window.localStorage.getItem(LS_KEY);return (r?JSON.parse(r):{})[d]||{steps:0,weightKg:null,workouts:[]}}catch{return {steps:0,weightKg:null,workouts:[]}} }
function writeAllStatLocal(d, val){ try{const r=JSON.parse(window.localStorage.getItem(LS_KEY)||'{}'); r[d]=val; window.localStorage.setItem(LS_KEY,JSON.stringify(r))}catch{} }
function mapWorkoutToOption(p){ const t=p?.totals||{}; return {id:p._id, name:p.name||"(No name)", kcal:t.kcal??t.calories??p.totalKcal??0} }
const pickWorkoutRes = (r) => r?.data?.data || r?.data || r || {};

export default function Statistical() {
  const [date, setDate] = useState(() => dayjs().format("YYYY-MM-DD"));
  const [logs, setLogs] = useState([]);
  const [totals, setTotals] = useState({ kcal: 0, proteinG: 0, carbG: 0, fatG: 0, sugarG: 0, saltG: 0, fiberG: 0 });
  const [targets, setTargets] = useState({ kcal: 0, proteinG: 0, carbG: 0, fatG: 0, sugarG: 0, saltG: 0, fiberG: 0 });
  const [waterMl, setWaterMl] = useState(0); const [stepMl, setStepMl] = useState(250);
  const [streak, setStreak] = useState(0); const [hot, setHot] = useState(false);
  const [activity, setActivity] = useState({ steps: 0, weightKg: null, workouts: [] });
  const [weightHistory, setWeightHistory] = useState([]);
  const [workOptions, setWorkOptions] = useState([]);
  const [modal, setModal] = useState(null);

    const [macroPage, setMacroPage] = useState(0); // 0: Đạm/Đường bột/Chất béo, 1: Muối/Đường/Chất xơ
  const macroStartX = useRef(null);

  const handleMacroSlideStart = (e) => {
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    macroStartX.current = x;
  };
  const handleMacroSlideEnd = (e) => {
    if (macroStartX.current == null) return;
    const x = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const dx = x - macroStartX.current;
    const THRESHOLD = 40;
    if (Math.abs(dx) > THRESHOLD) {
      setMacroPage((p) => {
        if (dx < 0) return Math.min(1, p + 1); // kéo sang trái -> trang sau
        if (dx > 0) return Math.max(0, p - 1); // kéo sang phải -> trang trước
        return p;
      });
    }
    macroStartX.current = null;
  };
  

  /* ====== Logic ====== */
  const selectedWorkoutIds = useMemo(
    () => new Set((activity.workouts || []).map((w) => w.id)),
    [activity.workouts]
  );

  const workoutNamesText = useMemo(
    () =>
      (activity.workouts || [])
        .map((w) => w.name || "(Không tên)")
        .join(", "),
    [activity.workouts]
  );
  const totalBurnedKcal = useMemo(
    () => (activity.workouts || []).reduce((s, w) => s + (w.kcal || 0), 0),
    [activity.workouts]
  );
  const kcalTarget=Math.round(targets.kcal||0), kcalAte=Math.round(totals.kcal||0), kcalBurned=Math.round(totalBurnedKcal||0);
  const kcalBudget=Math.max(0,kcalTarget+kcalBurned), kcalRemaining=Math.max(0,kcalBudget-kcalAte), kcalUsedPct=kcalBudget?Math.min(1,kcalAte/kcalBudget):0;

  const timeSlots = useMemo(() => {
    const map={}; 
    for(const it of logs){ const h=Number(it.hour); if(!map[h])map[h]=[]; map[h].push(it); }
    return Object.entries(map).map(([h,arr])=>({ hour:Number(h), items:arr, totalKcal: arr.reduce((s,i)=>s+(i.food?.kcal||0)*toNum(i.quantity,1),0) })).sort((a,b)=>a.hour-b.hour);
  }, [logs]);

  const updateActivity = (patch) => {
    setActivity(prev => ({ ...prev, ...patch }));
  };

  /* ====== API ====== */
async function loadData() {
    const [l, w, s, actRes] = await Promise.all([
      getDayLogs(date),
      getWater(date),
      getStreak(),
      getDailyActivity(date),
    ]);

    setLogs((l.data?.items || []).map(it => ({
      ...it,
      hour: Number(it.hour),
      quantity: Number(it.quantity ?? 1),
      foodAbs: it.food?.imageUrl ? toAbs(it.food.imageUrl) : PLACEHOLDER,
    })));

    const t = l.data?.totals || {}, g = l.data?.targets || {};
    setTotals({
      kcal: +t.kcal || 0, proteinG: +t.proteinG || 0, carbG: +t.carbG || 0,
      fatG: +t.fatG || 0, sugarG: +t.sugarG || 0, saltG: +t.saltG || 0, fiberG: +t.fiberG || 0,
    });
    setTargets({
      kcal: +g.kcal || 0, proteinG: +g.proteinG || 0, carbG: +g.carbG || 0,
      fatG: +g.fatG || 0, sugarG: +g.sugarG || 0, saltG: +g.saltG || 0, fiberG: +g.fiberG || 0,
    });

    setWaterMl(Number(w.data?.amountMl || 0));
    setStreak(Number(s.data?.streak || 0));
    setHot(Number(s.data?.streak || 0) >= 2);

    const a = actRes.data || {};
    updateActivity({
      steps: a.steps || 0,
      weightKg: a.weightKg ?? null,
      workouts: a.workouts || [],
    });
  }

  useEffect(() => { loadData(); }, [date]);
  
  useEffect(()=>{ loadData(); },[date]);
  useEffect(() => {
      listMyWorkouts({ limit: 50 })
        .then(res => {
          const raw = (res?.data?.data || res?.data || {}).items || [];
          setWorkOptions(raw.map(mapWorkoutToOption));
        })
        .catch(() => {});
    }, []);

    useEffect(() => {
      apiGetWeightHistory(10)
        .then(res => setWeightHistory(res.data?.history || []))
        .catch(() => {});
    }, []);

    useEffect(() => {
  (async () => {
    try {
      const res = await listMyWorkouts({ q: "", limit: 50, skip: 0 });
      const raw = pickWorkoutRes(res);
      const items = (raw.items || []).map(mapWorkoutToOption);
      setWorkOptions(items);
    } catch (err) {
      console.error("Đã có lỗi xảy ra:", err);
    }
  })();
}, []);

  /* ====== Handlers ====== */
  const waterDelta = async (d) => {
    const want = Math.max(0, Math.min(10000, waterMl + d));
    if (want !== waterMl) {
      await incWater({ date, deltaMl: want - waterMl });
      setWaterMl(want);
    }
  };

  const handleSaveWorkouts = async (selected) => {
    try {
      await saveDailyWorkouts({ date, workoutIds: selected.map(w => w.id) });
      updateActivity({ workouts: selected });
      toast.success("Đã lưu lịch tập cho ngày này");
      setModal(null);
    } catch (e) {
      console.error(e);
      toast.error("Không lưu được lịch tập");
    }
  };

  const handleSaveSteps = async (val) => {
    try {
      await setDailySteps({ date, steps: val });
      updateActivity({ steps: val });
      toast.success("Đã cập nhật bước chân");
      setModal(null);
    } catch (e) {
      console.error(e);
      toast.error("Không lưu được bước chân");
    }
  };

  const handleSaveWeight = async (val) => {
    try {
      await setDailyWeight({ date, weightKg: val });
      updateActivity({ weightKg: val });
      // reload history để chart cập nhật
      apiGetWeightHistory(10)
        .then(res => setWeightHistory(res.data?.history || []))
        .catch(() => {});
      toast.success("Đã cập nhật cân nặng");
      setModal(null);
    } catch (e) {
      console.error(e);
      toast.error("Không lưu được cân nặng");
    }
  };
  const renderRing = () => {
  const r = 60, C = Math.PI * r, off = C * (1 - kcalUsedPct);
  return (
    <div className="st-cal-ring">
      <svg width="300" height="180" viewBox="0 0 200 130">
        <path className="ring-bg" d="M20 90 A80 80 0 0 1 180 90" pathLength={Math.PI * 80} />
        <path className="ring-fg" d="M20 90 A80 80 0 0 1 180 90" pathLength={Math.PI * 80}
          strokeDasharray={Math.PI * 80}
          strokeDashoffset={(Math.PI * 80) * (1 - kcalUsedPct)}
        />
      </svg>
      <div className="st-cal-center">
        <div className="cc-val">{kcalRemaining}</div>
        <div className="cc-lbl">Calo còn lại</div>
      </div>
    </div>
  );
};

  const macroPages = useMemo(
    () => [
      [
        { key: "protein", l: "Chất đạm", c: "red",   v: totals.proteinG, t: targets.proteinG, icon: "fa-solid fa-bolt" },
        { key: "carb",    l: "Đường bột", c: "purple", v: totals.carbG,    t: targets.carbG,    icon: "fa-solid fa-wheat-awn" },
        { key: "fat",     l: "Chất béo", c: "green", v: totals.fatG,     t: targets.fatG,     icon: "fa-solid fa-droplet" },
      ],
      [
        { key: "salt",  l: "Muối",  c: "gray",   v: totals.saltG,  t: targets.saltG,  icon: "fa-solid fa-jar" },
        { key: "sugar", l: "Đường", c: "orange", v: totals.sugarG, t: targets.sugarG, icon: "fa-solid fa-cubes" },
        { key: "fiber", l: "Chất xơ", c: "teal",   v: totals.fiberG, t: targets.fiberG, icon: "fa-solid fa-leaf" },
      ],
    ],
    [totals, targets]
  );

  /* ====== Components Helpers ====== */
  const DateStrip = () => {
    const dObj = dayjs(date);
    const today = dayjs(); // Lấy ngày hiện tại
    const days = [-3,-2,-1,0,1,2,3].map(i => dObj.add(i, 'day'));
    
    
    return (
      <div className="st-date-strip">
        <button className="st-ds-nav" onClick={()=>setDate(dObj.add(-1,'day').format("YYYY-MM-DD"))}>&lt;</button>
        {days.map(d => {
          const isSel = d.isSame(dObj, 'day');
          const isToday = d.isSame(today, 'day'); // Check hôm nay
          return (
            <div key={d.toString()} className={"st-ds-item" + (isSel?" active":"")} onClick={()=>setDate(d.format("YYYY-MM-DD"))}>
              {isToday ? (
                /* Hiển thị Hôm nay nếu là ngày hiện tại */
                <>
                  <span className="d-day">{d.date()}</span>
                  <span className="d-mo">Hôm nay</span>
                </>
              ) : (
                <>
                  <span className="d-day">{d.date()}</span>
                  <span className="d-mo">Thg {d.month()+1}</span>
                </>
              )}
            </div>
          )
        })}
        <button className="st-ds-nav" onClick={()=>setDate(dObj.add(1,'day').format("YYYY-MM-DD"))}>&gt;</button>
      </div>
    )
  };

  return (
    <div className="st-page">
      <div className="st-wrap">
        {/* HEADER TRANG THỐNG KÊ */}
        <div className="st-header">
          <div>
            <h1>Thống kê</h1>
            <p>Tổng quan dinh dưỡng & hoạt động trong ngày của bạn</p>
          </div>
          <div className="st-header-right">
            <span className="st-header-pill">
              <i className="fa-regular fa-calendar" />
              {dayjs(date).format("DD/MM/YYYY")}
            </span>
          </div>
        </div>

        <div className="st-grid-layout">
          {/* 1. Tổng quan */}
          <div className="st-card st-col-overview">
            <div className="st-card-header space-between">
              <div className="st-card-title lg">Tổng quan</div>
              <div className="st-streak-badge">
                <i className={"fa-solid fa-fire " + (hot ? "hot" : "cold")} /> {streak}
              </div>
            </div>
            <DateStrip />
            {!timeSlots.length ? (
              <div className="st-empty">Chưa có món ăn.</div>
            ) : (
              <div className="st-timeline-body">
                {timeSlots.map(({ hour, items, totalKcal }) => (
                  <div key={hour} className="st-ts-group">
                    <div className="st-ts-head">
                      {hour}:00 - {Math.round(totalKcal)} Calo
                    </div>
                    <div className="st-ts-list">
                      {items.map((it) => (
                        <div key={it._id} className="st-meal-row">
                          <img src={it.foodAbs} alt="" />
                          <div className="st-meal-info">
                            <div>{it.food?.name}</div>
                            <span>
                              {Math.round(it.food?.kcal * it.quantity)} cal · x{it.quantity}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Mục tiêu Calo */}
          <div className="st-card st-box-calories">
            <div className="st-card-header">
              <div className="st-card-title">Mục tiêu Calo</div>
            </div>
            <div className="st-cal-body">
              <div className="st-cal-ring-wrap">{renderRing()}</div>
              <div className="st-cal-meta">
                <div className="c">
                  <div className="v">{kcalTarget}</div>
                  <div className="lb">Mục tiêu</div>
                </div>
                <div className="c">
                  <div className="v">{kcalAte}</div>
                  <div className="lb">Đã nạp</div>
                </div>
                <div className="c">
                  <div className="v">{kcalBurned}</div>
                  <div className="lb">Tập luyện</div>
                </div>
              </div>
            </div>
          </div>

                  {/* 3. Tập luyện */}
        <div className="st-card st-box-workout relative">
          <div className="st-card-header">
            <div className="st-card-title">Tập luyện</div>
          </div>
          <button
            className="st-btn-add-corner"
            onClick={() => setModal("WORKOUT")}
            title="Chọn lịch tập cho ngày này"
          >
            +
          </button>
          <div className="st-stat-body">
            <div className="st-stat-big">
              <i className="fa-solid fa-fire-flame-curved" /> {kcalBurned}
            </div>
            <div className="st-stat-sub">
              {activity.workouts?.length || 0} bài tập
            </div>
            {activity.workouts?.length > 0 && (
              <div className="st-workout-names" title={workoutNamesText}>
                {workoutNamesText}
              </div>
            )}
          </div>
        </div>

          {/* 4. Bước chân */}
          <div className="st-card st-box-steps relative">
            <div className="st-card-header">
              <div className="st-card-title">Bước chân</div>
            </div>
            <button
              className="st-btn-add-corner"
              onClick={() => setModal("STEPS")}
              title="Cập nhật số bước"
            >
              +
            </button>
            <div className="st-stat-body">
              <div className="st-stat-big">
                {(activity.steps || 0).toLocaleString()}
              </div>
              <div className="st-stat-sub">/ {STEP_GOAL.toLocaleString()} bước</div>
              <div className="st-prog-bar">
                <div
                  style={{
                    width: `${Math.min(
                      100,
                      ((activity.steps || 0) / STEP_GOAL) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* 5. Nước */}
          <div className="st-card st-box-water">
            <div className="panel-stt-water">
              <div className="wleft">
                <i className="fa-solid fa-glass-water" />
                <div>
                  <div className="wlabel">Uống nước</div>
                  <div className="wval">{waterMl} ml</div>
                </div>
              </div>
              <div className="wctl">
                <button onClick={() => waterDelta(-stepMl)}>-</button>
                <div className="wu-wrap">
                  <input
                    type="number"
                    value={stepMl}
                    onChange={(e) => setStepMl(+e.target.value || 0)}
                  />
                  <span>ml</span>
                </div>
                <button onClick={() => waterDelta(+stepMl)}>+</button>
              </div>
            </div>
          </div>

        {/* 6. Dinh dưỡng */}
        <div className="st-card st-box-nutrition">
          <div className="st-card-header">
            <div className="st-card-title">Dinh dưỡng</div>
          </div>

          <div
            className="st-macro-slider"
            onMouseDown={handleMacroSlideStart}
            onMouseUp={handleMacroSlideEnd}
            onTouchStart={handleMacroSlideStart}
            onTouchEnd={handleMacroSlideEnd}
          >
            <div
              className="st-macro-inner"
              style={{ transform: `translateX(-${macroPage * 100}%)` }}
            >
              {macroPages.map((page, idx) => (
                <div className="st-macro-page" key={idx}>
                  {page.map((m) => (
                    <MacroItem key={m.key} {...m} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="st-macro-dots">
            {macroPages.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={
                  "st-macro-dot" + (macroPage === idx ? " is-active" : "")
                }
                onClick={() => setMacroPage(idx)}
              />
            ))}
          </div>
        </div>


          {/* 7. Cân nặng */}
          <div className="st-card st-box-weight relative">
            <div className="st-card-header">
              <div className="st-card-title">Cân nặng (kg)</div>
            </div>
            <button
              className="st-btn-add-corner"
              onClick={() => setModal("WEIGHT")}
              title="Cập nhật cân nặng"
            >
              +
            </button>
            <div className="st-weight-body">
              <div className="st-w-left">
                <div className="st-w-curr">
                  {activity.weightKg || "--"} <span>kg</span>
                </div>
                <div className="st-w-lbl">Gần nhất</div>
              </div>
              <div className="st-w-chart">
                {!weightHistory.length ? (
                  <span className="st-no-data">Chưa có dữ liệu</span>
                ) : (
                  <div className="st-chart-viz">
                    <div className="st-chart-line" />
                    {weightHistory.map((p, i) => (
                      <div
                        key={p.date}
                        className="st-cp"
                        style={{
                          left: `${
                            (i / Math.max(1, weightHistory.length - 1)) * 100
                          }%`,
                        }}
                      >
                        <div className="st-cdot" />
                        <span className="st-ctip">
                          {dayjs(p.date).format("DD")}·{p.weight}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* MODALS */}
        {modal === "WORKOUT" && (
          <WorkoutModal
            options={workOptions}
            initialSelectedIds={Array.from(selectedWorkoutIds)}
            onClose={() => setModal(null)}
            onSave={handleSaveWorkouts}
          />
        )}
        {modal === "STEPS" && (
          <SimpleInputModal
            title="Cập nhật bước chân"
            currentVal={activity.steps}
            unit="bước"
            step={100}
            onClose={() => setModal(null)}
            onSave={handleSaveSteps}
          />
        )}
        {modal === "WEIGHT" && (
          <SimpleInputModal
            title="Cập nhật cân nặng"
            currentVal={activity.weightKg}
            unit="kg"
            step={0.1}
            onClose={() => setModal(null)}
            onSave={handleSaveWeight}
          />
        )}
      </div>
    </div>
  );
}

const MacroItem = ({ l, c, v, t, icon }) => {
  const cur = Math.round(v || 0);
  const target = t || 0;
  const pct = target ? Math.min(100, (cur / target) * 100) : 0;
  return (
    <div className="st-macro-item">
      <div className="st-macro-top">
        {icon && (
          <span className={"st-macro-icon " + c}>
            <i className={icon} />
          </span>
        )}
        <span className="st-macro-label">{l}</span>
      </div>
      <div className={"st-macro-bar bar " + c}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="st-macro-val">
        {cur}
        <span> / {target}{target ? "g" : ""}</span>
      </div>
    </div>
  );
};
