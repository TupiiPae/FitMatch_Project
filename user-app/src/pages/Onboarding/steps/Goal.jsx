import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../../lib/api";
import "./Goal.css";
import './step-progress.css';

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
  // Tính tỉ lệ hoàn thành theo số "đoạn" giữa các circle:
  const doneRatio = currentIndex / totalSegs; // 0..1

  return (
    <div className="sp">
      {/* --sp-done là số 0..1, CSS sẽ nhân với (100% - đường kính dot) */}
      <ol className="sp-progress" style={{ '--sp-done': doneRatio }}>
        {STEPS.map((s, idx) => {
          const completed = idx < currentIndex;
          const active = idx === currentIndex;
          return (
            <li key={s.slug} className={`sp-step ${completed ? 'is-complete' : ''} ${active ? 'is-active' : ''}`}>
              {/* line per-step đã bỏ, track vẽ bằng ::before/::after trong CSS */}
              <span className="sp-dot">
                {completed ? (
                  <svg viewBox="0 0 24 24" className="sp-check" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
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
        <Link to="/" className="logo-link" aria-label="Về trang chủ">
          <img src="/images/logo-fitmatch.png" alt="FitMatch" className="nk-logo" />
        </Link>
      </header>

      <main className="gl-main">
        <StepProgress currentSlug="muc-tieu" />
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
