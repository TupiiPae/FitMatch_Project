import { useNavigate } from "react-router-dom";
import "./Landing.css";

export default function Landing() {
  const nav = useNavigate();

  return (
    <div className="lm-wrap">
      {/* Header */}
      <header className="lm-header">
        {/*Thay logo text bằng ảnh */}
        <img
          src="/images/logo-fitmatch.png"
          alt="FitMatch Logo"
          className="lm-logo-img"
          onClick={() => nav("/")}
        />

        {/* --- THAY ĐỔI ICON Ở ĐÂY --- */}
        <button
          className="lm-login-btn"
          onClick={() => nav("/login")}
          title="Đăng nhập" 
        >
          {/* Icon Avatar (hình người) */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5" // Giữ nguyên độ dày
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Đây là code cho icon hình người */}
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </button>
        {/* --- KẾT THÚC THAY ĐỔI --- */}

      </header>

      {/* Hero */}
      <main className="lm-hero">
        <button className="lm-cta" onClick={() => nav("/register")}>
          Đăng ký ngay <span className="lm-cta-arrow">›</span>
        </button>
      </main>

      <footer className="lm-footer">
        © {new Date().getFullYear()} FitMatch. All rights reserved.
      </footer>
    </div>
  );
}