// admin-app/src/pages/pagesFAQ/FAQ_CategoryModal.jsx
import React, { useEffect, useState } from "react";
import "./FAQ_List.css";

export default function FAQCategoryModal({ initial, onClose, onSubmit }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(
    initial?.description || ""
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(initial?.name || "");
    setDescription(initial?.description || "");
    setErrors({});
  }, [initial?._id]);

  const validate = () => {
    const errs = {};
    const n = String(name || "").trim();
    const d = String(description || "").trim();

    if (!n) errs.name = "Vui lòng nhập tên danh mục";
    else if (n.length > 100)
      errs.name = "Tên danh mục tối đa 100 ký tự";

    if (d && d.length > 500)
      errs.description = "Mô tả tối đa 500 ký tự";

    setErrors(errs);
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) return;

    const payload = {
      name: String(name).trim(),
      description: String(description).trim() || undefined,
    };

    setSaving(true);
    try {
      await onSubmit(payload, initial?._id || null);
      onClose();        // ✅ tạo xong -> đóng modal
    } catch {
      // onSubmit đã toast lỗi
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="cm-backdrop" onClick={onClose}>
      <div
        className="faq-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="faq-modal-header">
          <span className="faq-modal-title">
            {isEdit
              ? "Chỉnh sửa Danh mục FAQ"
              : "Tạo Danh mục FAQ Mới"}
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
          <div className="faq-field">
            <label className="faq-label">
              Tên danh mục *
            </label>
            <input
              className={
                "faq-input" + (errors.name ? " has-error" : "")
              }
              placeholder="Nhập tên danh mục"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            {errors.name && (
              <div className="faq-error">{errors.name}</div>
            )}
          </div>

          <div className="faq-field">
            <label className="faq-label">Mô tả</label>
            <textarea
              className={
                "faq-textarea" +
                (errors.description ? " has-error" : "")
              }
              placeholder="Mô tả ngắn về danh mục..."
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {errors.description && (
              <div className="faq-error">
                {errors.description}
              </div>
            )}
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
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
