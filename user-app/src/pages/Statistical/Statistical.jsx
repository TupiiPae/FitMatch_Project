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
import { useNavigate } from "react-router-dom";
import { listSuggestMenus, toggleSaveSuggestMenu } from "../../api/suggestMenus";

// helper tính trung bình hiệp / reps / rest cho 1 bài tập
const calcSetStats = (sets = []) => {
  const hiệp = Array.isArray(sets) ? sets.length : 0;
  const repsArr = (Array.isArray(sets) ? sets : [])
    .map((s) => Number(s?.reps || 0))
    .filter((x) => x > 0);
  const restArr = (Array.isArray(sets) ? sets : [])
    .map((s) => Number(s?.restSec || 0))
    .filter((x) => x > 0);
  const avg = (arr) =>
    arr.length
      ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
      : null;
  return {
    hiep: hiệp,
    reps: avg(repsArr),
    rest: avg(restArr),
  };
};

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
const calcStepsKcal = (steps, weightKg) => {
  const s = Math.max(0, Number(steps || 0));
  const w = Number(weightKg || 0);
  if (!w || !s) return 0;

  const MET_WALK = 3.0;      // đi bộ mức trung bình
  const STEPS_PER_MIN = 100; // ~100 bước/phút
  const minutes = s / STEPS_PER_MIN;

  const kcal = (MET_WALK * 3.5 * w * minutes) / 200;
  return Math.round(kcal);
};
const pickWorkoutRes = (r) => r?.data?.data || r?.data || r || {};

// Chuẩn hoá dữ liệu workout lấy từ API /activity
function normalizeActivityWorkout(w) {
  if (!w) return null;
  const src = w.workout || w.plan || w;
  const id = w.id || w.workoutId || src?._id || src?.id;
  const name = src?.name || w.name || "(No name)";
  const kcal =
    w.kcal ??
    w.totalKcal ??
    src?.totals?.kcal ??
    src?.totals?.calories ??
    src?.totalKcal ??
    src?.kcal ??
    0;
  const plan =
    w.plan && typeof w.plan === "object"
      ? w.plan
      : src && src.items && src.totals
      ? src       
      : null;

  if (!id) return null;

  return plan ? { id, name, kcal, plan } : { id, name, kcal };
}

// ---- Helper cho box Thực đơn gợi ý ----
const SUGGEST_CAL_FILTERS = [
  { id: "2000-2200", from: 2000, to: 2200 },
  { id: "2200-2400", from: 2200, to: 2400 },
  { id: "2400-2600", from: 2400, to: 2600 },
  { id: "2600-2800", from: 2600, to: 2800 },
];

// Số ngày của 1 thực đơn (ít nhất 1)
function getSuggestNumDays(menu) {
  if (!menu) return 1;
  const fromField =
    typeof menu.numDays === "number" && menu.numDays > 0
      ? menu.numDays
      : null;
  const fromArray =
    Array.isArray(menu.days) && menu.days.length > 0
      ? menu.days.length
      : null;
  const num = fromField ?? fromArray ?? 1;
  return num > 0 ? num : 1;
}

// Tổng Calo / macros TRUNG BÌNH / NGÀY (giống getTotals ở SuggestMenuList)
function getSuggestTotals(menu) {
  const totalKcalRaw =
    menu.totalKcal ?? menu.totalCalories ?? menu.kcal ?? 0;
  const proteinRaw = menu.totalProteinG ?? menu.proteinG ?? 0;
  const carbRaw = menu.totalCarbG ?? menu.carbG ?? 0;
  const fatRaw = menu.totalFatG ?? menu.fatG ?? 0;

  const days = getSuggestNumDays(menu);

  return {
    totalKcal: Math.round((Number(totalKcalRaw) || 0) / days),
    proteinG: Math.round((Number(proteinRaw) || 0) / days),
    carbG: Math.round((Number(carbRaw) || 0) / days),
    fatG: Math.round((Number(fatRaw) || 0) / days),
  };
}

