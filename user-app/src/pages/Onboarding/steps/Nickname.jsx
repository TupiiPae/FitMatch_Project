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
    const value = nickname.trim();
    if (!value) {
      setErr("Vui lòng nhập tên của bạn");
      return;
    }
    setErr("");
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setErr("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
        nav("/login");
        return;
      }

      // ✅ Gửi đúng key theo BE: "profile.nickname"
      await api.patch(
        "/user/onboarding",
        { "profile.nickname": value },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      localStorage.setItem("nickname", value);
      nav("/onboarding/muc-tieu"); // 👉 sang bước chọn mục tiêu
    } catch (error) {
      console.error(error);
      setErr(error?.response?.data?.message || "Đã xảy ra lỗi, vui lòng thử lại.");
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
          <h3 className="nk-title">Cho chúng tôi biết tên của bạn nhé !</h3>
          <p className="nk-desc">Chúng tôi rất vui khi được chào đón bạn.<br/>Hãy cùng tìm hiểu một chút về bạn nhé.</p>

          <div className="nk-field">
            <input
              className="nk-input"
              placeholder="Nhập tên"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              autoFocus
              disabled={loading}
            />
            {err && <div className="nk-error">{err}</div>}
          </div>
        </div>

        <div className="nk-actions">
          <button className="btn btn-outline" onClick={() => nav("/onboarding/chao-mung")} disabled={loading}>
            Hủy
          </button>
          <button
            className={`btn btn-primary ${loading ? "loading" : ""}`}
            onClick={handleNext}
            disabled={loading || !nickname.trim()}
          >
            {loading ? "Đang lưu..." : "Tiếp theo"}
          </button>
        </div>
      </main>
    </div>
  );
}
