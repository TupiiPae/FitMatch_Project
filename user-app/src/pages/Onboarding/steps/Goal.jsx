import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";
import "./Goal.css";

const OPTIONS = [
  { code: "giam_can", label: "Giảm cân" },
  { code: "duy_tri", label: "Duy trì cân nặng" },
  { code: "tang_can", label: "Tăng cân" },
  { code: "tang_co",  label: "Tăng cơ" },
  { code: "giam_mo",  label: "Giảm mỡ" },
];

export default function Goal() {
  const nav = useNavigate();
  const [nickname, setNickname] = useState("");
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    // Lấy tên hiển thị + khôi phục mục tiêu đã chọn (nếu có)
    const n = localStorage.getItem("nickname");
    if (n) setNickname(n);
    const savedGoal = localStorage.getItem("goal");
    if (savedGoal) setSelected(savedGoal);
  }, []);

  const handleNext = async () => {
    if (!selected) return;
    setLoading(true);
    setErr("");

    try {
      // Lưu lên BE (whitelist dot-notation)
      await api.patch("/user/onboarding", { "profile.goal": selected });

      // Lưu tạm để các bước sau biết nhánh
      localStorage.setItem("goal", selected);

      // Flow mới: luôn qua trang truyền động lực
      nav("/onboarding/dong-luc");
    } catch (e) {
      setErr(e?.response?.data?.message || "Có lỗi xảy ra, thử lại nhé.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gl-wrap">
      <header className="gl-header">
        <img src="\images\logo-fitmatch.png" alt="FitMatch" className="gl-logo" />
      </header>

      <main className="gl-main">
        <div className="gl-card">
          <h3 className="gl-title">
            Hân hạnh được gặp bạn{nickname ? `, ${nickname}` : ""}. Mục tiêu của bạn là...
          </h3>
          <p className="gl-desc">Chọn 1 trong những mục tiêu bên dưới</p>

          <div className="gl-list">
            {OPTIONS.map((opt) => (
              <button
                key={opt.code}
                className={`gl-item ${selected === opt.code ? "active" : ""}`}
                onClick={() => setSelected(opt.code)}
                disabled={loading}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {err && <div className="gl-error">{err}</div>}
        </div>

        <div className="gl-actions">
          <button
            className="btn btn-outline"
            onClick={() => nav("/onboarding/ten-goi")}
            disabled={loading}
          >
            Quay lại
          </button>
          <button
            className="btn btn-primary"
            onClick={handleNext}
            disabled={!selected || loading}
          >
            {loading ? "Đang lưu..." : "Tiếp theo"}
          </button>
        </div>
      </main>
    </div>
  );
}
