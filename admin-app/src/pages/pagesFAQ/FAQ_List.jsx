// admin-app/src/pages/pagesFAQ/FAQ_List.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

// Dùng chung style bảng từ Contact_List
import "../pagesContact/Contact_List.css";
import "./FAQ_List.css";

import {
  listFaqQuestionsAdmin,
  listFaqCategoriesAdmin,
  createFaqCategoryAdmin,
  updateFaqCategoryAdmin,
  deleteFaqCategoryAdmin,
  createFaqQuestionAdmin,
  updateFaqQuestionAdmin,
  deleteFaqQuestionAdmin,
} from "../../lib/api";

import FAQCategoryModal from "./FAQ_CategoryModal.jsx";
import FAQQuestionModal from "./FAQ_QuestionModal.jsx";

const STATUS_FILTERS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "active", label: "Hoạt động" },
  { value: "inactive", label: "Không hoạt động" },
];

// Format code #xxxxxx
const fmtCode = (id) => {
  if (!id) return "—";
  return `#${String(id).slice(-6)}`;
};

export default function FAQ_List() {
  const [activeTab, setActiveTab] = useState("questions"); // 'questions' | 'categories'

  // bộ lọc chung
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  // ===== Questions data =====
  const [questions, setQuestions] = useState([]);
  const [qTotal, setQTotal] = useState(0);
  const [qLimit, setQLimit] = useState(10);
  const [qSkip, setQSkip] = useState(0);
  const [loadingQ, setLoadingQ] = useState(false);

  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const qAllChecked =
    questions.length > 0 && selectedQuestionIds.length === questions.length;
  const qSomeChecked =
    selectedQuestionIds.length > 0 &&
    selectedQuestionIds.length < questions.length;

  // ===== Categories data =====
  const [categories, setCategories] = useState([]);
  const [cTotal, setCTotal] = useState(0);
  const [cLimit, setCLimit] = useState(10);
  const [cSkip, setCSkip] = useState(0);
  const [loadingC, setLoadingC] = useState(false);

  // ===== Modals =====
  const [categoryModal, setCategoryModal] = useState(null); // { initial } | null
  const [questionModal, setQuestionModal] = useState(null); // { initial } | null

  // ===== Confirm modal (xoá / toggle / cảnh báo) =====
  const [confirm, setConfirm] = useState(null);
  // confirm = {
  //   kind: 'deleteQuestion' | 'deleteCategory' | 'toggleQuestion' | 'toggleCategory' | 'info',
  //   item,
  //   nextActive,
  //   message,
  // }

  const [processingId, setProcessingId] = useState(null); // cho toggle / delete 1 item

  const qPage = Math.floor(qSkip / qLimit);
  const qPageCount = Math.max(1, Math.ceil((qTotal || 0) / qLimit));

  const cPage = Math.floor(cSkip / cLimit);
  const cPageCount = Math.max(1, Math.ceil((cTotal || 0) / cLimit));

  /* ==========================
   * LOAD QUESTIONS
   * ========================== */
  const loadQuestions = async () => {
    setLoadingQ(true);
    setSelectedQuestionIds([]);
    try {
      const params = { limit: qLimit, skip: qSkip };
      const qTrim = (q || "").trim();

      if (qTrim) params.q = qTrim;
      if (status) params.status = status; // "active" | "inactive"

      const res = await listFaqQuestionsAdmin(params);
      const arr = Array.isArray(res?.items) ? res.items : [];
      setQuestions(arr);
      setQTotal(typeof res?.total === "number" ? res.total : arr.length);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách câu hỏi FAQ");
      setQuestions([]);
      setQTotal(0);
    } finally {
      setLoadingQ(false);
    }
  };

  /* ==========================
   * LOAD CATEGORIES
   * ========================== */
  const loadCategories = async () => {
    setLoadingC(true);
    try {
      const params = { limit: cLimit, skip: cSkip };
      const qTrim = (q || "").trim();
      if (qTrim) params.q = qTrim;
      if (status) params.status = status;

      const res = await listFaqCategoriesAdmin(params);
      const arr = Array.isArray(res?.items) ? res.items : [];
      setCategories(arr);
      setCTotal(typeof res?.total === "number" ? res.total : arr.length);
    } catch (err) {
      console.error(err);
      toast.error("Không thể tải danh sách danh mục FAQ");
      setCategories([]);
      setCTotal(0);
    } finally {
      setLoadingC(false);
    }
  };

  // load theo tab
  useEffect(() => {
    if (activeTab === "questions") loadQuestions();
    else loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, qLimit, qSkip, cLimit, cSkip]);

  // debounce khi đổi search / status
  useEffect(() => {
    const t = setTimeout(() => {
      if (activeTab === "questions") {
        if (qSkip !== 0) setQSkip(0);
        else loadQuestions();
      } else {
        if (cSkip !== 0) setCSkip(0);
        else loadCategories();
      }
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, activeTab]);

  /* ==========================
   * SELECTION (questions)
   * ========================== */
  const toggleAllQuestions = () => {
    setSelectedQuestionIds(
      qAllChecked ? [] : questions.map((x) => x._id)
    );
  };
  const toggleOneQuestion = (id) =>
    setSelectedQuestionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  /* ==========================
   * QUESTIONS: delete
   * ========================== */
  const handleDeleteQuestion = (item) => {
    setConfirm({
      kind: "deleteQuestion",
      item,
      message: "Xóa câu hỏi này? Thao tác không thể hoàn tác.",
    });
  };

  const doDeleteQuestion = async (id) => {
    setProcessingId(id);
    try {
      await deleteFaqQuestionAdmin(id);

      // nếu đang ở trang cuối mà xoá hết -> lùi page
      if (questions.length === 1 && qSkip > 0) {
        setQSkip(Math.max(0, qSkip - qLimit));
      } else {
        setQuestions((prev) => prev.filter((x) => x._id !== id));
        setQTotal((t) => Math.max(0, (t || 0) - 1));
      }
      toast.success("Đã xoá câu hỏi FAQ");
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message || "Xoá câu hỏi FAQ thất bại";
      toast.error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  /* ==========================
   * CATEGORIES: delete
   * (backend sẽ chặn nếu vẫn còn câu hỏi)
   * ========================== */
  const handleDeleteCategory = (item) => {
    setConfirm({
      kind: "deleteCategory",
      item,
      message:
        "Xóa danh mục này? Nếu danh mục còn câu hỏi, hệ thống sẽ không cho phép xoá.",
    });
  };

  const doDeleteCategory = async (id) => {
    setProcessingId(id);
    try {
      await deleteFaqCategoryAdmin(id);
      if (categories.length === 1 && cSkip > 0) {
        setCSkip(Math.max(0, cSkip - cLimit));
      } else {
        setCategories((prev) => prev.filter((x) => x._id !== id));
        setCTotal((t) => Math.max(0, (t || 0) - 1));
      }
      toast.success("Đã xoá danh mục FAQ");
      // reload questions để cập nhật filter
      loadQuestions();
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message ||
        "Không thể xoá danh mục. Có thể danh mục vẫn còn câu hỏi.";
      toast.error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  /* ==========================
   * TOGGLE STATUS QUESTION
   * ========================== */
  const handleToggleQuestion = (item) => {
    const next = !item.isActive;
    // nếu muốn bật mà danh mục đang tắt -> chặn + hiển thị popup info
    if (next && item.categoryStatus === "inactive") {
      setConfirm({
        kind: "info",
        message:
          "Không thể bật hoạt động cho câu hỏi này vì danh mục đang TẮT hoạt động. Vui lòng bật lại danh mục trước.",
      });
      return;
    }
    setConfirm({
      kind: "toggleQuestion",
      item,
      nextActive: next,
      message: next
        ? "Bật hoạt động câu hỏi này? Câu hỏi sẽ hiển thị trên giao diện người dùng."
        : "Tắt hoạt động câu hỏi này? Câu hỏi sẽ KHÔNG còn hiển thị trên giao diện người dùng.",
    });
  };

  const doToggleQuestion = async (item, nextActive) => {
    setProcessingId(item._id);
    try {
      await updateFaqQuestionAdmin(item._id, { isActive: nextActive });

      setQuestions((prev) =>
        prev.map((q) =>
          q._id === item._id ? { ...q, isActive: nextActive } : q
        )
      );

      toast.success("Cập nhật trạng thái câu hỏi thành công");
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message ||
        "Không thể cập nhật trạng thái câu hỏi";
      toast.error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  /* ==========================
   * TOGGLE STATUS CATEGORY
   * backend xử lý cascade question
   * ========================== */
  const handleToggleCategory = (item) => {
    const next = !item.isActive;
    setConfirm({
      kind: "toggleCategory",
      item,
      nextActive: next,
      message: next
        ? "Bật hoạt động danh mục này? TẤT CẢ câu hỏi thuộc danh mục sẽ được bật theo."
        : "Tắt hoạt động danh mục này? TẤT CẢ câu hỏi thuộc danh mục sẽ bị tắt hoạt động và không hiển thị cho người dùng.",
    });
  };

  const doToggleCategory = async (item, nextActive) => {
    setProcessingId(item._id);
    try {
      await updateFaqCategoryAdmin(item._id, { isActive: nextActive });

      await Promise.all([loadCategories(), loadQuestions()]);
      toast.success("Cập nhật trạng thái danh mục thành công");
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message ||
        "Không thể cập nhật trạng thái danh mục";
      toast.error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  /* ==========================
   * CATEGORY MODAL submit
   * ========================== */
  const handleSubmitCategory = async (form, id) => {
    // form: { name, description }
    try {
      if (id) {
        await updateFaqCategoryAdmin(id, form);
        toast.success("Cập nhật danh mục FAQ thành công");
      } else {
        await createFaqCategoryAdmin(form);
        toast.success("Tạo danh mục FAQ thành công");
      }
      await loadCategories();
      return true;
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message || "Lưu danh mục FAQ thất bại";
      toast.error(msg);
      throw err;
    }
  };

  /* ==========================
   * QUESTION MODAL submit
   * ========================== */
  const handleSubmitQuestion = async (form, id) => {
    // form: { title, answerHtml, categoryId, isActive }
    try {
      if (id) {
        await updateFaqQuestionAdmin(id, form);
        toast.success("Cập nhật câu hỏi FAQ thành công");
      } else {
        await createFaqQuestionAdmin(form);
        toast.success("Tạo câu hỏi FAQ thành công");
      }
      await loadQuestions();
      return true;
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message || "Lưu câu hỏi FAQ thất bại";
      toast.error(msg);
      throw err;
    }
  };

  /* ==========================
   * CSV export cho câu hỏi (optional)
   * ========================== */
  const csvQuestions = useMemo(() => {
    const head = [
      "code",
      "question",
      "categoryName",
      "isActive",
      "createdAt",
    ].join(",");
    const rows = questions.map((x) =>
      [
        fmtCode(x._id),
        x.title,
        x.categoryName,
        x.isActive ? "active" : "inactive",
        x.createdAt || "",
      ]
        .map((v) => (v ?? "").toString().replace(/"/g, '""'))
        .map((v) => `"${v}"`)
        .join(",")
    );
    return [head, ...rows].join("\n");
  }, [questions]);

  const downloadCSVQuestions = () => {
    const blob = new Blob([csvQuestions], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "faq_questions.csv";
    a.click();
  };

  /* ==========================
   * RENDER
   * ========================== */
  return (
    <div className="ct-page-admin">
      {/* breadcrumb */}
      <nav className="ct-breadcrumb" aria-label="breadcrumb">
        <Link to="/">
          <i className="fa-solid fa-house" /> <span>Trang chủ</span>
        </Link>
        <span className="sep">/</span>
        <span className="grp">
          <i className="fa-regular fa-circle-question" />{" "}
          <span>Cấu hình FAQ</span>
        </span>
        <span className="sep">/</span>
        <span className="cur">Các câu hỏi thường gặp</span>
      </nav>

      <div className="ct-card">
        {/* Head */}
        <div className="ct-head">
          <h2>
            Quản lý FAQ (
            {activeTab === "questions" ? qTotal : cTotal}
            )
          </h2>
          <div className="ct-actions">
            <button
              className="btn primary"
              type="button"
              onClick={() =>
                setCategoryModal({ initial: null })
              }
            >
              <span>Tạo danh mục</span>
            </button>
            <button
              className="btn primary"
              type="button"
              onClick={() =>
                setQuestionModal({ initial: null })
              }
            >
              <span>Tạo câu hỏi</span>
            </button>

            {activeTab === "questions" && questions.length > 0 && (
              <button
                className="btn ghost"
                type="button"
                onClick={downloadCSVQuestions}
              >
                <i className="fa-solid fa-file-export" />{" "}
                <span>Xuất danh sách</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="ct-filters">
          <div className="ct-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                activeTab === "questions"
                  ? "Tìm theo câu hỏi, danh mục, trạng thái..."
                  : "Tìm theo mã, tên danh mục, mô tả..."
              }
            />
          </div>
          <div className="ct-filter-row">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {STATUS_FILTERS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="faq-tabs">
          <button
            type="button"
            className={
              "faq-tab" +
              (activeTab === "questions" ? " active" : "")
            }
            onClick={() => setActiveTab("questions")}
          >
            Câu hỏi
          </button>
          <button
            type="button"
            className={
              "faq-tab" +
              (activeTab === "categories" ? " active" : "")
            }
            onClick={() => setActiveTab("categories")}
          >
            Danh mục
          </button>
        </div>

        {/* Tables */}
        {activeTab === "questions" ? (
          <>
            <div className="ct-table">
              <div className="ct-thead faq-q-head">
                <label className="cell cb">
                  <input
                    type="checkbox"
                    checked={qAllChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = qSomeChecked;
                    }}
                    onChange={toggleAllQuestions}
                  />
                </label>
                <div className="cell name">Câu hỏi</div>
                <div className="cell email">Danh mục</div>
                <div className="cell status">Trạng thái</div>
                <div className="cell act">Thao tác</div>
              </div>

              {loadingQ && (
                <div className="ct-empty">Đang tải...</div>
              )}
              {!loadingQ && questions.length === 0 && (
                <div className="ct-empty">
                  Chưa có câu hỏi FAQ nào.
                </div>
              )}

              {!loadingQ &&
                questions.map((it) => (
                  <div
                    key={it._id}
                    className="ct-trow faq-q-row"
                  >
                    <label className="cell cb">
                      <input
                        type="checkbox"
                        checked={selectedQuestionIds.includes(
                          it._id
                        )}
                        onChange={() =>
                          toggleOneQuestion(it._id)
                        }
                      />
                    </label>

                    <div className="cell name">
                      <div className="ct-name-main">
                        {it.title || "—"}
                      </div>
                      <div className="faq-q-code">
                        {fmtCode(it._id)}
                      </div>
                    </div>

                    <div className="cell email">
                      {it.categoryName || "—"}
                      {it.categoryStatus === "inactive" && (
                        <span className="faq-chip-off">
                          Danh mục đang tắt
                        </span>
                      )}
                    </div>

                    <div className="cell status">
                      <button
                        type="button"
                        className={
                          "faq-toggle" +
                          (it.isActive ? " on" : " off")
                        }
                        disabled={processingId === it._id}
                        onClick={() => handleToggleQuestion(it)}
                      >
                        <span className="knob" />
                        <span className="label">
                          {it.isActive
                            ? "Hoạt động"
                            : "Không hoạt động"}
                        </span>
                      </button>
                    </div>

                    <div className="cell act">
                      <button
                        className="iconbtn"
                        title="Chỉnh sửa"
                        onClick={() =>
                          setQuestionModal({ initial: it })
                        }
                      >
                        <i className="fa-regular fa-pen-to-square" />
                      </button>
                      <button
                        className="iconbtn danger"
                        title="Xóa"
                        disabled={processingId === it._id}
                        onClick={() => handleDeleteQuestion(it)}
                      >
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* Pagination for questions */}
            <div className="ct-pagination">
              <div className="per-page">
                <span>Hiển thị:</span>
                <select
                  value={qLimit}
                  onChange={(e) => {
                    setQLimit(Number(e.target.value));
                    setQSkip(0);
                  }}
                >
                  <option value="10">10 hàng</option>
                  <option value="25">25 hàng</option>
                  <option value="50">50 hàng</option>
                </select>
              </div>
              <div className="page-nav">
                <span className="page-info">
                  Trang {qPage + 1} /{" "}
                  {Math.max(qPageCount, 1)} (Tổng: {qTotal})
                </span>
                <button
                  className="btn-page"
                  onClick={() =>
                    setQSkip(Math.max(0, qSkip - qLimit))
                  }
                  disabled={qSkip === 0}
                >
                  <i className="fa-solid fa-chevron-left" />
                </button>
                <button
                  className="btn-page"
                  onClick={() =>
                    setQSkip(
                      qSkip + qLimit >= qTotal
                        ? qSkip
                        : qSkip + qLimit
                    )
                  }
                  disabled={qSkip + qLimit >= qTotal}
                >
                  <i className="fa-solid fa-chevron-right" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="ct-table">
              <div className="ct-thead faq-c-head">
                <div className="cell code">Mã danh mục</div>
                <div className="cell name">Danh mục</div>
                <div className="cell subject">Mô tả</div>
                <div className="cell status">Trạng thái</div>
                <div className="cell act">Thao tác</div>
              </div>

              {loadingC && (
                <div className="ct-empty">Đang tải...</div>
              )}
              {!loadingC && categories.length === 0 && (
                <div className="ct-empty">
                  Chưa có danh mục FAQ nào.
                </div>
              )}

              {!loadingC &&
                categories.map((cat) => (
                  <div
                    key={cat._id}
                    className="ct-trow faq-c-row"
                  >
                    <div className="cell code">
                      {fmtCode(cat._id)}
                    </div>
                    <div className="cell name">
                      <div className="ct-name-main">
                        {cat.name || "—"}
                      </div>
                    </div>
                    <div
                      className="cell subject"
                      title={cat.description}
                    >
                      {cat.description || "—"}
                    </div>
                    <div className="cell status">
                      <button
                        type="button"
                        className={
                          "faq-toggle" +
                          (cat.isActive ? " on" : " off")
                        }
                        disabled={processingId === cat._id}
                        onClick={() =>
                          handleToggleCategory(cat)
                        }
                      >
                        <span className="knob" />
                        <span className="label">
                          {cat.isActive
                            ? "Hoạt động"
                            : "Không hoạt động"}
                        </span>
                      </button>
                    </div>
                    <div className="cell act">
                      <button
                        className="iconbtn"
                        title="Chỉnh sửa"
                        onClick={() =>
                          setCategoryModal({ initial: cat })
                        }
                      >
                        <i className="fa-regular fa-pen-to-square" />
                      </button>
                      <button
                        className="iconbtn danger"
                        title="Xóa"
                        disabled={processingId === cat._id}
                        onClick={() =>
                          handleDeleteCategory(cat)
                        }
                      >
                        <i className="fa-solid fa-trash-can" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* Pagination for categories */}
            <div className="ct-pagination">
              <div className="per-page">
                <span>Hiển thị:</span>
                <select
                  value={cLimit}
                  onChange={(e) => {
                    setCLimit(Number(e.target.value));
                    setCSkip(0);
                  }}
                >
                  <option value="10">10 hàng</option>
                  <option value="25">25 hàng</option>
                  <option value="50">50 hàng</option>
                </select>
              </div>
              <div className="page-nav">
                <span className="page-info">
                  Trang {cPage + 1} /{" "}
                  {Math.max(cPageCount, 1)} (Tổng: {cTotal})
                </span>
                <button
                  className="btn-page"
                  onClick={() =>
                    setCSkip(Math.max(0, cSkip - cLimit))
                  }
                  disabled={cSkip === 0}
                >
                  <i className="fa-solid fa-chevron-left" />
                </button>
                <button
                  className="btn-page"
                  onClick={() =>
                    setCSkip(
                      cSkip + cLimit >= cTotal
                        ? cSkip
                        : cSkip + cLimit
                    )
                  }
                  disabled={cSkip + cLimit >= cTotal}
                >
                  <i className="fa-solid fa-chevron-right" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Confirm modal */}
      {confirm && (
        <div
          className="cm-backdrop"
          onClick={() => setConfirm(null)}
        >
          <div
            className="cm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cm-head">
              <h1 className="cm-title">
                {confirm.kind === "deleteQuestion"
                  ? "Xóa câu hỏi FAQ?"
                  : confirm.kind === "deleteCategory"
                  ? "Xóa danh mục FAQ?"
                  : confirm.kind === "toggleQuestion"
                  ? "Thay đổi trạng thái câu hỏi"
                  : confirm.kind === "toggleCategory"
                  ? "Thay đổi trạng thái danh mục"
                  : "Thông báo"}
              </h1>
            </div>
            <div className="cm-body">{confirm.message}</div>
            <div className="cm-foot">
              <button
                className="btn ghost"
                onClick={() => setConfirm(null)}
              >
                Đóng
              </button>
              {confirm.kind !== "info" && (
                <button
                  className="btn primary"
                  disabled={
                    processingId === confirm?.item?._id
                  }
                  onClick={async () => {
                    const { kind, item, nextActive } = confirm;
                    if (kind === "deleteQuestion") {
                      await doDeleteQuestion(item._id);
                    } else if (kind === "deleteCategory") {
                      await doDeleteCategory(item._id);
                    } else if (kind === "toggleQuestion") {
                      await doToggleQuestion(item, nextActive);
                    } else if (kind === "toggleCategory") {
                      await doToggleCategory(item, nextActive);
                    }
                    setConfirm(null);
                  }}
                >
                  Xác nhận
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {categoryModal && (
        <FAQCategoryModal
          initial={categoryModal.initial}
          onClose={() => setCategoryModal(null)}
          onSubmit={handleSubmitCategory}
        />
      )}

      {questionModal && (
        <FAQQuestionModal
          initial={questionModal.initial}
          categories={categories}
          onClose={() => setQuestionModal(null)}
          onSubmit={handleSubmitQuestion}
        />
      )}
    </div>
  );
}
