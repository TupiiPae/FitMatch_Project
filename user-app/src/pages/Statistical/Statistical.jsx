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
} from "../../api/activity";
import { getOnboardingData } from "../../api/onboarding";
import api from "../../lib/api";
import { toast } from "react-toastify";
import { WorkoutModal, SimpleInputModal, WaterModal  } from "./StatisticalModals";
import { getMe } from "../../api/account";

const STEP_GOAL = 8000,
  PLACEHOLDER = "/images/food-placeholder.jpg";
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};
const toNum = (v, d = 0) =>
  v == null || v === "" || isNaN(+v) ? d : +v;

function mapWorkoutToOption(p) {
  const t = p?.totals || {};
  return {
    id: p._id,
    name: p.name || "(No name)",
    kcal: t.kcal ?? t.calories ?? p.totalKcal ?? 0,
  };
}
const pickWorkoutRes = (r) => r?.data?.data || r?.data || r || {};

export default function Statistical() {
  const [date, setDate] = useState(() => dayjs().format("YYYY-MM-DD"));
  const [logs, setLogs] = useState([]);
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
  const [streak, setStreak] = useState(0);
  const [hot, setHot] = useState(false);
  const [activity, setActivity] = useState({
    steps: 0,
    weightKg: null,
    workouts: [],
  });
  const [workOptions, setWorkOptions] = useState([]);
  const [modal, setModal] = useState(null);
  const [weightBase, setWeightBase] = useState(null); // cân nặng gốc trong onboarding
  const [weightGoal, setWeightGoal] = useState(null); // cân nặng mục tiêu trong onboarding
  const [userWeight, setUserWeight] = useState(null); // cân nặng hiện tại trong user.profile

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

  const kcalTarget = Math.round(targets.kcal || 0),
    kcalAte = Math.round(totals.kcal || 0),
    kcalBurned = Math.round(totalBurnedKcal || 0);
  const kcalBudget = Math.max(0, kcalTarget + kcalBurned);
  const kcalRemaining = Math.max(0, kcalBudget - kcalAte);
  const kcalUsedPct = kcalBudget ? Math.min(1, kcalAte / kcalBudget) : 0;

  const timeSlots = useMemo(() => {
    const map = {};
    for (const it of logs) {
      const h = Number(it.hour);
      if (!map[h]) map[h] = [];
      map[h].push(it);
    }
    return Object.entries(map)
      .map(([h, arr]) => ({
        hour: Number(h),
        items: arr,
        totalKcal: arr.reduce(
          (s, i) => s + (i.food?.kcal || 0) * toNum(i.quantity, 1),
          0
        ),
      }))
      .sort((a, b) => a.hour - b.hour);
  }, [logs]);

  // Cân nặng hiện tại (ưu tiên: profile -> log activity -> onboarding base)
  const weightCurrent = userWeight ?? activity.weightKg ?? weightBase;

  const { weightProgress, kgLeft } = useMemo(() => {
    if (
      weightBase == null ||
      weightGoal == null ||
      weightCurrent == null ||
      weightBase === weightGoal
    ) {
      return { weightProgress: 0, kgLeft: null };
    }

    let progress = 0;
    let left = 0;

    if (weightGoal < weightBase) {
      const total = weightBase - weightGoal;
      if (weightCurrent >= weightBase) {
        progress = 0;
        left = total;
      } else if (weightCurrent <= weightGoal) {
        progress = 1;
        left = 0;
      } else {
        progress = (weightBase - weightCurrent) / total;
        left = weightCurrent - weightGoal;
      }
    } else if (weightGoal > weightBase) {
      const total = weightGoal - weightBase;
      if (weightCurrent <= weightBase) {
        progress = 0;
        left = total;
      } else if (weightCurrent >= weightGoal) {
        progress = 1;
        left = 0;
      } else {
        progress = (weightCurrent - weightBase) / total;
        left = weightGoal - weightCurrent;
      }
    }

    return {
      weightProgress: Math.max(0, Math.min(1, progress)),
      kgLeft: left,
    };
  }, [weightBase, weightGoal, weightCurrent]);

  const updateActivity = (patch) => {
    setActivity((prev) => ({ ...prev, ...patch }));
  };

  /* ====== API ====== */
  async function loadData() {
    const [l, w, s, actRes] = await Promise.all([
      getDayLogs(date),
      getWater(date),
      getStreak(),
      getDailyActivity(date),
    ]);

    setLogs(
      (l.data?.items || []).map((it) => ({
        ...it,
        hour: Number(it.hour),
        quantity: Number(it.quantity ?? 1),
        foodAbs: it.food?.imageUrl ? toAbs(it.food.imageUrl) : PLACEHOLDER,
      }))
    );

    const t = l.data?.totals || {},
      g = l.data?.targets || {};
    setTotals({
      kcal: +t.kcal || 0,
      proteinG: +t.proteinG || 0,
      carbG: +t.carbG || 0,
      fatG: +t.fatG || 0,
      sugarG: +t.sugarG || 0,
      saltG: +t.saltG || 0,
      fiberG: +t.fiberG || 0,
    });
    setTargets({
      kcal: +g.kcal || 0,
      proteinG: +g.proteinG || 0,
      carbG: +g.carbG || 0,
      fatG: +g.fatG || 0,
      sugarG: +g.sugarG || 0,
      saltG: +g.saltG || 0,
      fiberG: +g.fiberG || 0,
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

  useEffect(() => {
    loadData();
  }, [date]);

  // Lấy goal / cân nặng gốc từ onboarding
  useEffect(() => {
    getOnboardingData()
      .then((res) => {
        const ob =
          res?.onboarding ??
          res?.data?.onboarding ??
          res?.data ??
          res;

        if (!ob) return;

        const baseBlock = ob.base || {};
        const goals = Array.isArray(ob.goals) ? ob.goals : [];
        const activeGoal = goals.find((g) => g.status === "active") || null;

        const baseWeight =
          (activeGoal && activeGoal.canNangHienTai) ??
          baseBlock.canNangHienTai ??
          null;

        const goalWeight =
          (activeGoal && activeGoal.canNangMongMuon) ??
          baseBlock.canNangMongMuon ??
          null;

        setWeightBase(baseWeight != null ? Number(baseWeight) : null);
        setWeightGoal(goalWeight != null ? Number(goalWeight) : null);
      })
      .catch(() => {});
  }, []);

  // Lấy cân nặng hiện tại từ user.profile
  useEffect(() => {
    getMe()
      .then((user) => {
        setUserWeight(user?.profile?.weightKg ?? null);
      })
      .catch(() => {});
  }, []);

  // Lấy danh sách workout (1 lần)
  useEffect(() => {
    (async () => {
      try {
        const res = await listMyWorkouts({
          q: "",
          limit: 50,
          skip: 0,
        });
        const raw = pickWorkoutRes(res);
        const items = (raw.items || []).map(mapWorkoutToOption);
        setWorkOptions(items);
      } catch (err) {
        console.error("Đã có lỗi xảy ra:", err);
      }
    })();
  }, []);

  const handleSaveWorkouts = async (selected) => {
    try {
      await saveDailyWorkouts({
        date,
        workoutIds: selected.map((w) => w.id),
      });
      updateActivity({ workouts: selected });
      toast.success("Đã lưu lịch tập cho ngày này");
      setModal(null);
    } catch (e) {
      console.error(e);
      toast.error("Không lưu được lịch tập");
    }
  };

    const handleSaveWater = async (val) => {
    const want = Math.max(0, Math.min(10000, Number(val) || 0));
    try {
      if (want !== waterMl) {
        await incWater({ date, deltaMl: want - waterMl });
        setWaterMl(want);
      }
      toast.success("Đã cập nhật lượng nước");
      setModal(null);
    } catch (e) {
      console.error(e);
      toast.error("Không lưu được lượng nước");
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
      toast.success("Đã cập nhật cân nặng");
      setModal(null);
    } catch (e) {
      console.error(e);
      toast.error("Không lưu được cân nặng");
    }
  };

  /* ====== RENDER HELPERS ====== */

  // Vòng tròn Calo (full circle)
  const renderRing = () => {
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const pct = kcalUsedPct;
    const offset = circumference * (1 - pct);

    return (
      <div className="st-cal-circle">
        <svg viewBox="0 0 160 160">
          <circle
            className="ring-bg"
            cx="80"
            cy="80"
            r={radius}
            pathLength={circumference}
          />
          <circle
            className="ring-fg ring-fg-cal"
            cx="80"
            cy="80"
            r={radius}
            pathLength={circumference}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="st-cal-circle-center">
          <div className="cc-val">{kcalRemaining}</div>
          <div className="cc-lbl">Calo còn lại</div>
        </div>
      </div>
    );
  };

  // Vòng cung cân nặng (nửa vòng)
  const renderWeightRing = () => {
    const length = Math.PI * 80;
    const pct =
      weightProgress != null ? Math.min(1, Math.max(0, weightProgress)) : 0;
    const offset = length * (1 - pct);

    return (
      <div className="st-weight-ring">
        <svg width="250" height="160" viewBox="0 0 200 140">
          <path
            className="ring-bg weightRing-bg"
            d="M20 90 A80 80 0 0 1 180 90"
            pathLength={length}
          />
          <path
            className="ring-fg ring-fg-weight weightRing-fg"
            d="M20 90 A80 80 0 0 1 180 90"
            pathLength={length}
            strokeDasharray={length}
            strokeDashoffset={offset}
          />
        </svg>

        <div className="st-weight-center">
          <div className="st-weight-center-value">
            {weightCurrent != null ? weightCurrent.toFixed(1) : "--"}
            <span>kg</span>
          </div>
          <div className="st-weight-center-label">Cân nặng hiện tại</div>
          {kgLeft != null && (
            <div className="st-weight-center-left">
              {kgLeft.toFixed(1)} kg còn lại
            </div>
          )}
        </div>

        <div className="st-weight-range">
          <span>{weightBase != null ? weightBase.toFixed(1) : "--"}</span>
          <span>{weightGoal != null ? weightGoal.toFixed(1) : "--"}</span>
        </div>
      </div>
    );
  };

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
          <span>
            {" "}
            / {target}
            {target ? "g" : ""}
          </span>
        </div>
      </div>
    );
  };

  const macroPages = useMemo(
    () => [
      [
        {
          key: "protein",
          l: "Chất đạm",
          c: "red",
          v: totals.proteinG,
          t: targets.proteinG,
          icon: "fa-solid fa-bolt",
        },
        {
          key: "carb",
          l: "Đường bột",
          c: "purple",
          v: totals.carbG,
          t: targets.carbG,
          icon: "fa-solid fa-wheat-awn",
        },
        {
          key: "fat",
          l: "Chất béo",
          c: "green",
          v: totals.fatG,
          t: targets.fatG,
          icon: "fa-solid fa-droplet",
        },
      ],
      [
        {
          key: "salt",
          l: "Muối",
          c: "gray",
          v: totals.saltG,
          t: targets.saltG,
          icon: "fa-solid fa-jar",
        },
        {
          key: "sugar",
          l: "Đường",
          c: "orange",
          v: totals.sugarG,
          t: targets.sugarG,
          icon: "fa-solid fa-cubes",
        },
        {
          key: "fiber",
          l: "Chất xơ",
          c: "teal",
          v: totals.fiberG,
          t: targets.fiberG,
          icon: "fa-solid fa-leaf",
        },
      ],
    ],
    [totals, targets]
  );

  /* ====== Components Helpers ====== */
  const DateStrip = () => {
    const dObj = dayjs(date);
    const today = dayjs();
    const days = [-2, -1, 0, 1, 2].map((i) => dObj.add(i, "day"));

    return (
      <div className="st-date-strip">
        <button
          className="st-ds-nav"
          onClick={() =>
            setDate(dObj.add(-1, "day").format("YYYY-MM-DD"))
          }
        >
          &lt;
        </button>
        {days.map((d) => {
          const isSel = d.isSame(dObj, "day");
          const isToday = d.isSame(today, "day");
          return (
            <div
              key={d.toString()}
              className={"st-ds-item" + (isSel ? " active" : "")}
              onClick={() => setDate(d.format("YYYY-MM-DD"))}
            >
              {isToday ? (
                <>
                  <span className="d-day">{d.date()}</span>
                  <span className="d-mo">Hôm nay</span>
                </>
              ) : (
                <>
                  <span className="d-day">{d.date()}</span>
                  <span className="d-mo">Thg {d.month() + 1}</span>
                </>
              )}
            </div>
          );
        })}
        <button
          className="st-ds-nav"
          onClick={() =>
            setDate(dObj.add(1, "day").format("YYYY-MM-DD"))
          }
        >
          &gt;
        </button>
      </div>
    );
  };

  /* ====== RENDER PAGE ====== */
  return (
    <div className="st-page">
      <div className="st-wrap">
        {/* HEADER */}
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
          {/* Hàng 1 – CÂN NẶNG + CALO */}
          <div className="st-row-top">
            {/* Cân nặng */}
            <div className="st-card st-box-weight relative">
              <div className="st-card-header">
                <div className="st-card-title">Cân nặng</div>
              </div>
              <button
                className="st-btn-add-corner"
                onClick={() => setModal("WEIGHT")}
                title="Cập nhật cân nặng"
              >
                +
              </button>

              <div className="st-weight-body gauge">{renderWeightRing()}</div>
            </div>

            {/* Lượng Calo tiêu thụ */}
            <div className="st-card st-box-calories">
              <div className="st-card-header">
                <div className="st-card-title">Lượng Calo tiêu thụ</div>
              </div>
              <div className="st-cal-grid">
                {/* Trái: vòng tròn calo */}
                <div className="st-cal-left">{renderRing()}</div>

                {/* Phải: 3 số (nằm ngang) + macros */}
                <div className="st-cal-right">
                  <div className="st-cal-meta st-cal-meta-row">
                    
                    {/* Item 1: Mục tiêu */}
                    <div className="c">
                      <div className="st-cal-icon">
                        <i className="fa-solid fa-bullseye"></i>
                      </div>
                      <div className="st-cal-info">
                        <div className="v">
                          {kcalTarget}<span> cal</span>
                        </div>
                        <div className="lb">Mục tiêu</div>
                      </div>
                    </div>
                    {/* Item 2: Đã nạp */}
                    <div className="c">
                      <div className="st-cal-icon">
                        <i className="fa-solid fa-utensils"></i>
                      </div>
                      <div className="st-cal-info">
                        <div className="v">
                          {kcalAte}<span> cal</span>
                        </div>
                        <div className="lb">Đã nạp</div>
                      </div>
                    </div>
                    {/* Item 3: Tập luyện */}
                    <div className="c">
                      <div className="st-cal-icon">
                        <i className="fa-solid fa-fire"></i>
                      </div>
                      <div className="st-cal-info">
                        <div className="v">
                          {kcalBurned}<span> cal</span>
                        </div>
                        <div className="lb">Tập luyện</div>
                      </div>
                    </div>
                  </div>

                  <div className="st-cal-macros-head">
                    <span className="st-cal-macros-title">Dinh dưỡng</span>
                    <span className="st-cal-macros-sub">
                      Macros trong ngày
                    </span>
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
                      style={{
                        transform: `translateX(-${macroPage * 100}%)`,
                      }}
                    >
                      {macroPages.map((page, idx) => (
                        <div className="st-macro-page" key={idx}>
                          {page.map((m) => {
                            const { key, ...rest } = m; // tách riêng key
                            return <MacroItem key={key} {...rest} />;
                          })}
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
                          "st-macro-dot" +
                          (macroPage === idx ? " is-active" : "")
                        }
                        onClick={() => setMacroPage(idx)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cột 3 – TỔNG QUAN / NHẬT KÝ MÓN ĂN (chiếm hết cột 3) */}
          <div className="st-card st-col-overview">
            <div className="st-card-header space-between">
              <div className="st-card-title lg">Tổng quan</div>
              <div className="st-streak-badge">
                <i
                  className={
                    "fa-solid fa-fire " + (hot ? "hot" : "cold")
                  }
                />{" "}
                {streak}
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
                              {Math.round(
                                it.food?.kcal * it.quantity
                              )}{" "}
                              cal · x
                              {it.quantity}
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

          {/* HÀNG 2 – 3 box: NƯỚC / BƯỚC CHÂN / TẬP LUYỆN */}
          <div className="st-row-middle">
            {/* Title hàng 2 */}
            <div className="st-section-head">
              <div>
                <div className="st-section-title">Hoạt động trong ngày</div>
                <div className="st-section-sub">
                  Theo dõi lượng nước, bước chân và tập luyện mỗi ngày
                </div>
              </div>
            </div>

            <div className="st-row-middle-grid">
              {/* Nước */}
              <div className="st-card st-box-water relative">
                <div className="st-card-header">
                  <div className="st-card-title">Lượng nước</div>
                </div>
                <button
                  className="st-btn-add-corner"
                  onClick={() => setModal("WATER")}
                  title="Cập nhật lượng nước"
                >
                  +
                </button>
                <div className="st-stat-body">
                  <div className="st-stat-big">
                    <i className="water fa-solid fa-glass-water-droplet"></i>
                    {waterMl.toLocaleString()}
                    <span style={{ fontSize: 14, marginLeft: 4 }}> ml</span>
                  </div>
                  <div className="st-stat-sub">Tổng nước đã uống hôm nay</div>
                </div>
              </div>

              {/* Bước chân */}
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
                  <div className="st-stat-sub">
                    / {STEP_GOAL.toLocaleString()} bước
                  </div>
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

              {/* Tập luyện – tổng kcal */}
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
                    <i className="fa-solid fa-fire-flame-curved" />{" "}
                    {kcalBurned}
                  </div>
                  <div className="st-stat-sub">
                    {activity.workouts?.length || 0} bài tập
                  </div>
                  {activity.workouts?.length > 0 && (
                    <div
                      className="st-workout-names"
                      title={workoutNamesText}
                    >
                      {workoutNamesText}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* HÀNG 3 – THỰC ĐƠN GỢI Ý + BÀI TẬP CHI TIẾT */}
          <div className="st-row-bottom">
            {/* Thực đơn gợi ý – 2/3 chiều ngang */}
            <div className="st-card st-box-suggest">
              <div className="st-card-header">
                <div className="st-card-title">Thực đơn gợi ý</div>
              </div>
              <div className="st-suggest-body">
                <p className="st-suggest-desc">
                  Hệ thống sẽ gợi ý thực đơn phù hợp với mục tiêu{" "}
                  <strong>{kcalTarget || 0} kcal</strong> / ngày của bạn.
                </p>
                <div className="st-suggest-placeholder">
                  <span>👩‍🍳 Tính năng gợi ý thực đơn sẽ xuất hiện tại đây.</span>
                </div>
              </div>
            </div>

            {/* Bài tập chi tiết – 1/3 chiều ngang */}
            <div className="st-card st-box-workout-detail">
              <div className="st-card-header">
                <div className="st-card-title">Bài tập trong ngày</div>
              </div>
              <div className="st-workout-list-body">
                {activity.workouts?.length ? (
                  <ul className="st-workout-list">
                    {activity.workouts.map((w) => (
                      <li key={w.id} className="st-workout-list-item">
                        <div className="st-wl-name">
                          {w.name || "(Không tên)"}
                        </div>
                        <div className="st-wl-kcal">
                          {Math.round(w.kcal || 0)} kcal
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="st-empty">
                    Chưa chọn lịch tập cho ngày này.
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
        {modal === "WATER" && (
          <WaterModal
            currentVal={waterMl}
            onClose={() => setModal(null)}
            onSave={handleSaveWater}
          />
        )}
      </div>
    </div>
  );
}
