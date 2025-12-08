// user-app/src/pages/Account/FAQ/FAQ.jsx
import React, { useEffect, useState, useMemo } from "react";
import "../AccountSettings/AccountLayout.css"; // giữ cùng width / layout
import "../PrivacyPolicy/Policy.css"; // tái sử dụng font, màu chữ
import "./FAQ.css";
import { getFaqPublic } from "../../../api/faq";

export default function FAQPage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCatId, setActiveCatId] = useState(null);
  const [openIds, setOpenIds] = useState(() => new Set());

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = await getFaqPublic();
        setGroups(data || []);
        if (data && data.length) {
          setActiveCatId(String(data[0].categoryId));
        }
      } catch (e) {
        console.error(e);
        setError("Không thể tải danh sách câu hỏi thường gặp. Vui lòng thử lại sau.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const categories = useMemo(
    () =>
      (groups || []).map((g) => ({
        id: String(g.categoryId),
        name: g.categoryName,
      })),
    [groups]
  );

  const toggleQuestion = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleScrollToCategory = (catId) => {
    setActiveCatId(String(catId));
    const el = document.getElementById(`faq-sec-${catId}`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const yOffset = -120; // bù navbar sticky
    const top = window.pageYOffset + rect.top + yOffset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div className="pf-wrap acc-page faq-page">
      {/* Header giống style PrivacyPolicy, nhưng đơn giản hơn */}
      <header className="faq-head">
        <div className="faq-title-wrapper">
          <h1 className="faq-main-title">CÁC CÂU HỎI THƯỜNG GẶP</h1>
        </div>
      </header>

      <div className="faq-body">
        {/* Cột trái: Danh mục */}
        <aside className="faq-side">
          {loading && (
            <div className="faq-loading">Đang tải danh mục...</div>
          )}
          {error && !loading && (
            <div className="faq-error-text">{error}</div>
          )}
          {!loading && !error && (
            <nav
              className="faq-cat-list"
              aria-label="Danh mục câu hỏi thường gặp"
            >
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={
                    "faq-cat-item" +
                    (String(activeCatId) === String(cat.id) ? " active" : "")
                  }
                  onClick={() => handleScrollToCategory(cat.id)}
                >
                  <div className="faq-cat-label">{cat.name}</div>
                </button>
              ))}

              {categories.length === 0 && (
                <div className="faq-empty">
                  Hiện chưa có danh mục FAQ nào.
                </div>
              )}
            </nav>
          )}
        </aside>

        {/* Cột phải: Các câu hỏi theo từng danh mục */}
        <section className="faq-content">
          {loading && (
            <div className="faq-loading">Đang tải câu hỏi...</div>
          )}
          {error && !loading && (
            <div className="faq-error-text">{error}</div>
          )}

          {!loading && !error && groups.length === 0 && (
            <div className="faq-empty">
              Chưa có câu hỏi thường gặp nào được cấu hình.
            </div>
          )}

          {!loading &&
            !error &&
            groups.map((group) => {
              const hasQuestions =
                Array.isArray(group.questions) &&
                group.questions.length > 0;
              if (!hasQuestions) return null;

              const secId = `faq-sec-${group.categoryId}`;

              return (
                <section key={secId} id={secId} className="faq-section">
                  <h2 className="faq-section-title">
                    {group.categoryName}
                  </h2>

                  <div className="faq-questions">
                    {group.questions.map((q) => {
                      const qKey = String(q._id);
                      const isOpen = openIds.has(qKey);
                      return (
                        <article
                          key={qKey}
                          className={
                            "faq-q-item" + (isOpen ? " open" : "")
                          }
                        >
                          <button
                            type="button"
                            className="faq-q-header"
                            onClick={() => toggleQuestion(qKey)}
                          >
                            <span className="faq-q-question">
                              {q.title}
                            </span>
                            <span className="faq-q-icon">
                              {isOpen ? "−" : "+"}
                            </span>
                          </button>

                          {isOpen && (
                            <div
                              className="faq-q-answer"
                              // BE đã validate HTML từ admin, nên dùng innerHTML
                              dangerouslySetInnerHTML={{
                                __html: q.answerHtml,
                              }}
                            />
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
        </section>
      </div>
    </div>
  );
}
