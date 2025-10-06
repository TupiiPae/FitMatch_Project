// src/pages/Onboarding/steps/Nickname.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";
import "./Nickname.css";

export default function Nickname() {
  const nav = useNavigate();
  const [nickname, setNickname] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    // ✅ 1. Kiểm tra dữ liệu
    if (!nickname.trim()) {
      setErr("Vui lòng nhập tên của bạn");
      return;
    }
    setErr("");
    setLoading(true);

    try {
      // ✅ 2. Gửi dữ liệu lên server
      const token = localStorage.getItem("token");
      if (!token) {
        setErr("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
        nav("/login");
        return;
      }

      await api.patch(
        "/user/onboarding",
        { nickname: nickname.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // ✅ 3. Lưu lại để client có thể tiếp tục flow (nếu cần)
      localStorage.setItem("nickname", nickname.trim());

      // ✅ 4. Chuyển sang bước kế tiếp
      nav("/onboarding/muc-tieu");
    } catch (error) {
      console.error(error);
      setErr("Đã xảy ra lỗi, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nk-wrap">
      <header className="nk-header">
        <img
          src="/assets/logo/fitmatch-logo.png"
          alt="FitMatch"
          className="nk-logo"
        />
      </header>

      <main className="nk-main">
        <div className="nk-card">
          <h3 className="nk-title">Cho chúng tôi biết tên của bạn nhé !</h3>
          <p className="nk-desc">
            Chúng tôi rất vui khi được chào đón bạn.
            <br /> Hãy cùng tìm hiểu một chút về bạn nhé.
          </p>

          <div className="nk-field">
            <input
              className="nk-input"
              placeholder="Nhập tên"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoFocus
              disabled={loading}
            />
            {err && <div className="nk-error">{err}</div>}
          </div>
        </div>

        <div className="nk-actions">
          <button
            className="btn btn-outline"
            onClick={() => nav("/onboarding/chao-mung")}
            disabled={loading}
          >
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
