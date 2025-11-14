import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Motivation.css";
import "./step-progress.css"; 

const GOAL_LABEL = {
  giam_can: "Giảm cân",
  duy_tri: "Duy trì cân nặng",
  tang_can: "Tăng cân",
  giam_mo: "Giảm mỡ",
  tang_co: "Tăng cơ",
};

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
  const doneRatio = currentIndex / totalSegs; // 0..1 — tô tới trước circle hiện tại

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
/* ===== /Progress ===== */

export default function Motivation() {
  const nav = useNavigate();
  const [goal, setGoal] = useState("");

  useEffect(() => {
    const g = localStorage.getItem("goal") || "";
    setGoal(g);
  }, []);

  const handleNext = () => {
    if (goal === "duy_tri") nav("/onboarding/cuong-do");
    else nav("/onboarding/so-lieu-co-ban");
  };

  return (
    <div className="mv-wrap">
      <header className="mv-header">
        <Link to="/" className="logo-link" aria-label="Về trang chủ">
          <img src="/images/logo-fitmatch.png" alt="FitMatch" className="nk-logo" />
        </Link>
      </header>

      <main className="mv-main">
        {/* Progress: nằm sát dưới navbar, trên card */}
        <StepProgress currentSlug="dong-luc" />

        <div className="mv-card">
          <h3 className="mv-title">Tuyệt! Bạn đã có mục tiêu của mình 🎯</h3>
          {goal && <p className="mv-sub">Mục tiêu bạn chọn: <strong>{GOAL_LABEL[goal] || ""}</strong></p>}
          <div className="mv-box">
            <p>
              Hãy cố gắng cho cuộc hành trình sắp tới nhé! Chúng tôi sẽ đồng hành
              và hỗ trợ bạn hết mình để đạt được mục tiêu.
            </p>
            <p>
              Con đường phía trước đôi lúc sẽ có lúc khó khăn, nhưng đừng nản chí.
              Mỗi bước nhỏ hôm nay sẽ tạo nên thay đổi lớn ngày mai. 💪
            </p>
          </div>
        </div>

        <div className="mv-actions">
          <button className="btn btn-outline" onClick={() => nav("/onboarding/muc-tieu")}>
            Quay lại
          </button>
          <button className="btn btn-primary" onClick={handleNext}>
            Tiếp theo
          </button>
        </div>
      </main>
    </div>
  );
}
