import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";
import "./WeeklyChange.css";

export default function WeeklyChange() {
  const nav = useNavigate();
  const nickname = localStorage.getItem("nickname") || "bạn";
  const goal = localStorage.getItem("goal") || "giam_can";

  const isLose = goal === "giam_can" || goal === "giam_mo";
  const isGain = goal === "tang_can" || goal === "tang_co";

  // Đọc localStorage nếu có; nếu chưa có -> mặc định ±0.5 theo mục tiêu
  const stored = Number(localStorage.getItem("weeklyChangeKg"));
  const defaultAbs = 0.5;
  const defaultSigned = isLose ? -defaultAbs : defaultAbs;

  const [weekly, setWeekly] = useState(
    Number.isFinite(stored) && stored !== 0 ? stored : defaultSigned
  );
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const title = `Mục tiêu hàng tuần của ${nickname} là …`;
  const label = isLose ? "Số kg giảm mỗi tuần" : "Số kg tăng mỗi tuần";

  // Clamp 0.1–1.0 và gán dấu theo mục tiêu
  const clampAndSign = (val) => {
    const abs = Math.min(1.0, Math.max(0.1, Math.abs(val)));
    const signed = isLose ? -abs : abs;
    return Number(signed.toFixed(1));
  };

  // Dải range hiển thị (âm cho giảm, dương cho tăng)
  const min = isLose ? -1 : 0.1;
  const max = isLose ? -0.1 : 1;
  const step = 0.1;

  // Lưu ngay khi người dùng thay đổi
  useEffect(() => {
    if (Number.isFinite(weekly)) {
      localStorage.setItem("weeklyChangeKg", String(weekly));
    }
  }, [weekly]);

  // Nếu mục tiêu đổi (hiếm), re-clamp lại cho đúng dấu/khoảng
  useEffect(() => {
    setWeekly((prev) => clampAndSign(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal]);

  // Reco text
  const recommend = useMemo(() => {
    const abs = Math.abs(weekly);
    if (abs <= 0.3) return "Chậm";
    if (abs <= 0.8) return "Khuyến nghị";
    return "Nhanh (Không khuyến nghị)";
  }, [weekly]);

  // Tạo chấm nhỏ cho mỗi 0.1
  const ticks = useMemo(() => {
    const arr = [];
    const count = Math.round((max - min) / step);
    for (let i = 0; i <= count; i++) arr.push(min + i * step);
    return arr;
  }, [min, max, step]);

  const handleSlide = (e) => {
    const v = Number(e.target.value);
    setWeekly(clampAndSign(v));
  };

  const handleNext = async () => {
    setLoading(true);
    setErr("");
    try {
      await api.patch("/user/onboarding", { "profile.weeklyChangeKg": Number(weekly) });
      // localStorage đã lưu trong useEffect
      nav("/onboarding/cuong-do");
    } catch (e) {
      setErr(e?.response?.data?.message || "Có lỗi xảy ra, thử lại nhé.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wk-wrap">
      <header className="wk-header">
        <img src="\images\logo-fitmatch.png" alt="FitMatch" className="wk-logo" />
      </header>

      <main className="wk-main">
        <div className="wk-card">
          <h3 className="wk-title">{title}</h3>
          <p className="wk-desc">
            Kéo thanh trượt để chọn số cân nặng {isLose ? "giảm" : "tăng"} trong 1 tuần
          </p>

          <div className="wk-num">
            <div className="wk-tag">{label}</div>
            <div className="wk-highlight">{Math.abs(weekly).toFixed(1)} kg</div>
            <div className={`wk-reco ${recommend === "Khuyến nghị" ? "good" : ""}`}>{recommend}</div>
          </div>

          {/* Thanh trượt + dots mỗi 0.1 */}
          <div className="wk-slider-wrap">
            <div className="wk-slider-track">
              {ticks.map((_, i) => (
                <div key={i} className="wk-dot" />
              ))}
            </div>

            <input
              className="wk-slider"
              type="range"
              min={min}
              max={max}
              step={step}
              value={weekly}
              onChange={handleSlide}
              disabled={loading}
            />

            {/* Tooltip theo vị trí giá trị */}
            <div
              className="wk-tooltip"
              style={{ left: `${((weekly - min) / (max - min)) * 100}%` }}
            >
              {Math.abs(weekly).toFixed(1)}
            </div>
          </div>

          {err && <div className="wk-error">{err}</div>}
        </div>

        <div className="wk-actions">
          <button
            className="btn btn-outline"
            onClick={() => nav("/onboarding/can-nang-muc-tieu")}
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
