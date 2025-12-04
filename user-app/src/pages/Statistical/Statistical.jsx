// src/pages/Statistical/Statistical.jsx
import { useEffect, useMemo, useState } from "react"; import dayjs from "dayjs"; import "./Statistical.css";
import { getDayLogs, getWater, incWater, getStreak } from "../../api/nutrition";
import { listMyWorkouts } from "../../api/workouts"; import api from "../../lib/api"; import { toast } from "react-toastify";
import { WorkoutModal, SimpleInputModal } from "./StatisticalModals"; 

/* ===== Helpers & Constants ===== */
const LS_KEY="fm_daily_stats_v1", STEP_GOAL=8000, PLACEHOLDER="/images/food-placeholder.jpg";
const API_ORIGIN=(api?.defaults?.baseURL||"").replace(/\/+$/,"");
const toAbs=u=>{if(!u)return u;try{return new URL(u,API_ORIGIN).toString()}catch{return u}};
const round1=v=>Math.round((v||0)*10)/10, toNum=(v,d=0)=>v==null||v===""||isNaN(+v)?d:+v;

function readStatFor(d){ try{const r=window.localStorage.getItem(LS_KEY);return (r?JSON.parse(r):{})[d]||{steps:0,weightKg:null,workouts:[]}}catch{return {steps:0,weightKg:null,workouts:[]}} }
function writeAllStatLocal(d, val){ try{const r=JSON.parse(window.localStorage.getItem(LS_KEY)||'{}'); r[d]=val; window.localStorage.setItem(LS_KEY,JSON.stringify(r))}catch{} }
function mapWorkoutToOption(p){ const t=p?.totals||{}; return {id:p._id, name:p.name||"(No name)", kcal:t.kcal??t.calories??p.totalKcal??0} }

