import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../../lib/api";
import "./BasicMetrics.css";
import "./step-progress.css";

const STEPS = [
  { slug: "ten-goi",            label: "B1" },
  { slug: "muc-tieu",           label: "B2" },
  { slug: "dong-luc",           label: "B3" },
  { slug: "so-lieu-co-ban",     label: "B4" },
  { slug: "can-nang-muc-tieu",  label: "B5" },
  { slug: "muc-tieu-hang-tuan", label: "B6" },
  { slug: "cuong-do",           label: "B7" },
  { slug: "tong-hop",           label: "B8" },
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
              className={`sp-step ${completed ? "is-complete" : ""} ${
                active ? "is-active" : ""
              }`}
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

/* ===== Thước cuộn ~35 vạch; vạch = 0.1 nếu step < 1; kéo trái = tăng, kéo phải = giảm ===== */
/* majorEvery: khoảng giữa các vạch lớn/nhãn (vd: kg=0.5, cm=5) */
function RulerSliderWindow({
  unit,
  min,
  max,
  step,
  value,
  onChange,
  disabled,
  majorEvery = 1,
}) {
  const val = Number(value);
  const TICKS = 35;
  const eps = 1e-9;

  // tickStep để vẽ vạch: 1 cho step>=1, hoặc chính step (0.1)
  const tickStep = step >= 1 ? 1 : step;

  // scale nội bộ: nếu step < 1 (vd 0.1) thì scale = 10, domain slider là số nguyên
  const isSubUnit = step < 1;
  const scale = isSubUnit ? Math.round(1 / step) : 1; // 0.1 -> 10
  const decimals = step >= 1 ? 0 : Math.ceil(-Math.log10(step)); // 0.1 -> 1, 0.01 -> 2

  const scaledMin = Math.round(min * scale);
  const scaledMax = Math.round(max * scale);
  const scaledVal = Math.round(val * scale);

  // làm tròn giá trị đang có theo đúng step
  const rounded = useMemo(() => {
    const snappedScaled = Math.round(scaledVal / 1) * 1; // luôn là int
    const snapped = snappedScaled / scale;
    return Number(snapped.toFixed(decimals));
  }, [scaledVal, scale, decimals]);

  // tính cửa sổ hiển thị quanh rounded
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

  // sinh vạch
  const ticks = useMemo(() => {
    const arr = [];
    const fix = (x) => Number(x.toFixed(decimals));

    for (let v = start; v <= end + eps; v += tickStep) {
      const fv = fix(v);

      const ratio = fv / majorEvery;
      const isMajor = Math.abs(ratio - Math.round(ratio)) < 1e-9;

      const isSelected = Math.abs(fv - rounded) < 1e-9;
      const left = ((fv - start) / span) * 100;

      arr.push({ fv, isMajor, isSelected, left });
    }
    return arr;
  }, [start, end, tickStep, rounded, span, majorEvery, decimals]);

  // ==== RANGE THẬT (ẩn thumb) – scale về số nguyên & đảo chiều: kéo phải = giảm ====
  const sliderMin = scaledMin;
  const sliderMax = scaledMax;
  const sliderValue = sliderMin + sliderMax - scaledVal; // đảo chiều

  const handleChange = (e) => {
    const proxy = Number(e.target.value); // int trong [sliderMin, sliderMax]
    const scaledNew = sliderMin + sliderMax - proxy; // đảo chiều lại
    let actual = scaledNew / scale; // về đơn vị thật (kg/cm)

    // snap về đúng step, giới hạn trong [min,max]
    const factor = Math.pow(10, decimals);
    actual = Math.round(actual * factor) / factor;
    actual = Math.min(max, Math.max(min, actual));

    onChange(actual);
  };

  const formatLabel = (v) => {
    if (step >= 1) return v.toFixed(0);
    const hasDecimalMajor = Math.abs(majorEvery - Math.round(majorEvery)) > eps;
    return v.toFixed(hasDecimalMajor ? decimals : 0);
  };

  return (
    <div className="rs-wrap">
      {/* số nổi theo vị trí */}
      <div
        className="rs-value"
        style={{ left: `${pctInWindow}%` }}
        aria-hidden="true"
      >
        <span>
          {Number(value).toFixed(decimals)} {unit}
        </span>
      </div>

      {/* thước vạch */}
      <div className="rs-ruler rs-ruler-window" role="presentation">
        {ticks.map((t, idx) => (
          <div
            key={`${unit}-${start}-${idx}`}
            className={`rs-tick ${t.isMajor ? "major" : "minor"} ${
              t.isSelected ? "selected" : ""
            }`}
            style={{ left: `${t.left}%` }}
            title={t.isMajor ? `${t.fv} ${unit}` : undefined}
          >
            {t.isMajor && (
              <div className="rs-tick-label">{formatLabel(t.fv)}</div>
            )}
          </div>
        ))}
        <div className="rs-fade left" />
        <div className="rs-fade right" />
      </div>

      {/* range thật (thumb ẩn) */}
      <input
        className="rs-range invisible-thumb"
        type="range"
        min={sliderMin}
        max={sliderMax}
        step={isSubUnit ? 1 : step}
        value={sliderValue}
        onChange={handleChange}
        disabled={disabled}
        aria-valuemin={sliderMin}
        aria-valuemax={sliderMax}
        aria-valuenow={sliderValue}
      />
    </div>
  );
}

export default function BasicMetrics() {
  const nav = useNavigate();
  const [nickname] = useState(localStorage.getItem("nickname") || "");

  const [height, setHeight] = useState(170); // cm
  const [weight, setWeight] = useState(65.0); // kg
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // init từ localStorage
  useEffect(() => {
    const h = Number(localStorage.getItem("heightCm"));
    const w = Number(localStorage.getItem("weightKg"));
    if (Number.isFinite(h) && h) setHeight(h);
    if (Number.isFinite(w) && w) setWeight(w);
  }, []);

  // lưu ngay khi đổi
  useEffect(() => {
    if (Number.isFinite(height)) localStorage.setItem("heightCm", String(height));
  }, [height]);

  useEffect(() => {
    if (Number.isFinite(weight)) localStorage.setItem("weightKg", String(weight));
  }, [weight]);

  const handleNext = async () => {
    setLoading(true);
    setErr("");
    try {
      await api.patch("/user/onboarding", {
        "profile.heightCm": Number(height),
        "profile.weightKg": Number(weight),
      });
      nav("/onboarding/can-nang-muc-tieu");
    } catch (e) {
      setErr(e?.response?.data?.message || "Có lỗi xảy ra, thử lại nhé.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bm-wrap">
      <header className="bm-header">
        <Link to="/" className="logo-link" aria-label="Về trang chủ">
          <img src="/images/logo-fitmatch.png" alt="FitMatch" className="nk-logo" />
        </Link>
      </header>

      <main className="bm-main">
        <StepProgress currentSlug="so-lieu-co-ban" />
        <div className="bm-card">
          <h3 className="bm-title">
            Cân nặng và chiều cao hiện tại của {nickname || "bạn"} là …
          </h3>
          <p className="bm-desc">
            Kéo trên thước để chọn số liệu (<b>kéo trái: tăng</b>,{" "}
            <b>kéo phải: giảm</b>)
            <p className="bm-desc"><b>Có thể dùng nút mũi tên "trái/phải" trên bàn phím để điều chỉnh chính xác</b></p>
          </p>
          

          {/* Cân nặng */}
          <div className="bm-block">
            <div className="bm-subtitle">Cân nặng của bạn</div>
            <RulerSliderWindow
              unit="kg"
              min={30}
              max={200}
              step={0.1}
              value={weight}
              onChange={setWeight}
              disabled={loading}
              majorEvery={0.5} /* nhãn mỗi 0.5 kg; vạch nhỏ vẫn 0.1 */
            />
          </div>

          {/* Chiều cao */}
          <div className="bm-block">
            <div className="bm-subtitle">Chiều cao của bạn</div>
            <RulerSliderWindow
              unit="cm"
              min={120}
              max={220}
              step={1}
              value={height}
              onChange={setHeight}
              disabled={loading}
              majorEvery={5} /* nhãn mỗi 5 cm */
            />
          </div>

          {err && <div className="bm-error">{err}</div>}
        </div>

        <div className="bm-actions">
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
