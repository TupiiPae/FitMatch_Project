import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";
import "./BasicMetrics.css";

/* ===== Thước cuộn tối giản (~35 vạch) + 1 hiển thị số; kéo trái = tăng, kéo phải = giảm ===== */
function RulerSliderWindow({ unit, min, max, step, value, onChange, disabled }) {
  const valNum = Number(value);
  const minInt = Math.ceil(min);
  const maxInt = Math.floor(max);

  const WINDOW_TICKS = 35; // ~30–35 vạch
  const selectedInt = Math.round(valNum);

  // Cửa sổ hiển thị quanh giá trị đang chọn
  const { start, end } = useMemo(() => {
    const half = Math.floor(WINDOW_TICKS / 2);
    let s = selectedInt - half;
    s = Math.max(minInt, Math.min(s, maxInt - WINDOW_TICKS + 1));
    const e = Math.min(maxInt, s + WINDOW_TICKS - 1);
    return { start: s, end: e };
  }, [selectedInt, minInt, maxInt]);

  const span = end - start || 1;
  const pctInWindow = useMemo(() => ((valNum - start) / span) * 100, [valNum, start, span]);

  // Tạo vạch (vạch lớn mỗi 10)
  const ticks = useMemo(() => {
    const arr = [];
    for (let i = start; i <= end; i++) {
      const isMajor = i % 10 === 0;
      const isSelected = i === selectedInt;
      const left = ((i - start) / span) * 100;
      arr.push({ i, isMajor, isSelected, left });
    }
    return arr;
  }, [start, end, span, selectedInt]);

  // ==== ĐẢO CHIỀU KÉO: proxy = min + max - actual ====
  const proxyValue = useMemo(() => min + max - valNum, [valNum, min, max]);
  const handleChange = (e) => {
    const proxy = Number(e.target.value);
    const actual = min + max - proxy;
    onChange(actual);
  };

  return (
    <div className="rs-wrap">
      {/* Hiển thị số duy nhất bên trên thanh */}
      <div className="rs-value" style={{ left: `${pctInWindow}%` }} aria-hidden="true">
        <span>{Number(value).toFixed(step >= 1 ? 0 : 1)} {unit}</span>
      </div>

      {/* Thước ~35 vạch với 1 trục nổi tại vị trí đang chọn */}
      <div className="rs-ruler rs-ruler-window" role="presentation">
        {ticks.map(t => (
          <div
            key={t.i}
            className={`rs-tick ${t.isMajor ? "major" : "minor"} ${t.isSelected ? "selected" : ""}`}
            style={{ left: `${t.left}%` }}
            title={`${t.i} ${unit}`}
          >
            {t.isMajor && <div className="rs-tick-label">{t.i}</div>}
          </div>
        ))}
        <div className="rs-fade left" />
        <div className="rs-fade right" />
      </div>

      {/* Range thật – thumb ẩn, kéo trực tiếp trên thước; dùng proxy để đảo chiều */}
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
  const [height, setHeight] = useState(170);     // cm
  const [weight, setWeight] = useState(65.0);    // kg
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const h = Number(localStorage.getItem("heightCm"));
    const w = Number(localStorage.getItem("weightKg"));
    if (h) setHeight(h);
    if (w) setWeight(w);
  }, []);

  const handleNext = async () => {
    setLoading(true); setErr("");
    try {
      await api.patch("/user/onboarding", {
        "profile.heightCm": Number(height),
        "profile.weightKg": Number(weight),
      });
      localStorage.setItem("heightCm", String(height));
      localStorage.setItem("weightKg", String(weight));
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
          <h3 className="bm-title">Cân nặng và chiều cao hiện tại của {nickname || "bạn"} là …</h3>
          <p className="bm-desc">Kéo trên thước để chọn số liệu (kéo trái: tăng, kéo phải: giảm)</p>

          <div className="bm-block">
            <div className="bm-subtitle">Cân nặng của bạn</div>
            <RulerSliderWindow
              unit="kg"
              min={20}
              max={200}
              step={0.1}
              value={weight}
              onChange={setWeight}
              disabled={loading}
            />
          </div>

          <div className="bm-block">
            <div className="bm-subtitle">Chiều cao của bạn</div>
            <RulerSliderWindow
              unit="cm"
              min={120}
              max={200}
              step={1}
              value={height}
              onChange={setHeight}
              disabled={loading}
            />
          </div>

          {err && <div className="bm-error">{err}</div>}
        </div>

        <div className="bm-actions">
          <button className="btn btn-outline" onClick={() => nav("/onboarding/dong-luc")} disabled={loading}>Quay lại</button>
          <button className="btn btn-primary" onClick={handleNext} disabled={loading}>
            {loading ? "Đang lưu..." : "Tiếp theo"}
          </button>
        </div>
      </main>
    </div>
  );
}
