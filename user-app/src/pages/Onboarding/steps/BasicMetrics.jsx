import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";
import "./BasicMetrics.css";

export default function BasicMetrics() {
  const nav = useNavigate();
  const [nickname, setNickname] = useState(localStorage.getItem("nickname") || "");
  const [height, setHeight] = useState(170);     // cm
  const [weight, setWeight] = useState(65.0);    // kg
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    // nếu đã có dữ liệu trước đó thì set lại
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
          <p className="bm-desc">Kéo thanh trượt để chọn số cân nặng và chiều cao</p>

          <div className="bm-block">
            <div className="bm-value">{weight.toFixed(1)} kg</div>
            <input
              className="bm-range"
              type="range"
              min={20} max={200} step={0.1}
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
            />
          </div>

          <div className="bm-block">
            <div className="bm-value">{height} cm</div>
            <input
              className="bm-range"
              type="range"
              min={120} max={200} step={1}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
            />
          </div>

          {err && <div className="bm-error">{err}</div>}
        </div>

        <div className="bm-actions">
          <button className="btn btn-outline" onClick={() => nav("/onboarding/dong-luc")} disabled={loading}>Hủy</button>
          <button className="btn btn-primary" onClick={handleNext} disabled={loading}>
            {loading ? "Đang lưu..." : "Tiếp theo"}
          </button>
        </div>
      </main>
    </div>
  );
}
