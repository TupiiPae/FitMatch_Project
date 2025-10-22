import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import { getDayLogs, deleteLog, getStreak, getWater, incWater } from "../../api/nutrition";
import "./DailyJournal.css";
import { toast } from "react-toastify";

const HOURS = Array.from({length: 18}, (_,i)=> 6+i); // 6..23

export default function DailyJournal(){
  const [date, setDate] = useState(()=> dayjs().format("YYYY-MM-DD"));
  const [weekDays, setWeekDays] = useState([]);
  const [curDow, setCurDow] = useState(dayjs(date).day()); // 0..6 (CN..T7)
  const [streak, setStreak] = useState(0);
  const [hot, setHot] = useState(false);

  const [logs, setLogs] = useState([]); // [{_id, hour, quantity, massG, food{...}}]
  const [totals, setTotals] = useState({ kcal:0, proteinG:0, carbG:0, fatG:0, sugarG:0, saltG:0, fiberG:0 });
  const [targets, setTargets] = useState({ kcal:0, proteinG:0, carbG:0, fatG:0, sugarG:0, saltG:0, fiberG:0 });

  const [waterMl, setWaterMl] = useState(0);
  const [stepMl, setStepMl] = useState(100); // số ml mỗi lần +/- (user nhập)

  function calcWeek(d){
    const base = dayjs(d);
    const start = base.startOf("week"); // CN
    const arr = Array.from({length:7}, (_,i)=> start.add(i,"day"));
    setWeekDays(arr);
    setCurDow(base.day());
  }

  async function load(){
    const { data } = await getDayLogs(date);
    setLogs(data.items || []);
    setTotals(data.totals || {});
    setTargets(data.targets || {});
  }
  async function loadStreak(){
    const { data } = await getStreak();
    setStreak(data.streak || 0);
    setHot((data.streak||0) >= 2);
  }
  async function loadWater(){
    const { data } = await getWater(date);
    setWaterMl(data.amountMl || 0);
  }

  useEffect(()=>{ calcWeek(date); },[date]);
  useEffect(()=>{ load(); loadWater(); /* eslint-disable-next-line */ },[date]);
  useEffect(()=>{ loadStreak(); },[]);

  const logsByHour = useMemo(()=>{
    const map = {};
    for (const h of HOURS) map[h] = [];
    for (const it of logs) {
      if (map[it.hour]) map[it.hour].push(it);
    }
    return map;
  },[logs]);

    async function onDelete(logId){
    try{
        await deleteLog(logId);
        await load();
        toast.success("Xóa khỏi nhật ký thành công");
    }catch(err){
        toast.error(err?.response?.data?.message || "Xóa khỏi nhật ký thất bại");
    }
    }

  function pct(v,t){ if(!t) return 0; const p = (v/t)*100; return Math.max(0, Math.min(100, p)); }

  async function waterDelta(delta){
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
          <input type="date" value={date} onChange={e=> setDate(e.target.value)} />
        </div>

        <div className="week">
          {weekDays.map((d,i)=>(
            <button key={i}
              className={`wbtn ${dayjs(date).isSame(d,"day") ? "on":""}`}
              onClick={()=> setDate(d.format("YYYY-MM-DD"))}
            >
              {["Chủ Nhật","Thứ hai","Thứ ba","Thứ tư","Thứ năm","Thứ sáu","Thứ bảy"][d.day()]}
            </button>
          ))}
        </div>

        <div className="right">
          <i className={`fa-solid fa-fire ${hot ? "hot": "cold"}`}></i>
          <span className="streak-num">{streak}</span>
        </div>
      </div>

      {/* BODY */}
      <div className="dj-grid">
        {/* LEFT main (2/3) */}
        <div className="dj-main">
          <div className="col-title">Nhật ký hôm nay</div>
          <div className="hour-grid">
            {HOURS.map(h=>(
              <div key={h} className="hour-row" style={{height: (logsByHour[h]?.length ? "auto" : "36px")}}>
                <div className="hh">{h}:00</div>
                <div className="entries">
                  {logsByHour[h].map(item=>(
                    <div key={item._id} className="entry">
                      <img src={item.food?.imageUrl || "/images/food-placeholder.jpg"} alt={item.food?.name}/>
                      <div className="einfo">
                        <div className="etitle">{item.food?.name}</div>
                        <div className="esub">
                          {(item.massG ?? item.food?.massG ?? "-")} g · {(item.food?.kcal ?? "-")} cal
                        </div>
                      </div>
                      <button className="edel" title="Xoá" onClick={()=> onDelete(item._id)}>
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
          <div className="panel">
            <div className="pitem">
              <div className="label">Calorie</div>
              <div className="pbar"><span style={{width:`${pct(totals.kcal, targets.kcal)}%`}} /></div>
              <div className="pval">{Math.round(totals.kcal||0)}/{Math.round(targets.kcal||0)} cal</div>
            </div>
            <div className="pitem">
              <div className="label">Chất đạm</div>
              <div className="pbar red"><span style={{width:`${pct(totals.proteinG, targets.proteinG)}%`}} /></div>
              <div className="pval">{(totals.proteinG||0)}/{Math.round(targets.proteinG||0)}g</div>
            </div>
            <div className="pitem">
              <div className="label">Đường bột</div>
              <div className="pbar purple"><span style={{width:`${pct(totals.carbG, targets.carbG)}%`}} /></div>
              <div className="pval">{(totals.carbG||0)}/{Math.round(targets.carbG||0)}g</div>
            </div>
            <div className="pitem">
              <div className="label">Chất béo</div>
              <div className="pbar green"><span style={{width:`${pct(totals.fatG, targets.fatG)}%`}} /></div>
              <div className="pval">{(totals.fatG||0)}/{Math.round(targets.fatG||0)}g</div>
            </div>
            <div className="pitem">
              <div className="label">Muối</div>
              <div className="pbar gray"><span style={{width:`${pct(totals.saltG, targets.saltG)}%`}} /></div>
              <div className="pval">{(totals.saltG||0)}/{Math.round(targets.saltG||0)}g</div>
            </div>
            <div className="pitem">
              <div className="label">Đường</div>
              <div className="pbar orange"><span style={{width:`${pct(totals.sugarG, targets.sugarG)}%`}} /></div>
              <div className="pval">{(totals.sugarG||0)}/{Math.round(targets.sugarG||0)}g</div>
            </div>
            <div className="pitem">
              <div className="label">Chất xơ</div>
              <div className="pbar teal"><span style={{width:`${pct(totals.fiberG, targets.fiberG)}%`}} /></div>
              <div className="pval">{(totals.fiberG||0)}/{Math.round(targets.fiberG||0)}g</div>
            </div>
          </div>

          <div className="panel water">
            <div className="wtop">
              <i className="fa-solid fa-glass-water-droplet"></i>
              <div>
                <div className="wlabel">Lượng nước</div>
                <div className="wval">{waterMl} ml</div>
              </div>
            </div>
            <div className="wctl">
              <button onClick={()=> waterDelta(-stepMl)}>-</button>
              <input type="number" min="50" max="10000" step="50" value={stepMl} onChange={e=> setStepMl(Math.max(50, Math.min(10000, +e.target.value||100)))} />
              <button onClick={()=> waterDelta(+stepMl)}>+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