export default function Statistical() {
  const [date, setDate] = useState(()=>dayjs().format("YYYY-MM-DD"));
  const [logs, setLogs] = useState([]);
  const [totals, setTotals] = useState({kcal:0,proteinG:0,carbG:0,fatG:0,sugarG:0,saltG:0,fiberG:0});
  const [targets, setTargets] = useState({kcal:0,proteinG:0,carbG:0,fatG:0,sugarG:0,saltG:0,fiberG:0});
  const [waterMl, setWaterMl] = useState(0); const [stepMl, setStepMl] = useState(250);
  const [streak, setStreak] = useState(0); const [hot, setHot] = useState(false);
  const [activity, setActivity] = useState(()=>readStatFor(dayjs().format("YYYY-MM-DD")));
  const [workOptions, setWorkOptions] = useState([]); 
  const [modal, setModal] = useState(null);
  

  /* ====== Logic ====== */
  const selectedWorkoutIds = useMemo(()=>new Set((activity.workouts||[]).map(w=>w.id)),[activity.workouts]);
  const totalBurnedKcal = useMemo(()=>(activity.workouts||[]).reduce((s,w)=>s+(w.kcal||0),0),[activity.workouts]);
  const kcalTarget=Math.round(targets.kcal||0), kcalAte=Math.round(totals.kcal||0), kcalBurned=Math.round(totalBurnedKcal||0);
  const kcalBudget=Math.max(0,kcalTarget+kcalBurned), kcalRemaining=Math.max(0,kcalBudget-kcalAte), kcalUsedPct=kcalBudget?Math.min(1,kcalAte/kcalBudget):0;

  const timeSlots = useMemo(() => {
    const map={}; 
    for(const it of logs){ const h=Number(it.hour); if(!map[h])map[h]=[]; map[h].push(it); }
    return Object.entries(map).map(([h,arr])=>({ hour:Number(h), items:arr, totalKcal: arr.reduce((s,i)=>s+(i.food?.kcal||0)*toNum(i.quantity,1),0) })).sort((a,b)=>a.hour-b.hour);
  }, [logs]);

  const weightHistory = useMemo(() => {
    try{ const all=JSON.parse(window.localStorage.getItem(LS_KEY)||'{}');
      return Object.entries(all).filter(([,v])=>v&&v.weightKg!=null).sort(([a],[b])=>a<b?-1:1).slice(-10).map(([d,v])=>({date:d, weight:Number(v.weightKg)}));
    }catch{return []}
  }, [activity.weightKg, date]);

  const updateActivity = patch => { setActivity(prev=>{ const next={...prev,...patch}; writeAllStatLocal(date, next); return next; }); };

  /* ====== API ====== */
  async function loadData() {
    const [l, w, s] = await Promise.all([getDayLogs(date), getWater(date), getStreak()]);
    setLogs((l.data?.items||[]).map(it=>({ ...it, hour:Number(it.hour), quantity:Number(it.quantity??1), foodAbs:it.food?.imageUrl?toAbs(it.food.imageUrl):PLACEHOLDER })));
    const t=l.data?.totals||{}, g=l.data?.targets||{};
    setTotals({kcal:+t.kcal||0,proteinG:+t.proteinG||0,carbG:+t.carbG||0,fatG:+t.fatG||0,sugarG:+t.sugarG||0,saltG:+t.saltG||0,fiberG:+t.fiberG||0});
    setTargets({kcal:+g.kcal||0,proteinG:+g.proteinG||0,carbG:+g.carbG||0,fatG:+g.fatG||0,sugarG:+g.sugarG||0,saltG:+g.saltG||0,fiberG:+g.fiberG||0});
    setWaterMl(Number(w.data?.amountMl||0));
    setStreak(Number(s.data?.streak||0)); setHot(Number(s.data?.streak||0)>=2);
    setActivity(readStatFor(date));
  }
  
  useEffect(()=>{ loadData(); },[date]);
  useEffect(()=>{ listMyWorkouts({limit:50}).then(res=>setWorkOptions(((res?.data?.data||res?.data||{}).items||[]).map(mapWorkoutToOption))).catch(()=>{}); },[]);

  /* ====== Handlers ====== */
  const waterDelta = async(d) => { const want=Math.max(0,Math.min(10000,waterMl+d)); if(want!==waterMl){ await incWater({date,deltaMl:want-waterMl}); setWaterMl(want); }};
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
    <div className="st-page"><div className="st-wrap">
      <div className="st-grid-layout">
        {/* 1. Tổng quan */}
        <div className="st-card st-col-overview">
          <div className="st-card-header space-between">
            <div className="st-card-title lg">Tổng quan</div>
            <div className="st-streak-badge"><i className={"fa-solid fa-fire "+(hot?"hot":"cold")}/> {streak}</div>
          </div>
          <DateStrip />
          {!timeSlots.length ? <div className="st-empty">Chưa có món ăn.</div> : <div className="st-timeline-body">{timeSlots.map(({hour,items,totalKcal})=>(
            <div key={hour} className="st-ts-group">
              <div className="st-ts-head">{hour}:00 - {Math.round(totalKcal)} Calo</div>
              <div className="st-ts-list">{items.map(it=>(
                 <div key={it._id} className="st-meal-row"><img src={it.foodAbs} alt=""/><div className="st-meal-info"><div>{it.food?.name}</div><span>{Math.round(it.food?.kcal*it.quantity)} cal · x{it.quantity}</span></div></div>
              ))}</div>
            </div>
          ))}</div>}
        </div>

        {/* 2. Mục tiêu Calo */}
        <div className="st-card st-box-calories">
          <div className="st-card-header"><div className="st-card-title">Mục tiêu Calo</div></div>
          <div className="st-cal-body">
            <div className="st-cal-ring-wrap">{renderRing()}</div>
            <div className="st-cal-meta">
              <div className="c"><div className="v">{kcalTarget}</div><div className="lb">Mục tiêu</div></div>
              <div className="c"><div className="v">{kcalAte}</div><div className="lb">Đã nạp</div></div>
              <div className="c"><div className="v">{kcalBurned}</div><div className="lb">Tập luyện</div></div>
            </div>
          </div>
        </div>

        {/* 3. Tập luyện */}
        <div className="st-card st-box-workout relative">
          <div className="st-card-header"><div className="st-card-title">Tập luyện</div></div>
          <button className="st-btn-add-corner" onClick={()=>setModal('WORKOUT')}>+</button>
          <div className="st-stat-body">
            <div className="st-stat-big"><i className="fa-solid fa-fire-flame-curved"/> {kcalBurned}</div>
            <div className="st-stat-sub">{activity.workouts?.length||0} bài tập</div>
          </div>
        </div>

        {/* 4. Bước chân */}
        <div className="st-card st-box-steps relative">
          <div className="st-card-header"><div className="st-card-title">Bước chân</div></div>
          <button className="st-btn-add-corner" onClick={()=>setModal('STEPS')}>+</button>
          <div className="st-stat-body">
            <div className="st-stat-big">{(activity.steps||0).toLocaleString()}</div>
            <div className="st-stat-sub">/ {STEP_GOAL.toLocaleString()}</div>
            <div className="st-prog-bar"><div style={{width:`${Math.min(100,((activity.steps||0)/STEP_GOAL)*100)}%`}}/></div>
          </div>
        </div>

        {/* 5. Nước */}
        <div className="st-card st-box-water">
           <div className="panel-stt-water"><div className="wleft"><i className="fa-solid fa-glass-water"/><div><div className="wlabel">Uống nước</div><div className="wval">{waterMl} ml</div></div></div>
           <div className="wctl"><button onClick={()=>waterDelta(-stepMl)}>-</button><div className="wu-wrap"><input type="number" value={stepMl} onChange={e=>setStepMl(+e.target.value)}/><span>ml</span></div><button onClick={()=>waterDelta(+stepMl)}>+</button></div></div>
        </div>

        {/* 6. Dinh dưỡng */}
        <div className="st-card st-box-nutrition">
          <div className="st-card-header"><div className="st-card-title">Dinh dưỡng</div></div>
          <div className="st-macro-grid">
            <MacroItem l="Đạm" c="red" v={totals.proteinG} t={targets.proteinG}/> <MacroItem l="Đ.Bột" c="purple" v={totals.carbG} t={targets.carbG}/>
            <MacroItem l="Béo" c="green" v={totals.fatG} t={targets.fatG}/> <MacroItem l="Muối" c="gray" v={totals.saltG} t={targets.saltG}/>
            <MacroItem l="Đường" c="orange" v={totals.sugarG} t={targets.sugarG}/> <MacroItem l="Xơ" c="teal" v={totals.fiberG} t={targets.fiberG}/>
          </div>
        </div>

        {/* 7. Cân nặng */}
        <div className="st-card st-box-weight relative">
          <div className="st-card-header"><div className="st-card-title">Cân nặng (kg)</div></div>
          <button className="st-btn-add-corner" onClick={()=>setModal('WEIGHT')}>+</button>
          <div className="st-weight-body">
            <div className="st-w-left"><div className="st-w-curr">{activity.weightKg||"--"} <span>kg</span></div><div className="st-w-lbl">Gần nhất</div></div>
            <div className="st-w-chart">{!weightHistory.length?<span className="st-no-data">Chưa có dữ liệu</span>:
              <div className="st-chart-viz"><div className="st-chart-line"/>{weightHistory.map((p,i)=><div key={p.date} className="st-cp" style={{left:`${(i/(Math.max(1,weightHistory.length-1)))*100}%`}}><div className="st-cdot"/><span className="st-ctip">{dayjs(p.date).format("DD")}·{p.weight}</span></div>)}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* MODALS */}
      {modal==='WORKOUT' && <WorkoutModal options={workOptions} initialSelectedIds={Array.from(selectedWorkoutIds)} onClose={()=>setModal(null)} onSave={s=>{updateActivity({workouts:s}); toast.success("Đã lưu"); setModal(null)}}/>}
      {modal==='STEPS' && <SimpleInputModal title="Cập nhật bước chân" currentVal={activity.steps} unit="bước" step={100} onClose={()=>setModal(null)} onSave={v=>{updateActivity({steps:v}); toast.success("Đã lưu"); setModal(null)}}/>}
      {modal==='WEIGHT' && <SimpleInputModal title="Cập nhật cân nặng" currentVal={activity.weightKg} unit="kg" step={0.1} onClose={()=>setModal(null)} onSave={v=>{updateActivity({weightKg:v}); toast.success("Đã lưu"); setModal(null)}}/>}
    </div></div>
  );
}

const MacroItem = ({ l, c, v, t }) => (<div className="st-macro-item"><div className="h"><span>{l}</span><small>{Math.round(v)}/{t}</small></div><div className={"bar "+c}><span style={{width:`${t?Math.min(100,(v/t)*100):0}%`}}/></div></div>);