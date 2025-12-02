// user-app/src/pages/Account/TermsConditions/index.jsx
import React from "react";
import "../AccountSettings/AccountLayout.css"; // dùng lại pf-wrap, acc-page, biến width
import "./TermsConditions.css";
import TermsConditions from "./TermsConditions";

const SECTIONS = [
  { id: "td-sec-1", label: "1. Thỏa thuận về các điều khoản" },
  { id: "tcd-sec-2", label: "2. Quyền sở hữu trí tuệ" },
  { id: "tcd-sec-3", label: "3. Tuyên bố của người dùng" },
  { id: "tcd-sec-4", label: "4. Đăng ký người dùng" },
  { id: "tcd-sec-5", label: "5. Phí và thanh toán" },
  { id: "tcd-sec-6", label: "6. Thay đổi giá cả" },
  { id: "tcd-sec-7", label: "7. Hủy đăng ký & hoàn tiền" },
  { id: "tcd-sec-8", label: "8. Các hoạt động bị cấm" },
  { id: "tcd-sec-9", label: "9. Nội dung do người dùng tạo" },
  { id: "tcd-sec-10", label: "10. Giấy phép đóng góp" },
  { id: "tcd-sec-11", label: "11. Mạng xã hội" },
  { id: "tcd-sec-12", label: "12. Quản lý Trang web" },
  { id: "tcd-sec-13", label: "13. Chính sách bảo mật" },
  { id: "tcd-sec-14", label: "14. Vi phạm bản quyền" },
  { id: "tcd-sec-15", label: "15. Sửa đổi & gián đoạn" },
  { id: "tcd-sec-16", label: "16. Luật điều chỉnh" },
  { id: "tcd-sec-17", label: "17. Giải quyết tranh chấp" },
  { id: "tcd-sec-18", label: "18. Từ chối trách nhiệm" },
  { id: "tcd-sec-19", label: "19. Giới hạn trách nhiệm" },
  { id: "tcd-sec-20", label: "20. Bồi thường" },
  { id: "tcd-sec-21", label: "21. Liên hệ với chúng tôi" },
];

export default function TermsConditionsPage() {
  const handleScrollTo = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const yOffset = -120; // bù navbar sticky
    const target = window.pageYOffset + rect.top + yOffset;
    window.scrollTo({ top: target, behavior: "smooth" });
  };

  return (
    <div className="pf-wrap acc-page tcd-page">
      {/* HEAD giống PrivacyPolicy */}
      <header className="tcd-head">
        <div className="tcd-breadcrumb">Điều khoản dịch vụ</div>
        <div className="tcd-updated">Cập nhật lần cuối: 24/11/2025</div>

        <div className="tcd-title-wrapper">
          <h1 className="tcd-main-title">ĐIỀU KHOẢN DỊCH VỤ FITMATCH</h1>
        </div>
      </header>

      {/* BODY: sidebar + nội dung, không có line chia giống PP */}
      <div className="tcd-body">
        <aside className="tcd-side">
          <nav className="tcd-toc" aria-label="Mục lục Điều khoản dịch vụ">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className="tcd-toc-item"
                onClick={() => handleScrollTo(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="tcd-content">
          <TermsConditions />
        </section>
      </div>
    </div>
  );
}
