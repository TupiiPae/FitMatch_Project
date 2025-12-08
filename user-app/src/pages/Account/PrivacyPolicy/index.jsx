// user-app/src/pages/Account/PrivacyPolicy/index.jsx
import React from "react";
import "../AccountSettings/AccountLayout.css"; // dùng lại width/nav vars
import "./Policy.css";
import Policy from "./Policy";

const SECTIONS = [
  { id: "pp-intro", label: "Giới thiệu" },
  { id: "pp-sec-1", label: "1. Thông tin chúng tôi thu thập" },
  { id: "pp-sec-2", label: "2. Cách chúng tôi sử dụng thông tin" },
  { id: "pp-sec-3", label: "3. Chia sẻ thông tin của bạn" },
  { id: "pp-sec-4", label: "4. Cookies & công nghệ theo dõi" },
  { id: "pp-sec-5", label: "5. Xử lý đăng nhập xã hội" },
  { id: "pp-sec-6", label: "6. Quảng cáo bên thứ ba" },
  { id: "pp-sec-7", label: "7. Thời gian lưu trữ thông tin" },
  { id: "pp-sec-8", label: "8. Cách chúng tôi giữ an toàn thông tin" },
  { id: "pp-sec-9", label: "9. Quyền riêng tư của bạn" },
  { id: "pp-sec-10", label: "10. Quyền cư dân California (CCPA)" },
  { id: "pp-sec-11", label: "11. Cập nhật thông báo" },
  { id: "pp-sec-12", label: "12. Liên hệ với chúng tôi" },
];

export default function PrivacyPolicyPage() {
  const handleScrollTo = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const yOffset = -120; // bù cho navbar sticky
    const target = window.pageYOffset + rect.top + yOffset;
    window.scrollTo({ top: target, behavior: "smooth" });
  };

  return (
    <div className="pf-wrap acc-page pp-page">
      {/* HEAD giống hình */}
      <header className="pp-head">
        <div className="pp-breadcrumb">Chính sách bảo mật</div>
        <div className="pp-updated">Cập nhật lần cuối: 24/11/2025</div>

        <div className="pp-title-wrapper">
          <h1 className="pp-main-title">CHÍNH SÁCH BẢO MẬT FITMATCH</h1>
        </div>
      </header>

      {/* BODY: sidebar + content, không có line chia */}
      <div className="pp-body">
        <aside className="pp-side">
          <nav className="pp-toc" aria-label="Mục lục Chính sách bảo mật">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="pp-toc-item"
                onClick={() => handleScrollTo(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="pp-content">
          <Policy />
        </section>
      </div>
    </div>
  );
}
