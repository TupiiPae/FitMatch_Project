import { useEffect } from "react"; 
import { useNavigate, useLocation } from "react-router-dom"
import "./Landing.css";

export default function Landing() {
  const nav = useNavigate();
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) {
      // Tìm phần tử có id tương ứng với hash (bỏ dấu # ở đầu)
      const element = document.getElementById(hash.replace("#", ""));
      if (element) {
        // Cuộn xuống mượt mà
        element.scrollIntoView({ behavior: "smooth" });
      }
    } else {
        // (Tuỳ chọn) Nếu không có hash thì cuộn lên đầu
        window.scrollTo(0, 0);
    }
  }, [hash]);

  return (
    <div className="lm-wrap">
      {/* HEADER trong suốt nằm trên video (nếu cần dùng thì mở lại) */}
      {/* <header className="lm-header">
        <div className="lm-header-left" onClick={() => nav("/")}>
          <img
            src="/images/fm-logo-iconname.png"
            alt="FitMatch Logo"
            className="lm-logo-img"
          />
        </div>

        <button className="lm-header-login" onClick={() => nav("/login")}>
          Đăng nhập
        </button>
      </header> */}

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
          {/* Logo + slogan */}
          <div className="lm-hero-head">
            <img
              src="/images/fm-logo-name.png"
              alt="FitMatch"
              className="lm-hero-logo"
            />
            <p className="lm-hero-slogan">CỘNG SỰ SỨC KHỎE CỦA BẠN</p>
          </div>

          {/* Hai box Đăng ký & Đăng nhập – vuông */}
          <div className="lm-hero-boxes">
            {/* BOX ĐĂNG KÝ */}
            <div
              className="lm-box lm-box-register"
              onClick={() => nav("/register")}
            >
              <p className="lm-box-text">
                Tạo tài khoản và bắt đầu hành trình cải thiện sức khỏe của bạn.
              </p>
              <div className="lm-box-header">
                <div className="lm-box-icon">
                  {/* icon tờ giấy + dấu + */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="30"
                    height="30"
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


            </div>

            {/* BOX ĐĂNG NHẬP */}
            <div
              className="lm-box lm-box-login"
              onClick={() => nav("/login")}
            >
              <p className="lm-box-text">
                Quay lại theo dõi dinh dưỡng, luyện tập và tiến độ mỗi ngày.
              </p>
              <div className="lm-box-header">
                <div className="lm-box-icon">
                  {/* icon login */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="30"
                    height="30"
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
            </div>
          </div>
        </div>
      </section>

      {/* ========== Phần scroll xuống phía dưới ========== */}
      <main className="lm-main" id="main-content">
        {/* SECTION 1: Banner Tìm Partner (ảnh nền + CTA) */}
        <section className="lm-main-hero">
          <div className="lm-main-hero-inner">
            <h1 className="lm-main-hero-title">
              Đừng tập một mình. Tìm ngay &apos;Partner&apos; hoàn hảo.
            </h1>
            <p className="lm-main-hero-text">
              FITMATCH giúp bạn kết nối với những người cùng mục tiêu, tạo động
              lực và đạt kết quả nhanh hơn.
            </p>
            <button
              className="lm-main-hero-btn"
              onClick={() => nav("/register")}
            >
              Tìm bạn tập ngay
            </button>
          </div>
        </section>

        {/* SECTION 2: FITMATCH là gì? */}
        <section className="lm-section lm-section-intro" id="about">
          <h2>FITMATCH là gì?</h2>
            <img
              src="/images/thumb4.png"
              alt="FitMatch"
              className="lm-section-logo"
            />
          <p>
            Là ứng dụng hỗ trợ quản lý dinh dưỡng, tập luyện và kết nối những người đam mê thể thao, giúp bạn tìm được
            người bạn đồng hành lý tưởng để cùng nhau chinh phục mọi mục tiêu
            tập luyện và dinh dưỡng. Không còn loay hoay với những công cụ riêng lẻ - Hay những buổi tập đơn độc, hãy cùng
            nhau tạo nên sự khác biệt.
          </p>
        </section>

        {/* SECTION 3: Các tính năng chính */}
        <section className="lm-section lm-section-features">
            <div className="lm-section-header">
              <h2>Các tính năng chính</h2>
              <p>
                Khám phá những công cụ mạnh mẽ giúp bạn tối ưu hóa hành trình sức
                khỏe của mình.
              </p>
            </div>

            <div className="lm-feature-grid">
              <div className="lm-feature-card">
                <div className="lm-feature-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                </div>
                <h3>Kết nối thông minh</h3>
                <p>
                  Tìm bạn tập dựa trên mục tiêu, lịch trình và địa điểm phù hợp
                  nhất với bạn.
                </p>
              </div>

              <div className="lm-feature-card">
                <div className="lm-feature-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M4 12h16" />
                    <path d="M12 2a8 8 0 0 1 0 16" />
                  </svg>
                </div>
                <h3>Quản lý dinh dưỡng</h3>
                <p>
                  Xây dựng và theo dõi kế hoạch ăn uống được cá nhân hóa để đạt
                  hiệu quả tối đa.
                </p>
              </div>

              <div className="lm-feature-card">
                <div className="lm-feature-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                <h3>Quản lý tập luyện</h3>
                <p>
                  Xây dựng và theo dõi kế hoạch ăn uống được cá nhân hóa để đạt
                  hiệu quả tối đa.
                </p>
              </div>

              <div className="lm-feature-card">
                <div className="lm-feature-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 17 9 11 13 15 21 7" />
                    <polyline points="14 7 21 7 21 14" />
                  </svg>
                </div>
                <h3>Theo dõi tiến độ</h3>
                <p>
                  Ghi lại kế hoạch và thống kê quá trình thực hiện
                  mục tiêu của bạn.
                </p>
              </div>
            </div>
        </section>

        {/* SECTION 4: Lợi ích vượt trội */}
        <section className="lm-section lm-section-benefits">
          <div className="lm-section-header">
            <h2>Lợi ích vượt trội</h2>
            <p>
              FITMATCH không chỉ là một ứng dụng, mà là người bạn đồng hành
              trên con đường chinh phục sức khỏe.
            </p>
          </div>

          <div className="lm-benefit-grid">
            <div className="lm-benefit-card">
              <img
                className="lm-benefit-img"
                src="/images/thumb1.png"
                alt="Hai người high-five trong phòng gym"
              />
              <div className="lm-benefit-body">
                <h3>Nhân đôi động lực</h3>
                <p>
                  Tập luyện cùng bạn bè luôn vui và hiệu quả hơn. Cùng nhau
                  chia sẻ, cạnh tranh và vượt qua mọi giới hạn.
                </p>
              </div>
            </div>

            <div className="lm-benefit-card">
              <img
                className="lm-benefit-img"
                src="/images/thumb2.png"
                alt="Sổ kế hoạch luyện tập và đồ ăn lành mạnh"
              />
              <div className="lm-benefit-body">
                <h3>Kiến thức chuyên sâu</h3>
                <p>
                  Tiếp cận các kế hoạch dinh dưỡng và bài tập được thiết kế bởi
                  chuyên gia, phù hợp với mục tiêu của bạn.
                </p>
              </div>
            </div>

            <div className="lm-benefit-card-mid">
              <img
                className="lm-benefit-img"
                src="/images/thumb3.png"
                alt="Sổ kế hoạch luyện tập và đồ ăn lành mạnh"
              />
              <div className="lm-benefit-body">
                <h3>Tiện lợi hơn với AI</h3>
                <p>
                  AI được tích hợp để việc tính toán Calories từ các món ăn
                  dễ dàng và nhanh chóng hơn.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: CTA cuối */}
        <section className="lm-section lm-section-cta">
          <div className="lm-cta-box">
            <h2>Sẵn sàng thay đổi?</h2>
            <p>
              Bắt đầu hành trình của bạn với FITMATCH ngay hôm nay. Tìm bạn
              tập, lên kế hoạch và chinh phục mục tiêu của bạn.
            </p>
            <button
              className="lm-cta-main"
              onClick={() => nav("/register")}
            >
              Đăng ký miễn phí
            </button>
          </div>
        </section>
      </main>

      <footer className="lm-footer">
        © {new Date().getFullYear()} FITMATCH. All rights reserved.
      </footer>
    </div>
  );
}
