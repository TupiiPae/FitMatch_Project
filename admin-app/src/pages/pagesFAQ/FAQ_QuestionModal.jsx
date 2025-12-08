// admin-app/src/pages/pagesFAQ/FAQ_QuestionModal.jsx
import React, { useEffect, useState } from "react";
import "./FAQ_List.css";
import RichTextEditorTiptap from "../../components/Editor/RichTextEditorTiptap";

export default function FAQQuestionModal({
  initial,
  categories,
  onClose,
  onSubmit,
}) {
  const isEdit = !!initial;

  const [title, setTitle] = useState(initial?.title || "");
  const [answerHtml, setAnswerHtml] = useState(
    initial?.answerHtml || ""
  );
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId || initial?.category?._id || ""
  );
  const [isActive, setIsActive] = useState(
    initial?.isActive ?? true
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(initial?.title || "");
    setAnswerHtml(initial?.answerHtml || "");
    setCategoryId(
      initial?.categoryId || initial?.category?._id || ""
    );
    setIsActive(initial?.isActive ?? true);
    setErrors({});
  }, [initial?._id]);

  const validate = () => {
    const errs = {};
    const t = String(title || "").trim();
    const html = String(answerHtml || "").trim();
    const plain = html
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!t) errs.title = "Vui lòng nhập tiêu đề câu hỏi";
    else if (t.length > 300)
      errs.title = "Tiêu đề tối đa 300 ký tự";

    if (!html || !plain || plain === "\n")
      errs.answerHtml = "Vui lòng nhập nội dung câu trả lời";

    if (!categoryId)
      errs.categoryId = "Vui lòng chọn danh mục";

    setErrors(errs);
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) return;

    const payload = {
      title: String(title).trim(),
      answerHtml: String(answerHtml).trim(),
      categoryId,
      isActive,
    };

    setSaving(true);
    try {
      await onSubmit(payload, initial?._id || null);
      onClose(); // ✅ Lưu xong thì đóng modal
    } catch {
      // onSubmit đã toast lỗi
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cm-backdrop" onClick={onClose}>
      <div
        className="faq-modal faq-modal-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="faq-modal-header">
          <span className="faq-modal-title">
            {isEdit
              ? "Chỉnh sửa Câu hỏi FAQ"
              : "Tạo Câu Hỏi FAQ Mới"}
          </span>
          <button
            type="button"
            className="faq-modal-close"
            onClick={onClose}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="faq-modal-body">
          {/* Tiêu đề */}
          <div className="faq-field">
            <label className="faq-label">
              Tiêu đề câu hỏi *
            </label>
            <input
              className={
                "faq-input" + (errors.title ? " has-error" : "")
              }
              placeholder="Nhập tiêu đề câu hỏi ở đây..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            {errors.title && (
              <div className="faq-error">{errors.title}</div>
            )}
          </div>

          {/* Nội dung trả lời */}
          <div className="faq-field">
            <label className="faq-label">
              Nội dung câu trả lời *
            </label>
            <div
              className={
                "faq-editor-wrap" +
                (errors.answerHtml ? " has-error" : "")
              }
            >
              <RichTextEditorTiptap
                valueHtml={answerHtml}
                onChangeHtml={setAnswerHtml}
                minHeight={220}
              />
            </div>
            {errors.answerHtml && (
              <div className="faq-error">
                {errors.answerHtml}
              </div>
            )}
          </div>

          {/* Danh mục + Trạng thái */}
          <div className="faq-field faq-row">
            <div className="faq-col">
              <label className="faq-label">Danh mục *</label>
              <select
                className={
                  "faq-select" +
                  (errors.categoryId ? " has-error" : "")
                }
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                <option value="">Chọn một danh mục</option>
                {Array.isArray(categories) &&
                  categories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              {errors.categoryId && (
                <div className="faq-error">
                  {errors.categoryId}
                </div>
              )}
            </div>

            <div className="faq-col faq-col-toggle">
              <label className="faq-label">Trạng thái</label>
              <button
                type="button"
                className={
                  "faq-toggle" + (isActive ? " on" : " off")
                }
                onClick={() => setIsActive((v) => !v)}
              >
                <span className="knob" />
                <span className="label">
                  {isActive ? "Hoạt động" : "Không hoạt động"}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="faq-modal-footer">
          <button
            type="button"
            className="faq-btn ghost"
            onClick={onClose}
            disabled={saving}
          >
            Hủy
          </button>
          <button
            type="button"
            className="faq-btn primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? "Đang lưu..."
              : isEdit
              ? "Lưu & Cập nhật"
              : "Lưu & Xuất bản"}
          </button>
        </div>
      </div>
    </div>
  );
}
