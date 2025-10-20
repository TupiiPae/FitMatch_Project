import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Nickname.css";
import './step-progress.css'

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
  return (
    <div className="sp">
      <ol className="sp-progress">
        {STEPS.map((s, idx) => {
          const completed = idx < currentIndex;
          const active = idx === currentIndex;
          return (
            <li key={s.slug} className={`sp-step ${completed ? "is-complete" : ""} ${active ? "is-active" : ""}`}>
              {idx !== 0 && <span className="sp-line" aria-hidden="true" />}
              <span className="sp-dot">
                {completed ? (
                  <svg viewBox="0 0 24 24" className="sp-check" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : <span className="sp-num">{idx + 1}</span>}
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

function tinhTuoi(ngaySinh) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngaySinh)) return null;
  const [y, m, d] = ngaySinh.split("-").map(Number);
  const today = new Date();
  const birth = new Date(y, m - 1, d);
  let age = today.getFullYear() - birth.getFullYear();
  const md = today.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function Nickname() {
  const nav = useNavigate();

  // ── Khởi tạo từ localStorage (nếu user quay lại bước này)
  const [tenGoi, setTenGoi] = useState(localStorage.getItem("nickname") || "");
  const [gioiTinh, setGioiTinh] = useState(localStorage.getItem("sex") || "");
  const [ngaySinh, setNgaySinh] = useState(localStorage.getItem("dob") || "");

  const [errTen, setErrTen] = useState("");
  const [errGT, setErrGT] = useState("");
  const [errDOB, setErrDOB] = useState("");
  const [loading, setLoading] = useState(false);

  const tuoi = useMemo(() => (ngaySinh ? tinhTuoi(ngaySinh) : null), [ngaySinh]);

  useEffect(() => {
    if (tenGoi.trim()) setErrTen("");
    if (gioiTinh) setErrGT("");
    if (ngaySinh && tuoi !== null) setErrDOB("");
  }, [tenGoi, gioiTinh, ngaySinh, tuoi]);

  const handleNext = async () => {
    const v = tenGoi.trim();
    let ok = true;

    if (!v) { setErrTen("Vui lòng nhập tên của bạn"); ok = false; }
    if (!gioiTinh) { setErrGT("Vui lòng chọn giới tính"); ok = false; }
    if (!ngaySinh) { setErrDOB("Vui lòng chọn ngày sinh"); ok = false; }
    else if (tuoi === null) { setErrDOB("Ngày sinh không đúng định dạng YYYY-MM-DD"); ok = false; }
    else if (tuoi < 10 || tuoi > 100) { setErrDOB("Tuổi phải trong khoảng 10–100"); ok = false; }

    if (!ok) return;

    setLoading(true);
    try {
      localStorage.setItem("nickname", v);
      localStorage.setItem("sex", gioiTinh);
      localStorage.setItem("dob", ngaySinh);
      nav("/onboarding/muc-tieu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nk-wrap">
      <header className="nk-header">
        <img src="/images/logo-fitmatch.png" alt="FitMatch" className="nk-logo" />
      </header>

      <main className="nk-main">
        {/* Progress nằm ngay dưới navbar, trên card */}
        <StepProgress currentSlug="ten-goi" />

        <div className="nk-card">
          <h3 className="nk-title">Cho chúng tôi biết về bạn nhé!</h3>
          <p className="nk-desc">Chúng tôi rất vui khi được chào đón bạn. Hãy bắt đầu bằng vài thông tin cơ bản.</p>

          {/* Nickname */}
          <div className="nk-field">
            <div className="nk-input-wrap">
              <input
                className="nk-input nk-input-large"
                placeholder="Nhập nickname của bạn"
                value={tenGoi}
                onChange={(e) => setTenGoi(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNext()}
                autoFocus
                disabled={loading}
                aria-label="Nickname"
              />
            </div>
            {errTen && <div className="nk-error">{errTen}</div>}
          </div>

          {/* Hai cột */}
          <div className="nk-two-col">
            {/* Giới tính */}
            <div className="nk-col nk-sex">
              <div className="nk-group-title">Giới tính</div>
              <div className="nk-sex-grid">
                <label
                  className={`sex-card ${gioiTinh === "male" ? "active" : ""}`}
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setGioiTinh("male")}
                >
                  <input
                    type="radio"
                    name="gioiTinh"
                    value="male"
                    checked={gioiTinh === "male"}
                    onChange={(e) => setGioiTinh(e.target.value)}
                    disabled={loading}
                  />
                  <span className="sex-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <path d="M14 5h7m0 0v7m0-7l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="9" cy="15" r="5" stroke="currentColor" strokeWidth="1.6"/>
                    </svg>
                  </span>
                  <span className="sex-text">Nam</span>
                </label>

                <label
                  className={`sex-card ${gioiTinh === "female" ? "active" : ""}`}
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setGioiTinh("female")}
                >
                  <input
                    type="radio"
                    name="gioiTinh"
                    value="female"
                    checked={gioiTinh === "female"}
                    onChange={(e) => setGioiTinh(e.target.value)}
                    disabled={loading}
                  />
                  <span className="sex-icon" aria-hidden="true">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="8" r="5" stroke="currentColor" strokeWidth="1.6"/>
                      <path d="M12 13v8M9 18h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <span className="sex-text">Nữ</span>
                </label>
              </div>
              {errGT && <div className="nk-error">{errGT}</div>}
            </div>

            {/* Ngày sinh */}
            <div className="nk-col nk-dob">
              <div className="nk-group-title">Ngày sinh</div>
              <div className="dob-input">
                <span className="calendar-icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6"/>
                    <path d="M16 3v4M8 3v4M3 9h18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                </span>
                <input
                  className="nk-input nk-input-date"
                  type="date"
                  value={ngaySinh}
                  onChange={(e) => setNgaySinh(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  disabled={loading}
                  aria-label="Ngày sinh"
                />
              </div>

              {errDOB && <div className="nk-error">{errDOB}</div>}
              {tuoi !== null && !errDOB && (
                <div className="nk-hint">Tuổi của bạn: <b>{tuoi}</b></div>
              )}
            </div>
          </div>
        </div>

        <div className="nk-actions">
          <button className="btn btn-outline" onClick={() => nav("/onboarding/chao-mung")} disabled={loading}>
            Quay lại
          </button>
          <button className={`btn btn-primary ${loading ? "loading" : ""}`} onClick={handleNext} disabled={loading}>
            {loading ? "Đang lưu..." : "Tiếp theo"}
          </button>
        </div>
      </main>
    </div>
  );
}
