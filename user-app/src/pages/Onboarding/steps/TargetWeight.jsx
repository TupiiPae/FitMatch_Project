import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";
import "./TargetWeight.css";

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
    const bmi = target / (h*h);
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
      // Nếu duy trì thì bỏ qua weekly → sang cường độ
      if (goal === "duy_tri") nav("/onboarding/cuong-do");
      else nav("/onboarding/muc-tieu-hang-tuan");
    } catch (e) {
      setErr(e?.response?.data?.message || "Có lỗi xảy ra, thử lại nhé.");
    } finally {
      setLoading(false);
    }
  };

  // phạm vi target hợp lý theo mục tiêu
  const min = 20, max = 200, step = 0.1;

  return (
    <div className="tw-wrap">
      <header className="tw-header">
        <img src="\images\logo-fitmatch.png" alt="FitMatch" className="tw-logo" />
      </header>

      <main className="tw-main">
        <div className="tw-card">
          <h3 className="tw-title">{title}</h3>
          <p className="tw-desc">Kéo thanh trượt để chọn số cân (kg)</p>

          <div className="tw-value">{target.toFixed(1)} kg</div>
          <input
            className="tw-range"
            type="range"
            min={min} max={max} step={step}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
          />

          <div className="tw-bmi">
            <span>BMI của bạn: <b>{bmiBox.bmi}</b></span>
            <span className="tw-chip">{bmiBox.tag}</span>
          </div>

          {err && <div className="tw-error">{err}</div>}
        </div>

        <div className="tw-actions">
          <button className="btn btn-outline" onClick={() => nav("/onboarding/so-lieu-co-ban")} disabled={loading}>Hủy</button>
          <button className="btn btn-primary" onClick={handleNext} disabled={loading}>
            {loading ? "Đang lưu..." : "Tiếp theo"}
          </button>
        </div>
      </main>
    </div>
  );
}
