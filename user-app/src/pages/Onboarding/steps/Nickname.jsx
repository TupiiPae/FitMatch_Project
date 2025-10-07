import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Nickname.css";

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
    // Xoá lỗi khi người dùng sửa dữ liệu
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
      // ✅ Lưu vào localStorage để bước Summary submit lên BE
      localStorage.setItem("nickname", v);
      localStorage.setItem("sex", gioiTinh);       // "male" | "female"
      localStorage.setItem("dob", ngaySinh);       // "YYYY-MM-DD"

      // 👉 Không gọi API ở bước này. BE chỉ nhận /api/user/onboarding/upsert ở bước cuối (Summary).
      nav("/onboarding/muc-tieu");
    } catch (error) {
      console.error(error);
      // Không alert to — để UX mượt. Nếu muốn có thể hiển thị toast ở đây.
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nk-wrap">
      <header className="nk-header">
        <img src="\images\logo-fitmatch.png" alt="FitMatch" className="nk-logo" />
      </header>

      <main className="nk-main">
        <div className="nk-card">
          <h3 className="nk-title">Cho chúng tôi biết về bạn nhé!</h3>
          <p className="nk-desc">
            Chúng tôi rất vui khi được chào đón bạn. Hãy bắt đầu bằng vài thông tin cơ bản.
          </p>

          {/* Tên gọi */}
          <div className="nk-field">
            <label className="nk-label">Tên gọi</label>
            <input
              className="nk-input"
              placeholder="Nhập tên"
              value={tenGoi}
              onChange={(e) => setTenGoi(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              autoFocus
              disabled={loading}
            />
            {errTen && <div className="nk-error">{errTen}</div>}
          </div>

          {/* Giới tính */}
          <div className="nk-field">
            <label className="nk-label">Giới tính</label>
            <div className="nk-radio-group">
              <label className={`nk-radio ${gioiTinh === "male" ? "active" : ""}`}>
                <input
                  type="radio"
                  name="gioiTinh"
                  value="male"
                  checked={gioiTinh === "male"}
                  onChange={(e) => setGioiTinh(e.target.value)}
                  disabled={loading}
                />
                Nam
              </label>
              <label className={`nk-radio ${gioiTinh === "female" ? "active" : ""}`}>
                <input
                  type="radio"
                  name="gioiTinh"
                  value="female"
                  checked={gioiTinh === "female"}
                  onChange={(e) => setGioiTinh(e.target.value)}
                  disabled={loading}
                />
                Nữ
              </label>
            </div>
            {errGT && <div className="nk-error">{errGT}</div>}
          </div>

          {/* Ngày sinh */}
          <div className="nk-field">
            <label className="nk-label">Ngày sinh</label>
            <input
              className="nk-input"
              type="date"
              value={ngaySinh}
              onChange={(e) => setNgaySinh(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              disabled={loading}
            />
            {errDOB && <div className="nk-error">{errDOB}</div>}
            {tuoi !== null && !errDOB && (
              <div className="nk-hint">Tuổi của bạn: <b>{tuoi}</b></div>
            )}
          </div>
        </div>

        <div className="nk-actions">
          <button className="btn btn-outline" onClick={() => nav("/onboarding/chao-mung")} disabled={loading}>
            Hủy
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
