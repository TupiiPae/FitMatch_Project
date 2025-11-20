import { useNavigate } from "react-router-dom";
import "./Landing.css";

export default function Landing() {
  const nav = useNavigate();

  return (
    <div className="lm-wrap">
      {/* HEADER trong suốt nằm trên video */}
      <header className="lm-header">
        <div className="lm-header-left" onClick={() => nav("/")}>
          <img
            src="/images/logo-fitmatch.png"
            alt="FitMatch Logo"
            className="lm-logo-img"
          />
        </div>

        <button className="lm-header-login" onClick={() => nav("/login")}>
          Đăng nhập
        </button>
      </header>

      {/* HERO – VIDEO BACKGROUND */}
      <section className="lm-hero">
        <video
          className="lm-bg-video"
          src="/videos/bg-landing.mp4"
          autoPlay
          muted
          loop
          playsInline
        />

        <div className="lm-hero-overlay" />

        {/* Nội dung chính – căn giữa màn hình */}
        <div className="lm-hero-content">
          {/* Logo + tên + slogan + note */}
          <div className="lm-hero-head">
            <img
              src="/images/logo-fitmatch.png"
              alt="FitMatch"
              className="lm-hero-logo"
            />

            {/* NOTE mới – 2 dòng */}
            <p className="lm-hero-slogan">
              CỘNG SỰ SỨC KHỎE CỦA BẠN
            </p>
          </div>

          {/* Hai box Đăng ký & Đăng nhập */}
          <div className="lm-hero-boxes">
            {/* BOX ĐĂNG KÝ */}
            <div
              className="lm-box lm-box-register"
              onClick={() => nav("/register")}
            >
              <div className="lm-box-header">
                <div className="lm-box-icon">
                  {/* icon tờ giấy + dấu + */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="13" x2="12" y2="19" />
                    <line x1="9" y1="16" x2="15" y2="16" />
                  </svg>
                </div>
                <div className="lm-box-title">Đăng ký ngay</div>
              </div>

              <p className="lm-box-text">
                Tạo tài khoản và bắt đầu hành trình cải thiện sức khỏe của bạn.
              </p>

              {/* nút vừa với dòng chữ, không full box */}
              <button
                className="lm-box-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  nav("/register");
                }}
              >
                Đăng ký ngay
              </button>
            </div>

            {/* BOX ĐĂNG NHẬP */}
            <div
              className="lm-box lm-box-login"
              onClick={() => nav("/login")}
            >
              <div className="lm-box-header">
                <div className="lm-box-icon">
                  {/* icon login */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                </div>
                <div className="lm-box-title">Đăng nhập</div>
              </div>

              <p className="lm-box-text">
                Quay lại theo dõi dinh dưỡng, luyện tập và tiến độ mỗi ngày.
              </p>

              <button
                className="lm-box-btn lm-box-btn-outline"
                onClick={(e) => {
                  e.stopPropagation();
                  nav("/login");
                }}
              >
                Đăng nhập
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Phần scroll xuống phía dưới giữ nguyên như trước */}
      <main className="lm-main">
        <section className="lm-section lm-section-intro" id="about">
          <h2>FITMATCH là gì?</h2>
          <p>
            FitMatch là &quot;cộng sự sức khỏe&quot; giúp bạn theo dõi dinh
            dưỡng, xây dựng lịch tập luyện khoa học và kết nối với người bạn
            đồng hành phù hợp.
          </p>
        </section>

        <section className="lm-section lm-section-features">
          <h2>Các tính năng chính</h2>
          <div className="lm-feature-grid">
            <div className="lm-feature-card">
              <h3>Kết nối thông minh</h3>
              <p>
                Gợi ý &quot;Partner&quot; luyện tập dựa trên mục tiêu, lịch
                trình và phong cách tập.
              </p>
            </div>
            <div className="lm-feature-card">
              <h3>Quản lý dinh dưỡng</h3>
              <p>
                Ghi nhật ký ăn uống, theo dõi calorie &amp; macro mỗi ngày, hỗ
                trợ cơ sở dữ liệu món ăn phong phú.
              </p>
            </div>
            <div className="lm-feature-card">
              <h3>Lịch tập &amp; bài tập</h3>
              <p>
                Thư viện bài tập Strength, Cardio &amp; Sport chi tiết, dễ đưa
                vào lịch tập cá nhân.
              </p>
            </div>
            <div className="lm-feature-card">
              <h3>Theo dõi tiến độ</h3>
              <p>
                Ghi nhận cân nặng, số đo, mức tạ và thống kê trực quan, giúp
                bạn nhìn rõ hành trình thay đổi.
              </p>
            </div>
          </div>
        </section>

        <section className="lm-section lm-section-benefits">
          <h2>Lợi ích vượt trội</h2>
          <div className="lm-benefit-grid">
            <div className="lm-benefit-card">
              <h3>Không còn tập một mình</h3>
              <p>
                Kết nối cộng đồng người dùng có cùng mục tiêu để tạo động lực
                mỗi ngày.
              </p>
            </div>
            <div className="lm-benefit-card">
              <h3>Cá nhân hoá sâu</h3>
              <p>
                Từ onboarding đến lịch tập, thực đơn đều xoay quanh mục tiêu
                của bạn.
              </p>
            </div>
            <div className="lm-benefit-card">
              <h3>Dễ dùng trên mọi thiết bị</h3>
              <p>
                Giao diện tối ưu cho mobile &amp; desktop, phù hợp cho cả người
                mới lẫn người tập lâu năm.
              </p>
            </div>
          </div>
        </section>

        <section className="lm-section lm-section-cta">
          <div className="lm-cta-box">
            <h2>Sẵn sàng thay đổi?</h2>
            <p>
              Tạo tài khoản FitMatch miễn phí, đặt mục tiêu rõ ràng và để chúng
              tôi đồng hành trên hành trình đó.
            </p>
            <button className="lm-cta-main" onClick={() => nav("/register")}>
              Đăng ký ngay
            </button>
          </div>
        </section>
      </main>

      <footer className="lm-footer">
        © {new Date().getFullYear()} FitMatch. All rights reserved.
      </footer>
    </div>
  );
}
