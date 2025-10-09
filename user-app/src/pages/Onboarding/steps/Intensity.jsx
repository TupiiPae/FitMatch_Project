import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";
import "./Intensity.css";

const INTENSITIES = [
  { code: "level_1", label: "Không tập luyện, ít vận động" },
  { code: "level_2", label: "Vận động nhẹ nhàng" },
  { code: "level_3", label: "Chăm chỉ tập luyện" },
  { code: "level_4", label: "Rất năng động" },
];

export default function Intensity() {
  const nav = useNavigate();
  const nickname = localStorage.getItem("nickname") || "bạn";
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("trainingIntensity");
    if (saved) setSelected(saved);
  }, []);

  const handleNext = async () => {
    if (!selected) return;
    setLoading(true); setErr("");
    try {
      await api.patch("/user/onboarding", { "profile.trainingIntensity": selected });
      localStorage.setItem("trainingIntensity", selected);
      nav("/onboarding/tong-hop");
    } catch (e) {
      setErr(e?.response?.data?.message || "Có lỗi xảy ra, thử lại nhé.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="in-wrap">
      <header className="in-header">
        <img src="\images\logo-fitmatch.png" alt="FitMatch" className="in-logo" />
      </header>

      <main className="in-main">
        <div className="in-card">
          <h3 className="in-title">Cường độ luyện tập trong tuần của {nickname} là …</h3>
          <p className="in-desc">Chọn 1 trong những cường độ bên dưới</p>

          <div className="in-list">
            {INTENSITIES.map((it) => (
              <button
                key={it.code}
                className={`in-item ${selected === it.code ? "active" : ""}`}
                onClick={() => setSelected(it.code)}
                disabled={loading}
              >
                {it.label}
              </button>
            ))}
          </div>

          {err && <div className="in-error">{err}</div>}
        </div>

        <div className="in-actions">
          <button className="btn btn-outline" onClick={() => nav(-1)} disabled={loading}>Quay lại</button>
          <button className="btn btn-primary" onClick={handleNext} disabled={!selected || loading}>
            {loading ? "Đang lưu..." : "Tiếp theo"}
          </button>
        </div>
      </main>
    </div>
  );
}
