import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../../lib/api";            
import "./WeeklyChange.css";
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
  const currentIndex = Math.max(0, STEPS.findIndex(s => s.slug === currentSlug));
  const totalSegs = Math.max(1, STEPS.length - 1);
  const doneRatio = currentIndex / totalSegs; // 0..1: tô line đến trước circle hiện tại

  return (
    <div className="sp">
      <ol className="sp-progress" style={{ "--sp-done": String(doneRatio) }}>
        {STEPS.map((s, idx) => {
          const completed = idx < currentIndex;
          const active = idx === currentIndex;
          return (
            <li key={s.slug} className={`sp-step ${completed ? "is-complete" : ""} ${active ? "is-active" : ""}`}>
              <span className="sp-dot">
                {completed ? (
                  <svg viewBox="0 0 24 24" className="sp-check" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
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

export default function WeeklyChange() {
  const nav = useNavigate();
  const nickname = localStorage.getItem("nickname") || "bạn";
  const goal = localStorage.getItem("goal") || "giam_can";

  const isLose = goal === "giam_can" || goal === "giam_mo";
  const isGain = goal === "tang_can" || goal === "tang_co";

  // Lấy từ localStorage (luôn lưu dương); nếu chưa có → 0.5
  const stored = Number(localStorage.getItem("weeklyChangeKg"));
  const defaultAbs = 0.5;

  const [weekly, setWeekly] = useState(
    Number.isFinite(stored) && stored >= 0.1 && stored <= 1 ? stored : defaultAbs
  );
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const title = `Mục tiêu hàng tuần của ${nickname} là …`;
  const label = isLose ? "Số kg giảm mỗi tuần" : "Số kg tăng mỗi tuần";

  // Chỉ dải dương 0.1–1.0
  const min = 0.1;
  const max = 1.0;
  const step = 0.1;

  // Clamp vào [0.1, 1.0] và làm tròn 1 chữ số
  const clampAbs = (val) => {
    const abs = Math.min(max, Math.max(min, Math.abs(Number(val))));
    return Number(abs.toFixed(1));
  };

  // Lưu localStorage mỗi lần đổi
  useEffect(() => {
    if (Number.isFinite(weekly)) {
      localStorage.setItem("weeklyChangeKg", String(weekly)); // ✅ luôn dương
    }
  }, [weekly]);

  // Nếu goal đổi (hiếm), chỉ giữ giá trị dương và clamp
  useEffect(() => {
    setWeekly((prev) => clampAbs(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal]);

  // Nhãn khuyến nghị
  const recommend = useMemo(() => {
    const abs = weekly;
    if (abs <= 0.3) return "Chậm";
    if (abs <= 0.8) return "Khuyến nghị";
    return "Nhanh (Không khuyến nghị)";
  }, [weekly]);

  // Chấm mỗi 0.1
  const ticks = useMemo(() => {
    const arr = [];
    const count = Math.round((max - min) / step);
    for (let i = 0; i <= count; i++) arr.push(min + i * step);
    return arr;
  }, [min, max, step]);

  const handleSlide = (e) => {
    const v = Number(e.target.value);
    setWeekly(clampAbs(v));
  };

  const handleNext = async () => {
    setLoading(true);
    setErr("");
    try {
      // Gửi DƯƠNG lên BE; BE đã chuẩn hoá thêm 1 lớp nữa (abs) nên an toàn
      await api.patch("/api/user/onboarding", {
        "profile.weeklyChangeKg": Number(weekly),
      });
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
        <Link to="/" className="logo-link" aria-label="Về trang chủ">
          <img src="/images/logo-fitmatch.png" alt="FitMatch" className="nk-logo" />
        </Link>
      </header>

      <main className="wk-main">
        <StepProgress currentSlug="muc-tieu-hang-tuan" />
        <div className="wk-card">
          <h3 className="wk-title">{title}</h3>
          <p className="wk-desc">
            Kéo thanh trượt để chọn số cân nặng {isLose ? "giảm" : "tăng"} trong 1 tuần
          </p>

          <div className="wk-num">
            <div className="wk-tag">{label}</div>
            <div className="wk-highlight">{weekly.toFixed(1)} kg</div>
            <div className={`wk-reco ${recommend === "Khuyến nghị" ? "good" : ""}`}>{recommend}</div>
          </div>

          {/* Thanh trượt + dots mỗi 0.1 (DƯƠNG 0.1 → 1.0) */}
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
              {weekly.toFixed(1)}
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
