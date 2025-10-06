import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";
import "./WeeklyChange.css";

export default function WeeklyChange() {
  const nav = useNavigate();
  const nickname = localStorage.getItem("nickname") || "bạn";
  const goal = localStorage.getItem("goal") || "giam_can";

  // mặc định 0.5 kg/tuần (âm nếu giảm)
  const defaultVal = goal === "giam_can" || goal === "giam_mo" ? -0.5 : 0.5;
  const [weekly, setWeekly] = useState(defaultVal);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const title = `Mục tiêu hàng tuần của ${nickname} là …`;
  const label =
    goal === "giam_can" || goal === "giam_mo"
      ? "Số kg giảm mỗi tuần"
      : "Số kg tăng mỗi tuần";

  const recommend = useMemo(() => {
    const abs = Math.abs(weekly);
    if (abs <= 0.3) return "Chậm";
    if (abs <= 0.8) return "Khuyến nghị";
    return "Nhanh";
  }, [weekly]);

  const handleNext = async () => {
    setLoading(true); setErr("");
    try {
      await api.patch("/user/onboarding", { "profile.weeklyChangeKg": Number(weekly) });
      localStorage.setItem("weeklyChangeKg", String(weekly));
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
          <p className="wk-desc">Kéo thanh trượt để chọn số cân nặng {goal==='giam_can'||goal==='giam_mo'?'giảm':'tăng'} trong 1 tuần</p>

          <div className="wk-num">
            <div className="wk-tag">{label}</div>
            <div className="wk-highlight">{Math.abs(weekly).toFixed(1)} kg</div>
            <div className={`wk-reco ${recommend==='Khuyến nghị'?'good':''}`}>{recommend}</div>
          </div>

          <input
            className="wk-range"
            type="range"
            min={-2} max={2} step={0.1}
            value={weekly}
            onChange={(e)=> setWeekly(Number(e.target.value))}
          />

          {err && <div className="wk-error">{err}</div>}
        </div>

        <div className="wk-actions">
          <button className="btn btn-outline" onClick={() => nav("/onboarding/can-nang-muc-tieu")} disabled={loading}>Hủy</button>
          <button className="btn btn-primary" onClick={handleNext} disabled={loading}>
            {loading ? "Đang lưu..." : "Tiếp theo"}
          </button>
        </div>
      </main>
    </div>
  );
}
