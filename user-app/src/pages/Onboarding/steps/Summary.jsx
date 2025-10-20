import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { api } from "../../../lib/api";
import "./Summary.css";
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

const GOAL_LABEL = {
  giam_can: "Giảm cân",
  duy_tri: "Duy trì cân nặng",
  tang_can: "Tăng cân",
  giam_mo: "Giảm mỡ",
  tang_co: "Tăng cơ",
};

const INTEN_LABEL = {
  level_1: "Không tập luyện, ít vận động",
  level_2: "Vận động nhẹ nhàng",
  level_3: "Chăm chỉ tập luyện",
  level_4: "Rất năng động",
};

export default function Summary() {
  const nav = useNavigate();
  const location = useLocation();

  const [goal, setGoal] = useState(localStorage.getItem("goal") || "");
  const [height, setHeight] = useState(Number(localStorage.getItem("heightCm")) || 170);
  const [weight, setWeight] = useState(Number(localStorage.getItem("weightKg")) || 65);
  const [target, setTarget] = useState(
    Number(localStorage.getItem("targetWeightKg")) ||
      Number(localStorage.getItem("weightKg")) ||
      65
  );
  const [weekly, setWeekly] = useState(Number(localStorage.getItem("weeklyChangeKg")) || 0);
  const [inten, setInten] = useState(localStorage.getItem("trainingIntensity") || "");

  const loadFromStorage = () => {
    const g = localStorage.getItem("goal") || "";
    const h = Number(localStorage.getItem("heightCm")) || 170;
    const w = Number(localStorage.getItem("weightKg")) || 65;
    const t = Number(localStorage.getItem("targetWeightKg")) || w;
    const wk = Number(localStorage.getItem("weeklyChangeKg")) || 0;
    const it = localStorage.getItem("trainingIntensity") || "";
    setGoal(g); setHeight(h); setWeight(w); setTarget(t); setWeekly(wk); setInten(it);
  };

  useEffect(() => { loadFromStorage(); /* eslint-disable-next-line */ }, [location.key]);
  useEffect(() => {
    const onFocus = () => loadFromStorage();
    const onVisibility = () => { if (document.visibilityState === "visible") loadFromStorage(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  useEffect(() => {
    const onStorage = (e) => {
      if (["goal","heightCm","weightKg","targetWeightKg","weeklyChangeKg","trainingIntensity"].includes(e.key)) {
        loadFromStorage();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // BMI hiện tại & mục tiêu
  const bmi = useMemo(() => Number((weight / Math.pow(height / 100, 2)).toFixed(1)), [height, weight]);
  const bmiTarget = useMemo(() => Number((target / Math.pow(height / 100, 2)).toFixed(1)), [height, target]);

  const mapBmiInfo = (x) => {
    let tag = "Bình thường", bgColor = "#4CAF50", textColor = "#fff";
    if (x < 18.5) { tag = "Gầy"; bgColor = "#40E0D0"; }
    else if (x < 25) { tag = "Bình thường"; bgColor = "#4CAF50"; }
    else if (x < 30) { tag = "Thừa cân"; bgColor = "#FFD54F"; textColor = "#000"; }
    else if (x < 35) { tag = "Béo phì độ I"; bgColor = "#FF9800"; }
    else if (x < 40) { tag = "Béo phì độ II"; bgColor = "#FF6E6E"; }
    else { tag = "Béo phì độ III"; bgColor = "#D32F2F"; }
    return { tag, bgColor, textColor };
  };

  const bmiInfo = useMemo(() => mapBmiInfo(bmi), [bmi]);
  const bmiTargetInfo = useMemo(() => mapBmiInfo(bmiTarget), [bmiTarget]);

  const toPercent = (val) => Math.min(100, Math.max(0, ((val - 15) / (40 - 15)) * 100));
  const percent = toPercent(bmi);
  const scaleMarks = [18.5, 25, 30, 35];

  const handleConfirm = async () => {
    const payload = {
      tenGoi: localStorage.getItem("nickname"),
      mucTieu: localStorage.getItem("goal"),
      chieuCao: Number(localStorage.getItem("heightCm")),
      canNangHienTai: Number(localStorage.getItem("weightKg")),
      canNangMongMuon: Number(localStorage.getItem("targetWeightKg")),
      mucTieuTuan: Number(localStorage.getItem("weeklyChangeKg")),
      cuongDoLuyenTap: localStorage.getItem("trainingIntensity"),
      gioiTinh: localStorage.getItem("sex"),
      ngaySinh: localStorage.getItem("dob"),
    };

    const missing = Object.entries(payload).filter(([_, v]) =>
      v === null || v === undefined || v === "" || Number.isNaN(v)
    ).map(([k]) => k);

    if (missing.length) {
      alert("Thiếu dữ liệu: " + missing.join(", ") + ". Hãy quay lại bổ sung.");
      return;
    }
    try {
      await api.post("/api/user/onboarding/upsert", payload);
      nav("/home");
    } catch (err) {
      alert("Gửi dữ liệu thất bại.\n" + (err?.response?.data?.message || "Xem console để biết chi tiết."));
      console.error(err);
    }
  };

  return (
    <div className="sm-wrap">
      <header className="sm-header">
        <Link to="/" className="logo-link" aria-label="Về trang chủ">
          <img src="/images/logo-fitmatch.png" alt="FitMatch" className="nk-logo" />
        </Link>
      </header>

      <main className="sm-main">
        <StepProgress currentSlug="tong-hop" />
        <div className="sm-card">
          <h3 className="sm-title">FitMatch tổng hợp lại thông tin giúp bạn nhé !</h3>

          {/* Box tổng hợp mục tiêu & thông số */}
          <div className="sm-box">
            <div className="sm-row">
              <span>Mục tiêu</span>
              <b>{GOAL_LABEL[goal] || "-"}</b>
            </div>
            <div className="sm-row">
              <span>Cân nặng mục tiêu</span>
              <b>{target.toFixed(1)} kg</b>
            </div>
            <div className="sm-row">
              <span>Cường độ tập luyện</span>
              <b>{INTEN_LABEL[inten] || "-"}</b>
            </div>
            {goal !== "duy_tri" && (
              <div className="sm-row">
                <span>Mục tiêu mỗi tuần</span>
                <b>{weekly > 0 ? `+${weekly.toFixed(1)}` : weekly.toFixed(1)} kg</b>
              </div>
            )}
          </div>

          {/* === Thanh BMI nằm GIỮA hai box === */}
          <div className="sm-bmi">
            <div className="sm-bar">
              <div className="sm-bar-inner" style={{ width: `${percent}%` }} />
            </div>
            <div className="sm-scale">
              <div className="sm-scale-end left">{`<18.5`}</div>
              {scaleMarks.map((m) => (
                <div key={m} className="sm-scale-mark" style={{ left: `${toPercent(m)}%` }}>
                  {m}
                </div>
              ))}
              <div className="sm-scale-end right">{`≥40`}</div>
            </div>
          </div>

          {/* Box chỉ số BMI (hiện tại vs mục tiêu) – căn giữa & cân bằng 2 bên */}
          <div className="sm-bmi-box">
            <div className="sm-midline" />
            <div className="sm-bmi-item">
              <div className="sm-bmi-label">BMI hiện tại</div>
              <div className="sm-bmi-value">{bmi}</div>
              <span
                className="sm-chip"
                style={{ backgroundColor: bmiInfo.bgColor, color: bmiInfo.textColor }}
              >
                {bmiInfo.tag}
              </span>
            </div>

            <div className="sm-bmi-item">
              <div className="sm-bmi-label">BMI mục tiêu</div>
              <div className="sm-bmi-value">{bmiTarget}</div>
              <span
                className="sm-chip"
                style={{ backgroundColor: bmiTargetInfo.bgColor, color: bmiTargetInfo.textColor }}
              >
                {bmiTargetInfo.tag}
              </span>
            </div>
          </div>
        </div>

        <div className="sm-actions">
          <button className="btn btn-outline" onClick={() => nav(-1)}>Quay lại</button>
          <button className="btn btn-primary" onClick={handleConfirm}>Xác nhận</button>
        </div>
      </main>
    </div>
  );
}
