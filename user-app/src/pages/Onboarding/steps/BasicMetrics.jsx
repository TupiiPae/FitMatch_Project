import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";
import "./BasicMetrics.css";

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
  const tickStep = step >= 1 ? 1 : 0.1;
  const eps = 1e-9;

  // làm tròn về bội số tickStep (để selected tick khớp)
  const rounded = useMemo(
    () => Number((Math.round(val / tickStep) * tickStep).toFixed(step >= 1 ? 0 : 1)),
    [val, tickStep, step]
  );

  // tính cửa sổ hiển thị
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

  // sinh vạch: major theo majorEvery (hỗ trợ thập phân, vd 0.5)
  const ticks = useMemo(() => {
    const arr = [];
    const fix = (x) => Number(x.toFixed(step >= 1 ? 0 : 1));

    for (let v = start; v <= end + eps; v += tickStep) {
      const fv = fix(v);

      // là bội số của majorEvery nếu (fv/majorEvery) gần số nguyên
      const ratio = fv / majorEvery;
      const isMajor = Math.abs(ratio - Math.round(ratio)) < 1e-9;

      const isSelected = Math.abs(fv - rounded) < 1e-9;
      const left = ((fv - start) / span) * 100;

      arr.push({ fv, isMajor, isSelected, left });
    }
    return arr;
  }, [start, end, tickStep, rounded, span, step, majorEvery]);

  // đảo chiều kéo: kéo phải = giảm
  const proxyValue = min + max - val;
  const handleChange = (e) => {
    const proxy = Number(e.target.value);
    const actual = min + max - proxy;
    const fixed = step >= 1 ? Math.round(actual) : Number(actual.toFixed(1));
    onChange(fixed);
  };

  // format nhãn theo context
  const formatLabel = (v) => {
    if (step >= 1) return v.toFixed(0);
    // nếu majorEvery thập phân (vd 0.5) thì hiển thị 1 số lẻ
    const hasDecimalMajor = Math.abs(majorEvery - Math.round(majorEvery)) > eps;
    return v.toFixed(hasDecimalMajor ? 1 : 0);
  };

  return (
    <div className="rs-wrap">
      {/* số nổi theo vị trí */}
      <div className="rs-value" style={{ left: `${pctInWindow}%` }} aria-hidden="true">
        <span>
          {Number(value).toFixed(step >= 1 ? 0 : 1)} {unit}
        </span>
      </div>

      {/* thước vạch */}
      <div className="rs-ruler rs-ruler-window" role="presentation">
        {ticks.map((t, idx) => (
          <div
            key={`${unit}-${start}-${idx}`} // key ổn định theo instance
            className={`rs-tick ${t.isMajor ? "major" : "minor"} ${t.isSelected ? "selected" : ""}`}
            style={{ left: `${t.left}%` }}
            title={t.isMajor ? `${t.fv} ${unit}` : undefined}
          >
            {t.isMajor && <div className="rs-tick-label">{formatLabel(t.fv)}</div>}
          </div>
        ))}
        <div className="rs-fade left" />
        <div className="rs-fade right" />
      </div>

      {/* range thật (thumb ẩn) */}
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
        <img src="\images\logo-fitmatch.png" alt="FitMatch" className="bm-logo" />
      </header>

      <main className="bm-main">
        <div className="bm-card">
          <h3 className="bm-title">
            Cân nặng và chiều cao hiện tại của {nickname || "bạn"} là …
          </h3>
          <p className="bm-desc">
            Kéo trên thước để chọn số liệu (<b>kéo trái: tăng</b>, <b>kéo phải: giảm</b>)
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
