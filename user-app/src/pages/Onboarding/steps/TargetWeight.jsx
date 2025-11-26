// user-app/src/pages/Onboarding/steps/TargetWeight.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../../lib/api";
import "./TargetWeight.css";
import "./step-progress.css";

const STEPS = [
  { slug: "ten-goi",            label: "B1" },
  { slug: "muc-tieu",           label: "B2" },
  { slug: "dong-luc",           label: "B3" },
  { slug: "can-nang-muc-tieu",  label: "B4" },
  { slug: "cuong-do",           label: "B5" },
  { slug: "tong-hop",           label: "B6" },
];

function StepProgress({ currentSlug }) {
  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.slug === currentSlug));
  const totalSegs = Math.max(1, STEPS.length - 1);
  const doneRatio = currentIndex / totalSegs;

  return (
    <div className="sp">
      <ol className="sp-progress" style={{ "--sp-done": String(doneRatio) }}>
        {STEPS.map((s, idx) => {
          const completed = idx < currentIndex;
          const active = idx === currentIndex;
          return (
            <li
              key={s.slug}
              className={`sp-step ${completed ? "is-complete" : ""} ${active ? "is-active" : ""}`}
            >
              <span className="sp-dot">
                {completed ? (
                  <svg viewBox="0 0 24 24" className="sp-check" aria-hidden="true">
                    <path
                      d="M20 6L9 17l-5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className="sp-num">{idx + 1}</span>
                )}
              </span>
              <span className="sp-label">{s.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ===== Thước cuộn (giữ như cũ) ===== */
function RulerSliderWindow({ unit, min, max, step, value, onChange, disabled }) {
  const val = Number(value);
  const TICKS = 35;
  const tickStep = step >= 1 ? 1 : 0.1;

  const rounded = useMemo(
    () => Number((Math.round(val / tickStep) * tickStep).toFixed(step >= 1 ? 0 : 1)),
    [val, tickStep, step]
  );

  const { start, end } = useMemo(() => {
    const half = Math.floor(TICKS / 2);
    const minIdx = Math.ceil(min / tickStep);
    const maxIdx = Math.floor(max / tickStep);
    const idx = Math.round(rounded / tickStep);

    let sIdx = idx - half;
    sIdx = Math.max(minIdx, Math.min(sIdx, maxIdx - TICKS + 1));
    const eIdx = Math.min(maxIdx, sIdx + TICKS - 1);

    return { start: sIdx * tickStep, end: eIdx * tickStep };
  }, [rounded, tickStep, min, max]);

  const span = end - start || tickStep;
  const pctInWindow = ((val - start) / span) * 100;

  const ticks = useMemo(() => {
    const arr = [];
    const fix = (x) => Number(x.toFixed(step >= 1 ? 0 : 1));
    for (let v = start; v <= end + 1e-9; v += tickStep) {
      const fv = fix(v);
      const isMajor = Math.abs(fv % 1) < 1e-9;
      const isSelected = Math.abs(fv - rounded) < 1e-9;
      const left = ((fv - start) / span) * 100;
      arr.push({ v: fv, isMajor, isSelected, left });
    }
    return arr;
  }, [start, end, tickStep, rounded, span, step]);

  const proxyValue = min + max - val;
  const handleChange = (e) => {
    const proxy = Number(e.target.value);
    const actual = min + max - proxy;
    const fixed = Number(actual.toFixed(step >= 1 ? 0 : 1));
    onChange(fixed);
  };

  return (
    <div className="rs-wrap">
      <div className="rs-value" style={{ left: `${pctInWindow}%` }} aria-hidden="true">
        <span>{Number(value).toFixed(step >= 1 ? 0 : 1)} {unit}</span>
      </div>

      <div className="rs-ruler rs-ruler-window" role="presentation">
        {ticks.map((t) => (
          <div
            key={`${t.v}-${t.left}`}
            className={`rs-tick ${t.isMajor ? "major" : "minor"} ${t.isSelected ? "selected" : ""}`}
            style={{ left: `${t.left}%` }}
            title={`${t.v} ${unit}`}
          >
            {t.isMajor && <div className="rs-tick-label">{t.v.toFixed(0)}</div>}
          </div>
        ))}
        <div className="rs-fade left" />
        <div className="rs-fade right" />
      </div>

      <input
        className="rs-range invisible-thumb"
        type="range"
        min={min}
        max={max}
        step={step}
        value={proxyValue}
        onChange={handleChange}
        disabled={disabled}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={proxyValue}
      />
    </div>
  );
}

export default function TargetWeight() {
  const nav = useNavigate();
  const nickname = localStorage.getItem("nickname") || "bạn";
  const goal = localStorage.getItem("goal") || "giam_can";

  const isLose = goal === "giam_can" || goal === "giam_mo";
  const isGain = goal === "tang_can" || goal === "tang_co";

  const current = Number(localStorage.getItem("weightKg")) || 65;
  const heightCm = Number(localStorage.getItem("heightCm")) || 170;

  const ABS_MIN = 20;
  const ABS_MAX = 120;
  const STEP = 0.1;

  const effectiveMin = isGain
    ? Math.max(ABS_MIN, Number((current + 0.1).toFixed(1)))
    : ABS_MIN;
  const effectiveMax = isLose
    ? Math.min(ABS_MAX, Number((current - 0.1).toFixed(1)))
    : ABS_MAX;

  const storedTarget = Number(localStorage.getItem("targetWeightKg"));
  const initial = Number.isFinite(storedTarget) ? storedTarget : current;

  const clampToRange = (v) => {
    if (v < effectiveMin) return effectiveMin;
    if (v > effectiveMax) return effectiveMax;
    return Number(v.toFixed(1));
  };

  const [target, setTarget] = useState(clampToRange(initial));
  const [weekly, setWeekly] = useState(() => {
    const stored = Number(localStorage.getItem("weeklyChangeKg"));
    const defaultAbs = 0.5;
    if (Number.isFinite(stored) && stored >= 0.1 && stored <= 1) return stored;
    return defaultAbs;
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // localStorage sync
  useEffect(() => {
    if (Number.isFinite(target)) {
      localStorage.setItem("targetWeightKg", String(target));
    }
  }, [target]);

  useEffect(() => {
    if (Number.isFinite(weekly)) {
      localStorage.setItem("weeklyChangeKg", String(weekly));
    }
  }, [weekly]);

  useEffect(() => {
    setTarget((prev) => clampToRange(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveMin, effectiveMax]);

  // BMI box
  const bmiBox = useMemo(() => {
    const h = (heightCm || 170) / 100;
    const bmi = target / (h * h);

    let tag = "";
    let bgColor = "";
    let textColor = "#fff";
    if (bmi < 18.5) {
      tag = "Gầy";
      bgColor = "#40E0D0";
    } else if (bmi < 25) {
      tag = "Bình thường";
      bgColor = "#4CAF50";
    } else if (bmi < 30) {
      tag = "Thừa cân";
      bgColor = "#FFD54F";
      textColor = "#000";
    } else if (bmi < 35) {
      tag = "Béo phì độ I";
      bgColor = "#FF9800";
    } else if (bmi < 40) {
      tag = "Béo phì độ II";
      bgColor = "#FF6E6E";
    } else {
      tag = "Béo phì độ III";
      bgColor = "#D32F2F";
    }

    return { bmi: bmi.toFixed(1), tag, bgColor, textColor };
  }, [target, heightCm]);

  // WeeklyChange khuyến nghị
  const clampAbs = (val) => {
    const min = 0.1;
    const max = 1.0;
    const abs = Math.min(max, Math.max(min, Math.abs(Number(val))));
    return Number(abs.toFixed(1));
  };

  const recommend = useMemo(() => {
    const abs = weekly;
    if (abs <= 0.3) return "Chậm";
    if (abs <= 0.8) return "Khuyến nghị";
    return "Nhanh (Không khuyến nghị)";
  }, [weekly]);

  const weeklyTicks = useMemo(() => {
    const min = 0.1;
    const max = 1.0;
    const step = 0.1;
    const arr = [];
    const count = Math.round((max - min) / step);
    for (let i = 0; i <= count; i++) arr.push(min + i * step);
    return arr;
  }, []);

  const handleWeeklySlide = (e) => {
    const v = Number(e.target.value);
    setWeekly(clampAbs(v));
  };

  const handleNext = async () => {
    setLoading(true);
    setErr("");
    try {
      await api.patch("/user/onboarding", {
        "profile.targetWeightKg": Number(target),
        "profile.weeklyChangeKg": Number(weekly),
      });
      nav("/onboarding/cuong-do");
    } catch (e) {
      setErr(e?.response?.data?.message || "Có lỗi xảy ra, thử lại nhé.");
    } finally {
      setLoading(false);
    }
  };

  const title = `Mục tiêu cân nặng của ${nickname} là …`;
  const isLoseText = isLose ? "giảm" : "tăng";

  return (
    <div className="tw-wrap">
      <header className="tw-header">
        <Link to="/" className="logo-link" aria-label="Về trang chủ">
          <img src="/images/fm-logo-name.png" alt="FitMatch" className="nk-logo" />
        </Link>
      </header>

      <main className="tw-main">
        <StepProgress currentSlug="can-nang-muc-tieu" />
        <div className="tw-card">
          <h3 className="tw-title">{title}</h3>
          <p className="tw-desc">
            Kéo trên thước để chọn số cân
          </p>

          {/* Target weight */}
          <div className="tw-subtitle">Cân nặng mục tiêu của bạn</div>
          <RulerSliderWindow
            unit="kg"
            min={effectiveMin}
            max={effectiveMax}
            step={STEP}
            value={target}
            onChange={(v) => setTarget(clampToRange(v))}
            disabled={loading}
          />

          <div className="tw-bmi">
            <span>
              BMI của bạn: <b>{bmiBox.bmi}</b>
            </span>
            <span
              className="tw-chip"
              style={{ backgroundColor: bmiBox.bgColor, color: bmiBox.textColor }}
            >
              {bmiBox.tag}
            </span>
          </div>

          <hr className="tw-line"></hr>

          {/* Weekly change dưới phần target weight */}
          <h3 className="tw-title">
            Mục tiêu mỗi tuần của {nickname} là …
          </h3>
          <p className="tw-weekly-desc">
            Kéo thanh trượt để chọn số kg muốn {isLose ? "giảm" : "tăng"} trong 1 tuần.
          </p>

          <div className="tw-weekly-num">
            <div className="tw-weekly-tag">
              {isLose ? "Số kg giảm mỗi tuần" : "Số kg tăng mỗi tuần"}
            </div>
            <div className="tw-weekly-highlight">
              {weekly.toFixed(1)} kg
            </div>
            <div
              className={`tw-weekly-reco ${
                recommend === "Khuyến nghị" ? "good" : ""
              }`}
            >
              {recommend}
            </div>

            <div className="tw-weekly-slider-wrap">
              <div className="tw-weekly-slider-track">
                {weeklyTicks.map((_, i) => (
                  <div key={i} className="tw-weekly-dot" />
                ))}
              </div>

              <input
                className="tw-weekly-slider"
                type="range"
                min={0.1}
                max={1.0}
                step={0.1}
                value={weekly}
                onChange={handleWeeklySlide}
                disabled={loading}
              />

              <div
                className="tw-weekly-tooltip"
                style={{
                  left: `${((weekly - 0.1) / (1.0 - 0.1)) * 100}%`,
                }}
              >
                {weekly.toFixed(1)}
              </div>
            </div>
          </div>

          {err && <div className="tw-error">{err}</div>}
        </div>

        <div className="tw-actions">
          <button
            className="btn btn-outline"
            onClick={() => nav("/onboarding/dong-luc")}
            disabled={loading}
          >
            Quay lại
          </button>
          <button
            className="btn btn-primary"
            onClick={handleNext}
            disabled={loading}
          >
            {loading ? "Đang lưu..." : "Tiếp theo"}
          </button>
        </div>
      </main>
    </div>
  );
}
