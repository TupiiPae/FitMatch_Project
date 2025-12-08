// user-app/src/pages/Misc/NotFound.jsx
import { Link, useNavigate } from "react-router-dom";
import "./NotFound.css";

export default function NotFound() {
  const nav = useNavigate();
  const token = localStorage.getItem("token");

  const handleGoHome = () => {
    // Nếu đã login thì về /home, chưa login thì về trang root
    nav(token ? "/home" : "/");
  };

  return (
    <div className="nf-wrap">
      <main className="nf-container">

        <div className="nf-number">404</div>

        {/* Icon tạ (SVG) */}
        <svg
          className="nf-dumbbell"
          viewBox="0 0 200 100"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect x="20" y="35" width="20" height="30" fill="#ff3333" rx="3" />
          <rect x="40" y="45" width="120" height="10" fill="#cccccc" rx="2" />
          <rect x="160" y="35" width="20" height="30" fill="#ff3333" rx="3" />
          <circle cx="30" cy="30" r="8" fill="#666666" />
          <circle cx="30" cy="70" r="8" fill="#666666" />
          <circle cx="170" cy="30" r="8" fill="#666666" />
          <circle cx="170" cy="70" r="8" fill="#666666" />
        </svg>

        <h1 className="nf-title">Ôi! Bạn bị sập tạ hả</h1>
        <h2 className="nf-subtitle">Chúng tôi sẽ đến giúp bạn ngay, hãy thử lại sau nhé!</h2>

        <button className="nf-cta" onClick={handleGoHome}>
          <span>Về Trang Chủ</span>
        </button>

        <div className="nf-links-container">
          <div className="nf-quick-links">
          </div>
        </div>

        <p className="nf-motivation">
          “Thất bại là cơ hội để bắt đầu lại một cách thông minh hơn” 💪
        </p>
      </main>
    </div>
  );
}