export default function Statistical() {
  const nav = useNavigate();
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
  const [weightBase, setWeightBase] = useState(null); 
  const [weightGoal, setWeightGoal] = useState(null);
  const [userWeight, setUserWeight] = useState(null); 

  const [suggestItems, setSuggestItems] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const [macroPage, setMacroPage] = useState(0); 
  const macroStartX = useRef(null);

    // ====== SCROLL ACTIVE SECTIONS ======
  const rowTopRef     = useRef(null);   
  const overviewRef   = useRef(null);   
  const rowMiddleRef  = useRef(null);  
  const rowBottomRef  = useRef(null);   

    const [visibleSection, setVisibleSection] = useState({
    rowTop: false,
    overview: false,
    rowMiddle: false,
    rowBottom: false,
  });

  useEffect(() => {
    const entries = [
      { key: "rowTop", ref: rowTopRef },
      { key: "overview", ref: overviewRef },
      { key: "rowMiddle", ref: rowMiddleRef },
      { key: "rowBottom", ref: rowBottomRef },
    ];

    const observer = new IntersectionObserver(
      (ioEntries) => {
        ioEntries.forEach((entry) => {
          const found = entries.find((e) => e.ref.current === entry.target);
          if (!found) return;

          if (entry.isIntersecting) {
            setVisibleSection((prev) =>
              prev[found.key]
                ? prev
                : { ...prev, [found.key]: true }
            );
            // Chỉ animate 1 lần, không cần theo dõi nữa
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.2, // khoảng 20% section vào viewport thì active
      }
    );

    entries.forEach((e) => {
      if (e.ref.current) observer.observe(e.ref.current);
    });

    return () => observer.disconnect();
  }, []);

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

  // Cân nặng hiện tại (ưu tiên: log activity -> user.profile -> onboarding base)
  const weightCurrent = activity.weightKg ?? userWeight ?? weightBase;

  // Calo từ các lịch tập (KHÔNG tính bước chân)
  const totalWorkoutKcal = useMemo(
    () => (activity.workouts || []).reduce((s, w) => s + (w.kcal || 0), 0),
    [activity.workouts]
  );

  // Calo ước tính từ bước chân
  const stepsKcal = useMemo(
    () => calcStepsKcal(activity.steps || 0, weightCurrent),
    [activity.steps, weightCurrent]
  );

  // Tổng calo "Tập luyện" dùng cho box Lượng Calo tiêu thụ
  const totalBurnedKcal = totalWorkoutKcal + stepsKcal;

  const kcalTarget = Math.round(targets.kcal || 0),
    kcalAte = Math.round(totals.kcal || 0),
    kcalBurned = Math.round(totalBurnedKcal || 0);
  const kcalBudget = Math.max(0, kcalTarget + kcalBurned);
  const kcalRemaining = Math.max(0, kcalBudget - kcalAte);
  const kcalUsedPct = kcalBudget ? Math.min(1, kcalAte / kcalBudget) : 0;

    // Chọn khoảng Calo phù hợp (2000-2200, 2200-2400, ...)
  const targetCalRange = useMemo(() => {
    if (!kcalTarget) return null;

    let range =
      SUGGEST_CAL_FILTERS.find(
        (r) =>
          (typeof r.from === "number" ? kcalTarget >= r.from : true) &&
          (typeof r.to === "number" ? kcalTarget <= r.to : true)
      ) || null;

    // Nếu không trúng khoảng nào, chọn khoảng có tâm gần nhất với kcalTarget
    if (!range) {
      let best = null;
      let bestDist = Infinity;
      SUGGEST_CAL_FILTERS.forEach((r) => {
        const center = (r.from + r.to) / 2;
        const d = Math.abs(kcalTarget - center);
        if (d < bestDist) {
          bestDist = d;
          best = r;
        }
      });
      range = best;
    }
    return range;
  }, [kcalTarget]);

  // Danh sách thực đơn gợi ý khớp khoảng Calo mục tiêu (tối đa 2 menu)
  const suggestMenusForTarget = useMemo(() => {
    if (!targetCalRange || !kcalTarget || !suggestItems?.length) return [];
    const { from, to } = targetCalRange;

    return (suggestItems || [])
      .map((m) => {
        const totals = getSuggestTotals(m);
        return { m, totals };
      })
      .filter(({ totals }) => {
        const k = totals.totalKcal;
        if (!k) return false;
        if (typeof from === "number" && k < from) return false;
        if (typeof to === "number" && k > to) return false;
        return true;
      })
      // Ưu tiên menu có Calo/ngày gần với mục tiêu nhất
      .sort(
        (a, b) =>
          Math.abs(a.totals.totalKcal - kcalTarget) -
          Math.abs(b.totals.totalKcal - kcalTarget)
      )
      .slice(0, 2); 
  }, [suggestItems, targetCalRange, kcalTarget]);

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

    // --- Helpers cho box Thực đơn gợi ý ---
  const openSuggestDetail = (id) => {
    if (!id) return;
    nav(`/dinh-duong/thuc-don-goi-y/chi-tiet/${id}`);
  };

  const handleToggleSaveSuggest = async (id) => {
    try {
      const res = await toggleSaveSuggestMenu(id);
      const saved = !!res.saved;

      setSuggestItems((prev) =>
        (prev || []).map((m) => (m._id === id ? { ...m, saved } : m))
      );

      toast.success(saved ? "Đã lưu thực đơn" : "Đã bỏ lưu thực đơn");
    } catch (err) {
      console.error(err);
      toast.error("Không thể lưu/bỏ lưu thực đơn");
    }
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
    const dayWorkoutsRaw = Array.isArray(a.workouts) ? a.workouts : [];
    const dayWorkouts = dayWorkoutsRaw
      .map(normalizeActivityWorkout)
      .filter(Boolean);

    updateActivity({
      steps: a.steps || 0,
      weightKg: a.weightKg ?? null,
      workouts: dayWorkouts,
    });
  }

  useEffect(() => {
    loadData();
  }, [date]);

    // Lấy danh sách Thực đơn gợi ý (dùng cho box "Thực đơn gợi ý" ở Thống kê)
  useEffect(() => {
    let cancelled = false;

    async function loadSuggestMenusBox() {
      setSuggestLoading(true);
      try {
        const res = await listSuggestMenus({ limit: 100, skip: 0 });
        const arr = res.items || res || [];
        if (!cancelled) setSuggestItems(arr);
      } catch (e) {
        console.error("Không tải được Thực đơn gợi ý:", e);
        if (!cancelled) setSuggestItems([]);
      } finally {
        if (!cancelled) setSuggestLoading(false);
      }
    }

    loadSuggestMenusBox();
    return () => {
      cancelled = true;
    };
  }, []);

    // Lấy danh sách lịch tập của tôi để dùng cho modal "Tập luyện"
  useEffect(() => {
    let cancelled = false;

    listMyWorkouts()
      .then((res) => {
        const payload = pickWorkoutRes(res);
        const rawList = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.list)
          ? payload.list
          : [];

        const mapped = rawList.map(mapWorkoutToOption);
        if (!cancelled) setWorkOptions(mapped);
      })
      .catch((err) => {
        console.error("Không tải được danh sách lịch tập:", err);
        if (!cancelled) setWorkOptions([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Lấy goal / cân nặng gốc từ onboarding
// Lấy cân nặng gốc / mục tiêu từ Onboarding (base + goal snapshot)
useEffect(() => {
  getOnboardingData()
    .then((res) => {
      // getOnboardingData() trả object JSON luôn, thường là { success, data }
      const ob =
        res?.onboarding ?? // phòng trường hợp BE trả { onboarding: {...} }
        res?.data?.onboarding ??
        res?.data ??
        res;

      if (!ob) return;

      const base = ob.base || {};
      const goals = Array.isArray(ob.goals) ? ob.goals : [];

      let active = goals.find((g) => g.status === "active") || null;
      if (!active && goals.length) active = goals[goals.length - 1];

      const src = active || base || {};

      const toNumOrNull = (v) => {
        if (v == null) return null;
        const n = Number(v);
        return Number.isNaN(n) ? null : n;
      };

      // Cân nặng gốc của goal: canNangHienTai tại thời điểm tạo goal
      const baseW =
        toNumOrNull(src.canNangHienTai) ??
        toNumOrNull(base.canNangHienTai);

      // Cân nặng mục tiêu của goal: canNangMongMuon
      const goalW =
        toNumOrNull(src.canNangMongMuon) ??
        toNumOrNull(base.canNangMongMuon);

      if (baseW != null) setWeightBase(baseW);
      if (goalW != null) setWeightGoal(goalW);
    })
    .catch(() => {});
}, []);

  // Lấy cân nặng hiện tại từ user.profile
  useEffect(() => {
  getMe()
    .then((user) => {
      const profile = user?.profile || {};

      // Cân nặng hiện tại (dùng cho weightCurrent)
      const current = profile.weightKg ?? profile.canNangHienTai ?? null;
      if (current != null && !Number.isNaN(+current)) {
        setUserWeight(Number(current));
      }

      // Nếu onboarding chưa set được base/goal thì dùng profile làm fallback
      setWeightBase((prev) => {
        if (prev != null && !Number.isNaN(prev)) return prev;
        const baseCandidate =
          profile.weightStartKg ??
          profile.canNangLucBatDau ??
          profile.canNangBanDau ??
          current;
        return baseCandidate != null && !Number.isNaN(+baseCandidate)
          ? Number(baseCandidate)
          : prev;
      });

      setWeightGoal((prev) => {
        if (prev != null && !Number.isNaN(prev)) return prev;
        const goalCandidate =
          profile.weightGoalKg ??
          profile.targetWeightKg ??
          profile.canNangMongMuon ??
          profile.canNangMucTieu ??
          null;
        return goalCandidate != null && !Number.isNaN(+goalCandidate)
          ? Number(goalCandidate)
          : prev;
      });
    })
    .catch(() => {});
}, []);

  const handleSaveWorkouts = async (selected) => {
    try {
      const res = await saveDailyWorkouts({
        date,
        workoutIds: selected.map((w) => w.id),
      });

      const payload = res?.data || {};
      const raw = Array.isArray(payload.workouts) ? payload.workouts : [];
      const normalized = raw.map(normalizeActivityWorkout).filter(Boolean);

      updateActivity({ workouts: normalized });
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

    // pct gốc từ logic
    const basePct =
      weightProgress != null ? Math.min(1, Math.max(0, weightProgress)) : 0;

    // Để dễ nhìn thì nếu >0 thì cho tối thiểu 6% chiều dài
    const pct = basePct > 0 ? Math.max(0.06, basePct) : 0;

    // Mô tả bên dưới line
    let desc =
      "Tiến độ luôn đáng giá, dù nhanh hay chậm. Hãy tiếp tục duy trì mỗi ngày.";
    if (kgLeft != null && kgLeft > 0.05) {
      const leftText =
        Math.abs(kgLeft - Math.round(kgLeft)) < 0.05
          ? Math.round(kgLeft).toString()
          : kgLeft.toFixed(1);
      desc = `Bạn còn khoảng ${leftText} kg để chạm mục tiêu. Cứ tiếp tục, bạn đang tiến gần hơn mỗi ngày.`;
    } else if (kgLeft != null) {
      desc = "Bạn đã chạm tới mục tiêu cân nặng. Hãy cố gắng duy trì nhé!";
    }

    return (
      <div className="st-weight-layout">
        <div className="st-weight-ring">
          <svg width="260" height="160" viewBox="0 0 200 140">
            <defs>
              <linearGradient
                id="weightGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#fb923c" />
              </linearGradient>

              <pattern
                id="weightStripes"
                patternUnits="userSpaceOnUse"
                width="8"
                height="8"
                patternTransform="rotate(45)"
              >
                <rect width="8" height="8" fill="url(#weightGradient)" />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="8"
                  stroke="#020617"
                  strokeWidth="2"
                  opacity="0.25"
                />
              </pattern>
            </defs>

            {/* Track nền xám */}
            <path
              className="ring-bg weightRing-bg"
              d="M20 90 A80 80 0 0 1 180 90"
              pathLength={length}
            />

            {/* Phần progress – dùng strokeDasharray theo % */}
            <path
              className="ring-fg ring-fg-weight weightRing-fg"
              d="M20 90 A80 80 0 0 1 180 90"
              pathLength={length}
              strokeDasharray={`${length * pct} ${length}`}
              strokeDashoffset="0"
              stroke="url(#weightStripes)"
            />
          </svg>

          {/* Trọng tâm bên trong vòng cung */}
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

          {/* Hai số gốc / đích ngay chân vòng */}
          <div className="st-weight-range">
            <span>{weightBase != null ? weightBase.toFixed(1) : "--"}</span>
            <span>{weightGoal != null ? weightGoal.toFixed(1) : "--"}</span>
          </div>
        </div>

        {/* Line + mô tả */}
        <div className="st-weight-footer">
          <div className="st-weight-divider" />
          <p className="st-weight-desc">{desc}</p>
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
                    <div
            ref={rowTopRef}
            className={
              "st-row-top st-animate-section" +
              (visibleSection.rowTop ? " is-visible" : "")
            }
          >
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
                        <i className="fa-solid fa-fire-flame-curved"></i>
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
              <div className="st-card-title lg">Nhật ký dinh dưỡng</div>
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
          <div
            ref={rowMiddleRef}
            className={
              "st-row-middle st-animate-section" +
              (visibleSection.rowMiddle ? " is-visible" : "")
            }
          >

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
                    <span style={{ fontSize: 20, marginLeft: 4 }}> ml</span>
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
                  {stepsKcal > 0 && (
                    <div className="st-stat-sub" style={{ marginTop: 6 }}>
                      ≈ {stepsKcal.toLocaleString()} cal đốt từ bước chân
                    </div>
                  )}
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
                    {Math.round(totalWorkoutKcal)}
                    <span style={{ fontSize: 20, marginLeft: 4 }}> cal</span>
                  </div>
                  <div className="st-stat-sub">
                    {activity.workouts?.length || 0} lịch tập
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
                    <div
            ref={rowBottomRef}
            className={
              "st-row-bottom st-animate-section" +
              (visibleSection.rowBottom ? " is-visible" : "")
            }
          >
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

                {/* Đang load */}
                {suggestLoading && (
                  <div className="st-suggest-placeholder">
                    <span>Đang tải Thực đơn gợi ý...</span>
                  </div>
                )}

                {/* Có mục tiêu nhưng chưa tìm được thực đơn phù hợp */}
                {!suggestLoading &&
                  kcalTarget > 0 &&
                  (!targetCalRange || suggestMenusForTarget.length === 0) && (
                    <div className="st-suggest-placeholder">
                      <span>
                        Hiện chưa có Thực đơn gợi ý phù hợp khoảng Calo của bạn.{" "}
                      </span>
                    </div>
                  )}

                {/* Có mục tiêu & có thực đơn phù hợp */}
                {!suggestLoading &&
                  kcalTarget > 0 &&
                  targetCalRange &&
                  suggestMenusForTarget.length > 0 && (
                    <>
                      <div className="st-suggest-list">
                        {suggestMenusForTarget.map(({ m, totals }) => (
                          <div
                            key={m._id}
                            className="st-suggest-card"
                            onClick={() => openSuggestDetail(m._id)}
                          >
                            <div className="st-suggest-thumb">
                              {m.imageUrl ? (
                                <img src={toAbs(m.imageUrl)} alt={m.name} />
                              ) : (
                                <div className="st-suggest-thumb-fallback">
                                  <i className="fa-regular fa-image" />
                                </div>
                              )}
                            </div>

                            <div className="st-suggest-main">
                              <div className="st-suggest-title">
                                {m.name || "Thực đơn gợi ý"}
                              </div>
                              <div className="st-suggest-tags">
                                <span className="st-suggest-chip">
                                  {m.category || "Chưa phân loại"}
                                </span>
                                <span className="st-suggest-chip">
                                  {getSuggestNumDays(m)} ngày
                                </span>
                              </div>

                              <div className="st-suggest-kcal">
                                {totals.totalKcal.toLocaleString()} Cal/ngày
                              </div>
                              <div className="st-suggest-macros">
                                <span>Đạm: {totals.proteinG}g</span>
                                <span>Carb: {totals.carbG}g</span>
                                <span>Fat: {totals.fatG}g</span>
                              </div>
                            </div>

                            <div
                              className="st-suggest-foot"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="st-suggest-btn"
                                onClick={() => openSuggestDetail(m._id)}
                              >
                                Xem chi tiết
                              </button>
                              <button
                                type="button"
                                className={
                                  "st-suggest-save" +
                                  (m.saved ? " saved" : "")
                                }
                                title={
                                  m.saved
                                    ? "Bỏ lưu thực đơn"
                                    : "Lưu thực đơn"
                                }
                                onClick={() =>
                                  handleToggleSaveSuggest(m._id)
                                }
                              >
                                <i
                                  className={
                                    m.saved
                                      ? "fa-solid fa-bookmark"
                                      : "fa-regular fa-bookmark"
                                  }
                                />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
              </div>
            </div>

            {/* Bài tập chi tiết – 1/3 chiều ngang */}
            <div className="st-card st-box-workout-detail">
              <div className="st-card-header">
                <div className="st-card-title">Bài tập trong ngày</div>
              </div>
              <div className="stt-workouts-body">
                {(!activity.workouts || !activity.workouts.length) ? (
                  <div className="stt-empty">
                    Bạn chưa chọn lịch tập nào cho ngày này.
                  </div>
                ) : (
                  activity.workouts.map((w, idx) => (
                    <div className="stt-workout-plan" key={w.id || idx}>
                      {/* --- Title kế bên tổng kcal --- */}
                      <div className="stt-workout-header">
                        <div className="stt-workout-name">
                          {w.name || "Lịch tập"}
                        </div>
                        {typeof w.kcal === "number" && w.kcal > 0 && (
                          <div className="stt-workout-kcal">
                            <i className="fa-solid fa-fire-flame-curved" />{" "}
                            {new Intl.NumberFormat("vi-VN").format(w.kcal || 0)} kcal
                          </div>
                        )}
                      </div>

                      {/* --- Danh sách bài tập trong lịch --- */}
                      {w.plan && Array.isArray(w.plan.items) && w.plan.items.length > 0 ? (
                        <div className="stt-workout-exlist">
                          {w.plan.items.map((ex, i) => {
                            const s = calcSetStats(ex.sets);
                            const repsText = s.reps != null ? `${s.reps} reps` : "- reps";
                            const restText = s.rest != null ? `${s.rest}s nghỉ` : "0s nghỉ";
                            const exSrcRaw = (ex.exercise && (ex.exercise.imageUrl || ex.exercise.thumbUrl)) || ex.imageUrl || ex.thumbUrl || "";
                            const exImg = exSrcRaw ? toAbs(exSrcRaw) : PLACEHOLDER;
                            const exName = ex.exerciseName || ex.name || "Bài tập";

                            return (
                              <div className="stt-exrow" key={i}>
                                <img className="stt-eximg" src={exImg} alt={exName} />
                                <div className="stt-exmeta">
                                  <div className="stt-exname">{exName}</div>
                                  <div className="stt-exsub">
                                    {s.hiep} hiệp ~ {repsText} ~ {restText}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="stt-empty small">
                          Không có dữ liệu chi tiết bài tập cho lịch này.
                        </div>
                      )}
                      {/* Divider giữa các lịch nếu chọn nhiều */}
                      {idx < activity.workouts.length - 1 && (
                        <hr className="stt-workout-divider" />
                      )}
                    </div>
                  ))
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
