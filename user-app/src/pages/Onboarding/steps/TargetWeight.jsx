import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";
import "./TargetWeight.css";

/* ===== Thước cuộn tối giản (~35 vạch) + 1 hiển thị số; kéo trái = tăng, kéo phải = giảm ===== */
function RulerSliderWindow({ unit, min, max, step, value, onChange, disabled }) {
  const valNum = Number(value);
  const minInt = Math.ceil(min);
  const maxInt = Math.floor(max);

  const WINDOW_TICKS = 35; // khoảng 30–35 vạch
  const selectedInt = Math.round(valNum);

  // Tạo cửa sổ hiển thị quanh giá trị đang chọn
  const { start, end } = useMemo(() => {
    const half = Math.floor(WINDOW_TICKS / 2);
    let s = selectedInt - half;
    s = Math.max(minInt, Math.min(s, maxInt - WINDOW_TICKS + 1));
    const e = Math.min(maxInt, s + WINDOW_TICKS - 1);
    return { start: s, end: e };
  }, [selectedInt, minInt, maxInt]);

  const span = end - start || 1;
  const pctInWindow = useMemo(() => ((valNum - start) / span) * 100, [valNum, start, span]);

  // Vạch lớn mỗi 10, còn lại vạch nhỏ
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

  // Đảo chiều kéo: proxy = min + max - actual
  const proxyValue = useMemo(() => min + max - valNum, [valNum, min, max]);
  const handleChange = (e) => {
    const proxy = Number(e.target.value);
    const actual = min + max - proxy;
    onChange(actual);
  };

  return (
    <div className="rs-wrap">
      {/* Hiển thị số duy nhất bên trên thước */}
      <div className="rs-value" style={{ left: `${pctInWindow}%` }} aria-hidden="true">
        <span>{Number(value).toFixed(step >= 1 ? 0 : 1)} {unit}</span>
      </div>

      {/* Thước ~35 vạch, chỉ 1 trục nổi tại vị trí chọn */}
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

export default function TargetWeight() {
  const nav = useNavigate();
  const nickname = localStorage.getItem("nickname") || "bạn";
  const goal = localStorage.getItem("goal") || "giam_can";

  const initCurrent = Number(localStorage.getItem("weightKg")) || 65;
  const [target, setTarget] = useState(initCurrent);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const title = `Mục tiêu cân nặng của ${nickname} là …`;
  const bmiBox = useMemo(() => {
    const h = (Number(localStorage.getItem("heightCm")) || 170) / 100;
    const bmi = target / (h * h);
    let tag = "Bình thường";
    if (bmi < 18.5) tag = "Thiếu cân";
    else if (bmi >= 25 && bmi < 30) tag = "Thừa cân";
    else if (bmi >= 30) tag = "Béo phì";
    return { bmi: bmi.toFixed(1), tag };
  }, [target]);

  const handleNext = async () => {
    setLoading(true); setErr("");
    try {
      await api.patch("/user/onboarding", { "profile.targetWeightKg": Number(target) });
      localStorage.setItem("targetWeightKg", String(target));
      if (goal === "duy_tri") nav("/onboarding/cuong-do");
      else nav("/onboarding/muc-tieu-hang-tuan");
    } catch (e) {
      setErr(e?.response?.data?.message || "Có lỗi xảy ra, thử lại nhé.");
    } finally {
      setLoading(false);
    }
  };

  // Phạm vi target hợp lý theo mục tiêu (giữ nguyên)
  const min = 20, max = 200, step = 0.1;

  return (
    <div className="tw-wrap">
      <header className="tw-header">
        <img src="\images\logo-fitmatch.png" alt="FitMatch" className="tw-logo" />
      </header>

      <main className="tw-main">
        <div className="tw-card">
          <h3 className="tw-title">{title}</h3>
          <p className="tw-desc">Kéo trên thước để chọn số cân — <b>kéo trái: tăng</b>, <b>kéo phải: giảm</b></p>

          <div className="tw-subtitle">Cân nặng mục tiêu của bạn</div>
          <RulerSliderWindow
            unit="kg"
            min={min}
            max={max}
            step={step}
            value={target}
            onChange={setTarget}
            disabled={loading}
          />

          <div className="tw-bmi">
            <span>BMI của bạn: <b>{bmiBox.bmi}</b></span>
            <span className="tw-chip">{bmiBox.tag}</span>
          </div>

          {err && <div className="tw-error">{err}</div>}
        </div>

        <div className="tw-actions">
          <button className="btn btn-outline" onClick={() => nav("/onboarding/so-lieu-co-ban")} disabled={loading}>Quay lại</button>
          <button className="btn btn-primary" onClick={handleNext} disabled={loading}>
            {loading ? "Đang lưu..." : "Tiếp theo"}
          </button>
        </div>
      </main>
    </div>
  );
}
