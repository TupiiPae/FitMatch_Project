import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "./Nickname.css";
import "./step-progress.css";

import { TextField } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";


import { toast } from "react-toastify";
import { validateNickname } from "../../../lib/validators";

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
  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.slug === currentSlug));
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
                    <path
                      d="M20 6L9 17l-5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
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

  // load lại từ localStorage
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

    // ✅ Validate nickname bằng validators.js
    const nickErr = validateNickname(v, { required: true });
    if (nickErr) {
      setErrTen(nickErr);
      toast.error(nickErr);
      return;
    }

    // các validate còn lại
    if (!gioiTinh) {
      setErrGT("Vui lòng chọn giới tính");
      toast.error("Vui lòng chọn giới tính");
      return;
    }
    if (!ngaySinh) {
      setErrDOB("Vui lòng chọn ngày sinh");
      toast.error("Vui lòng chọn ngày sinh");
      return;
    }
    if (tuoi === null) {
      setErrDOB("Ngày sinh không đúng định dạng YYYY-MM-DD");
      toast.error("Ngày sinh không đúng định dạng YYYY-MM-DD");
      return;
    }
    if (tuoi < 10 || tuoi > 100) {
      setErrDOB("Tuổi phải trong khoảng 10–100");
      toast.error("Tuổi phải trong khoảng 10–100");
      return;
    }

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
        <Link to="/" className="logo-link" aria-label="Về trang chủ">
          <img src="/images/logo-fitmatch.png" alt="FitMatch" className="nk-logo" />
        </Link>
      </header>

      <main className="nk-main">
        <StepProgress currentSlug="ten-goi" />

        <div className="nk-card">
          <h3 className="nk-title">Cho chúng tôi biết về bạn nhé!</h3>
          <p className="nk-desc">
            Chúng tôi rất vui khi được chào đón bạn. Hãy bắt đầu bằng vài thông tin cơ bản.
          </p>

          <div className="nk-field">
            <TextField
              label="Nickname của bạn"
              variant="outlined"
              fullWidth
              className="nk-input-large"
              value={tenGoi}
              onChange={(e) => setTenGoi(e.target.value)}
              onBlur={(e) => setErrTen(validateNickname(e.target.value, { required: true }))}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              autoFocus
              disabled={loading}
              error={!!errTen}
              helperText={errTen || ""} 
            />
          </div>

          <div className="nk-two-col">
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
                      <path d="M14 5h7m0 0v7m0-7l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="9" cy="15" r="5" stroke="currentColor" strokeWidth="1.6" />
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
                      <circle cx="12" cy="8" r="5" stroke="currentColor" strokeWidth="1.6" />
                      <path d="M12 13v8M9 18h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </span>
                  <span className="sex-text">Nữ</span>
                </label>
              </div>
              {errGT && <div className="nk-error">{errGT}</div>}
            </div>

            <div className="nk-col nk-dob">
              <div className="nk-group-title">Ngày sinh</div>
<LocalizationProvider dateAdapter={AdapterDayjs}>
  <DatePicker
    format="DD/MM/YYYY"
    value={ngaySinh ? dayjs(ngaySinh) : null}
    onChange={(newValue) => {
      setNgaySinh(newValue ? newValue.format("YYYY-MM-DD") : "");
    }}
    maxDate={dayjs(new Date())}
    disabled={loading}
    slotProps={{
      textField: {
        fullWidth: true,
        // vẫn có thể giữ className nếu bạn muốn reuse CSS khác
        className: "nk-input-large",
        error: !!errDOB,
        helperText: errDOB || "",
        sx: {
          "& .MuiOutlinedInput-root": {
            height: 52,
            borderRadius: 2,
            backgroundColor: "#ffffff",
            "& fieldset": {
              borderColor: "#008080",
            },
            "&:hover fieldset": {
              borderColor: "#008080",
            },
            "&.Mui-focused fieldset": {
              borderColor: "#008080",
              boxShadow: "0 0 0 3px rgba(0,128,128,0.16)",
            },
          },
          "& .MuiInputBase-input": {
            fontSize: 16,
          },
        },
      },
    }}
  />
</LocalizationProvider>
              {tuoi !== null && !errDOB && (
                <div className="nk-hint">
                  Tuổi của bạn: <b>{tuoi}</b>
                </div>
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
