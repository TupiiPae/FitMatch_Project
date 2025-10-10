import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";
import "./Intensity.css";

const INTENSITIES = [
  {
    code: "level_1",
    label: "Không tập luyện, ít vận động",
    details: [
      "• Công việc ngồi nhiều, ít di chuyển (nhân viên văn phòng, học sinh,...).",
      "• Vận động cơ bản: đi lại, ăn uống, tắm rửa.",
      "• Không tập luyện hoặc tập luyện thời gian ngắn."
    ]
  },
  {
    code: "level_2",
    label: "Vận động nhẹ nhàng",
    details: [
      "• Công việc cần di chuyển hoặc đứng nhiều hơn (giáo viên, phục vụ, công nhân,...).",
      "• Leo cầu thang thường xuyên, làm các công việc nhà cơ bản.",
      "• Tập luyện nhẹ 2-3 buổi/tuần, hoặc nhẹ nhàng 20-40 phút/buổi."
    ]
  },
  {
    code: "level_3",
    label: "Chăm chỉ tập luyện",
    details: [
      "• Công việc di chuyển thường xuyên (phục vụ, công nhân dây chuyền, làm vườn,...).",
      "• Tập luyện 3-4 buổi/tuần, trên 45 phút/buổi.",
      "• Có đạp xe đạp, chạy bộ, nhảy dây.",
      "• Có chơi thể thao vận động nhiều (bóng đá, cầu lông, bóng rổ,...)."
    ]
  },
  {
    code: "level_4",
    label: "Rất năng động",
    details: [
      "• Công việc đòi hỏi nhiều thể lực, hoạt động liên tục (vận động viên, công nhân khuân vác, thợ xây,...).",
      "• Tập luyện trên 5 buổi/tuần, trên 60 phút/buổi.",
      "• Cường độ tập luyện cao, lao động thể chất nặng.",
      "• Chơi nhiều bộ môn thể thao, cardio, thể hình."
    ]
  }
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
    setLoading(true);
    setErr("");
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
            {INTENSITIES.map((it) => {
              const active = selected === it.code;
              return (
                <div key={it.code} className={`in-option ${active ? "active" : ""}`}>
                  <button
                    type="button"
                    className="in-head"
                    onClick={() => setSelected(it.code)}
                    disabled={loading}
                    aria-expanded={active}
                    aria-controls={`panel-${it.code}`}
                  >
                    <span className="in-radio">
                      <span className="in-dot" />
                    </span>
                    <span className="in-label">{it.label}</span>
                    <span className="in-chevron" />
                  </button>

                  <div
                    id={`panel-${it.code}`}
                    className="in-panel"
                    style={{ maxHeight: active ? "260px" : "0px" }}
                  >
                    <ul>
                      {it.details.map((line, idx) => (
                        <li key={idx}>{line}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          {err && <div className="in-error">{err}</div>}
        </div>

        <div className="in-actions">
          <button className="btn btn-outline" onClick={() => nav(-1)} disabled={loading}>
            Quay lại
          </button>
          <button className="btn btn-primary" onClick={handleNext} disabled={!selected || loading}>
            {loading ? "Đang lưu..." : "Tiếp theo"}
          </button>
        </div>
      </main>
    </div>
  );
}
