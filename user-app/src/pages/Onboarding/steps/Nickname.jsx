// user-app/src/pages/Onboarding/steps/Nickname.jsx
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
import { api } from "../../../lib/api";

const STEPS = [
  { slug: "ten-goi",            label: "B1" },
  { slug: "muc-tieu",           label: "B2" },
  { slug: "dong-luc",           label: "B3" },
  { slug: "can-nang-muc-tieu",  label: "B4" },
  { slug: "cuong-do",           label: "B5" },
  { slug: "tong-hop",           label: "B6" },
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
            <li
              key={s.slug}
              className={`sp-step ${completed ? "is-complete" : ""} ${active ? "is-active" : ""}`}
            >
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

  // load từ localStorage
  const [tenGoi, setTenGoi] = useState(localStorage.getItem("nickname") || "");
  const [gioiTinh, setGioiTinh] = useState(localStorage.getItem("sex") || "");
  const [ngaySinh, setNgaySinh] = useState(localStorage.getItem("dob") || "");

  const [canNang, setCanNang] = useState(localStorage.getItem("weightKg") || "");
  const [chieuCao, setChieuCao] = useState(localStorage.getItem("heightCm") || "");

  const [errTen, setErrTen] = useState("");
  const [errGT, setErrGT] = useState("");
  const [errDOB, setErrDOB] = useState("");
  const [errWeight, setErrWeight] = useState("");
  const [errHeight, setErrHeight] = useState("");
  const [loading, setLoading] = useState(false);

  const tuoi = useMemo(() => (ngaySinh ? tinhTuoi(ngaySinh) : null), [ngaySinh]);

  useEffect(() => {
    if (tenGoi.trim()) setErrTen("");
    if (gioiTinh) setErrGT("");
    if (ngaySinh && tuoi !== null) setErrDOB("");
    if (canNang) setErrWeight("");
    if (chieuCao) setErrHeight("");
  }, [tenGoi, gioiTinh, ngaySinh, tuoi, canNang, chieuCao]);

  const handleNext = async () => {
    const v = tenGoi.trim();

    // ✅ Validate nickname
    const nickErr = validateNickname(v, { required: true });
    if (nickErr) {
      setErrTen(nickErr);
      toast.error(nickErr);
      return;
    }

    // Giới tính
    if (!gioiTinh) {
      const msg = "Vui lòng chọn giới tính";
      setErrGT(msg);
      toast.error(msg);
      return;
    }

    // Ngày sinh
    if (!ngaySinh) {
      const msg = "Vui lòng chọn ngày sinh";
      setErrDOB(msg);
      toast.error(msg);
      return;
    }
    if (tuoi === null) {
      const msg = "Ngày sinh không đúng định dạng YYYY-MM-DD";
      setErrDOB(msg);
      toast.error(msg);
      return;
    }
    if (tuoi < 10 || tuoi > 100) {
      const msg = "Tuổi phải trong khoảng 10–100";
      setErrDOB(msg);
      toast.error(msg);
      return;
    }

    // Cân nặng
    const w = Number(canNang);
    if (!canNang || !Number.isFinite(w)) {
      const msg = "Vui lòng nhập cân nặng hiện tại";
      setErrWeight(msg);
      toast.error(msg);
      return;
    }
    if (w < 30 || w > 200) {
      const msg = "Cân nặng phải trong khoảng 30–200 kg";
      setErrWeight(msg);
      toast.error(msg);
      return;
    }

    // Chiều cao
    const h = Number(chieuCao);
    if (!chieuCao || !Number.isFinite(h)) {
      const msg = "Vui lòng nhập chiều cao hiện tại";
      setErrHeight(msg);
      toast.error(msg);
      return;
    }
    if (h < 120 || h > 220) {
      const msg = "Chiều cao phải trong khoảng 120–220 cm";
      setErrHeight(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      // Lưu localStorage để các bước sau dùng
      localStorage.setItem("nickname", v);
      localStorage.setItem("sex", gioiTinh);
      localStorage.setItem("dob", ngaySinh);
      localStorage.setItem("weightKg", String(w));
      localStorage.setItem("heightCm", String(h));

      // Lưu số liệu cơ bản lên BE (thay cho BasicMetrics cũ)
      await api.patch("/user/onboarding", {
        "profile.heightCm": h,
        "profile.weightKg": w,
      });

      nav("/onboarding/muc-tieu");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Có lỗi xảy ra, thử lại nhé.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nk-wrap">
      <header className="nk-header">
        <Link to="/" className="logo-link" aria-label="Về trang chủ">
          <img src="/images/fm-logo-name.png" alt="FitMatch" className="nk-logo" />
        </Link>
      </header>

      <main className="nk-main">
        <StepProgress currentSlug="ten-goi" />

        <div className="nk-card">
          <h3 className="nk-title">Cho chúng tôi biết về bạn nhé!</h3>
          <p className="nk-desc">
            Chúng tôi rất vui khi được chào đón bạn. Hãy bắt đầu bằng vài thông tin cơ bản.
          </p>

          {/* Nickname */}
          <div className="nk-field">
            <div className="nk-group-title">Tên gọi của bạn</div>
            <TextField
              label="Tên gọi của bạn"
              variant="outlined"
              fullWidth
              className="nk-input-large"
              value={tenGoi}
              onChange={(e) => setTenGoi(e.target.value)}
              onBlur={(e) => setErrTen(validateNickname(e.target.value, { required: true }) || "")}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              autoFocus
              disabled={loading}
              error={!!errTen}
              helperText={errTen || ""}
              sx={{
                "& .MuiOutlinedInput-root": {
                  height: 52,
                  backgroundColor: "#ffffff",
                  "& fieldset": { borderColor: "#4b5563" },
                  "&:hover fieldset": { borderColor: "#f97373" },
                },
                "& .MuiInputBase-input": { fontSize: 16, color: "#111827" },
                "& .MuiInputLabel-root": { color: "#9ca3af" },
              }}>
            </TextField>
          </div>

          {/* Giới tính + Ngày sinh */}
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
                        <path
                          d="M14 5h7m0 0v7m0-7l-8 8"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
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
                      className: "nk-input-large",
                      error: !!errDOB,
                      helperText: errDOB || "",
                      sx: {
                        "& .MuiOutlinedInput-root": {
                          height: 52,
                          backgroundColor: "#ffffff",
                          "& fieldset": { borderColor: "#4b5563" },
                          "&:hover fieldset": { borderColor: "#f97373" },
                          "&.Mui-focused fieldset": {
                            borderColor: "#ef4444",
                            boxShadow: "0 0 0 3px rgba(239,68,68,0.35)",
                          },
                        },
                        "& .MuiInputBase-input": { fontSize: 16 },
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

          {/* Cân nặng & Chiều cao hiện tại */}
          <div className="nk-metrics-row">
            <div className="nk-col">
              <div className="nk-group-title">Cân nặng hiện tại</div>
              <TextField
                type="number"
                label="Cân nặng (kg)"
                variant="outlined"
                fullWidth
                value={canNang}
                onChange={(e) => setCanNang(e.target.value)}
                disabled={loading}
                error={!!errWeight}
                helperText={errWeight || "Khoảng 30–200 kg"}
                inputProps={{ step: "0.1", min: "30", max: "200" }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    height: 52,
                    backgroundColor: "#ffffff",
                    "& fieldset": { borderColor: "#4b5563" },
                    "&:hover fieldset": { borderColor: "#f97373" },
                  },
                  "& .MuiInputBase-input": { fontSize: 16, color: "#111827" },
                  "& .MuiInputLabel-root": { color: "#9ca3af" },
                }}
              />
            </div>

            <div className="nk-col">
              <div className="nk-group-title">Chiều cao hiện tại</div>
              <TextField
                type="number"
                label="Chiều cao (cm)"
                variant="outlined"
                fullWidth
                value={chieuCao}
                onChange={(e) => setChieuCao(e.target.value)}
                disabled={loading}
                error={!!errHeight}
                helperText={errHeight || "Khoảng 120–220 cm"}
                inputProps={{ step: "1", min: "120", max: "220" }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    height: 52,
                    backgroundColor: "#ffffff",
                    "& fieldset": { borderColor: "#4b5563" },
                    "&:hover fieldset": { borderColor: "#f97373" },
                  },
                  "& .MuiInputBase-input": { fontSize: 16, color: "#111827" },
                  "& .MuiInputLabel-root": { color: "#9ca3af" },
                }}
              />
            </div>
          </div>
        </div>

        <div className="nk-actions">
          <button
            className="btn btn-outline"
            onClick={() => nav("/onboarding/chao-mung")}
            disabled={loading}
          >
            Quay lại
          </button>
          <button
            className={`btn btn-primary ${loading ? "loading" : ""}`}
            onClick={handleNext}
            disabled={loading}
          >
            {loading ? "Đang lưu..." : "Tiếp theo"}
          </button>
        </div>
      </main>
    </div>
  );
}
