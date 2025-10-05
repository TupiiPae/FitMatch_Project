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

        <button className="lm-login" onClick={() => nav("/login")}>
          Đăng nhập
        </button>
      </header>

      {/* Hero */}
      <main className="lm-hero">
        <button className="lm-cta" onClick={() => nav("/register")}>
          Bắt đầu ngay <span className="lm-cta-arrow">›</span>
        </button>
      </main>

      <footer className="lm-footer">
        © {new Date().getFullYear()} FitMatch. All rights reserved.
      </footer>
    </div>
  );
}
