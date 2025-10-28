// src/pages/pagesFoods/Food_Create/Food_Create.jsx
import React, { useRef, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createFood, createFoodFile } from "../../../lib/api.js";
import "./Food_Create.css";

// Trạng thái form ban đầu
const initialState = {
  name: "",
  servingDesc: "",
  massG: 100,
  unit: "g", // Giữ nguyên 'g' để <select> hoạt động
  imageUrl: "",
  kcal: "",
  proteinG: "",
  carbG: "",
  fatG: "",
  saltG: "",
  sugarG: "",
  fiberG: "",
  description: "", // Cho Rich Text Editor
};

export default function FoodCreate() {
  const nav = useNavigate();
  const [form, setForm] = useState(initialState);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState(null);

  // Ảnh file upload
  const [file, setFile] = useState(null);
  const fileInputRef = useRef(null);

  const onChange = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const toNum = (v) => {
    const s = String(v ?? "").trim();
    if (s === "") return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };
  const toNumOrNull = (v) => {
    const s = String(v ?? "").trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  // cleanup preview blob khi unmount/đổi file
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // Chọn file & xem trước
  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    // nếu nhập file → bỏ URL để tránh gửi cả đôi
    if (form.imageUrl) onChange("imageUrl", "");
  };

  const openFileDialog = () => fileInputRef.current?.click();

  const handleImagePreview = () => {
    // Chỉ set preview từ URL khi KHÔNG có file
    if (!file) setPreview(form.imageUrl || null);
  };

  // Validate cơ bản theo BE: name, massG>0, unit hợp lệ, kcal>=0 (bắt buộc)
  const validate = () => {
    const name = String(form.name || "").trim();
    if (!name) return "Vui lòng nhập tên món.";
    const massG = toNum(form.massG);
    if (massG === undefined || massG <= 0) return "Khối lượng phải lớn hơn 0.";
    const unit = form.unit === "ml" ? "ml" : "g";
    if (!["g", "ml"].includes(unit)) return "Đơn vị không hợp lệ.";
    const kcal = toNum(form.kcal);
    if (kcal === undefined || kcal < 0) return "Vui lòng nhập Calo (kcal) ≥ 0.";
    return "";
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    // validate trước khi gửi
    const v = validate();
    if (v) { setMsg(v); return; }

    const payload = {
      name: String(form.name || "").trim(),
      portionName: String(form.servingDesc || "").trim() || undefined, // map đúng BE
      massG: toNum(form.massG),
      unit: form.unit === "ml" ? "ml" : "g",
      // imageUrl chỉ gửi khi KHÔNG có file
      imageUrl: file ? undefined : (String(form.imageUrl || "").trim() || undefined),
      kcal: toNumOrNull(form.kcal),          // BE yêu cầu ≥0 (đã validate)
      proteinG: toNumOrNull(form.proteinG),  // optional
      carbG: toNumOrNull(form.carbG),        // optional
      fatG: toNumOrNull(form.fatG),          // optional
      saltG: toNumOrNull(form.saltG),        // optional
      sugarG: toNumOrNull(form.sugarG),      // optional
      fiberG: toNumOrNull(form.fiberG),      // optional
      description: String(form.description || "").trim() || undefined,
      sourceType: "admin_created",
    };

    try {
      if (file) {
        // Multipart upload (field 'image')
        const fd = new FormData();
        fd.append("image", file);
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== null && v !== undefined) fd.append(k, String(v));
        });
        await createFoodFile(fd);
      } else {
        // JSON body
        await createFood(payload);
      }

      setMsg("Tạo món ăn thành công!");
      setForm(initialState);
      if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
      setPreview(null);
      setFile(null);
      // Giữ nguyên ở trang để tạo tiếp; nếu muốn quay lại:
      // nav(-1);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        (err?.response?.status === 422 ? "Dữ liệu không hợp lệ." : "Đã xảy ra lỗi. Vui lòng thử lại.");
      setMsg(message);
      console.error(err);
    }
  };

  return (
    <div className="food-create-page">
      {/* ===== Breadcrumb ===== */}
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/">
          <i className="fa-solid fa-house" aria-hidden="true"></i>
          <span>Trang chủ</span>
        </Link>
        <span className="separator">/</span>
        <span className="current-group">
          <i className="fa-solid fa-utensils" aria-hidden="true"></i>
          <span>Quản lý Món ăn</span>
        </span>
        <span className="separator">/</span>
        <span className="current-page">Tạo món ăn mới</span>
      </nav>

      {/* ===== Card Layout ===== */}
      <div className="card">
        {/* ===== Page Head ===== */}
        <div className="page-head">
          <h2>Tạo món ăn mới</h2>
          <div className="head-actions">
            <button className="btn ghost" type="button" onClick={() => nav(-1)}>
              <span>Hủy</span>
            </button>
            <button
              className="btn primary"
              type="submit"
              form="create-food-form"
            >
              <span>Lưu & Tạo mới</span>
            </button>
          </div>
        </div>

        {/* ===== Form Layout Mới ===== */}
        <form
          id="create-food-form"
          className="fc-form-layout"
          onSubmit={onSubmit}
        >
          {/* --- CỘT TRÁI: HÌNH ẢNH --- */}
          <div className="fc-image-col">
            <h3 className="fc-section-title">Hình ảnh món ăn</h3>

            {/* Khung ảnh: nhấp để chọn file */}
            <div
              className="fc-image-box"
              role="button"
              tabIndex={0}
              onClick={openFileDialog}
              onKeyDown={(e) => { if (e.key === "Enter") openFileDialog(); }}
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Xem trước"
                  onError={() => setPreview(null)}
                />
              ) : form.imageUrl ? (
                <img
                  src={form.imageUrl}
                  alt="Xem trước"
                  onError={() => setPreview(null)}
                />
              ) : (
                <div className="placeholder">
                  <span>Xem trước hình ảnh (nhấp để chọn)</span>
                </div>
              )}
            </div>

            {/* Input file ẩn */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={onPickFile}
            />

            {/* Trường Input Float Label (ảnh qua URL) */}
            <div className="fc-field">
              <input
                type="url"
                id="food-image-url"
                placeholder=" " // Quan trọng: phải có 1 dấu cách
                value={form.imageUrl}
                onChange={(e) => {
                  // nếu nhập URL → bỏ file đã chọn (tránh gửi cả đôi)
                  if (file) setFile(null);
                  onChange("imageUrl", e.target.value);
                }}
                onBlur={handleImagePreview}
              />
              <label htmlFor="food-image-url">Link hình ảnh (URL)</label>
            </div>
          </div>

          {/* --- CỘT PHẢI: THÔNG TIN --- */}
          <div className="fc-fields-col">
            {/* Nhóm thông tin chung */}
            <h3 className="fc-section-title">Thông tin chung</h3>

            <div className="fc-fields-grid-2">
              <div className="fc-field fc-grid-span-2">
                <input
                  id="food-name"
                  value={form.name}
                  onChange={(e) => onChange("name", e.target.value)}
                  required
                  placeholder=" "
                />
                <label htmlFor="food-name">Tên món ăn (bắt buộc)</label>
              </div>

              <div className="fc-field fc-grid-span-2">
                <input
                  id="food-serving"
                  value={form.servingDesc}
                  onChange={(e) => onChange("servingDesc", e.target.value)}
                  placeholder=" "
                />
                <label htmlFor="food-serving">Mô tả khẩu phần (ví dụ: 1 đĩa)</label>
              </div>

              <div className="fc-field">
                <input
                  type="number"
                  id="food-mass"
                  value={form.massG}
                  onChange={(e) => onChange("massG", e.target.value)}
                  required
                  placeholder=" "
                  min="1"
                />
                <label htmlFor="food-mass">Khối lượng (bắt buộc)</label>
              </div>

              {/* Select được style riêng (label luôn nổi) */}
              <div className="fc-field fc-field-select">
                <select
                  id="food-unit"
                  value={form.unit}
                  onChange={(e) => onChange("unit", e.target.value)}
                >
                  <option value="g">g (gram)</option>
                  <option value="ml">ml (millilit)</option>
                </select>
              </div>
            </div>

            {/* Đường kẻ ngang */}
            <hr className="fc-divider" />

            {/* Nhóm thông tin dinh dưỡng */}
            <h3 className="fc-section-title">Thông tin dinh dưỡng</h3>

            {/* Calo 1 hàng */}
            <div className="fc-field">
              <input
                type="number"
                step="0.1"
                id="food-kcal"
                value={form.kcal}
                onChange={(e) => onChange("kcal", e.target.value)}
                placeholder=" "
                min="0"
                required
              />
              <label htmlFor="food-kcal">Calo (kcal)</label>
            </div>

            {/* 3 trường 1 hàng */}
            <div className="fc-fields-grid-3">
              <div className="fc-field">
                <input
                  type="number"
                  step="0.1"
                  id="food-p"
                  value={form.proteinG}
                  onChange={(e) => onChange("proteinG", e.target.value)}
                  placeholder=" "
                  min="0"
                />
                <label htmlFor="food-p">Đạm (g)</label>
              </div>
              <div className="fc-field">
                <input
                  type="number"
                  step="0.1"
                  id="food-c"
                  value={form.carbG}
                  onChange={(e) => onChange("carbG", e.target.value)}
                  placeholder=" "
                  min="0"
                />
                <label htmlFor="food-c">Carb (g)</label>
              </div>
              <div className="fc-field">
                <input
                  type="number"
                  step="0.1"
                  id="food-f"
                  value={form.fatG}
                  onChange={(e) => onChange("fatG", e.target.value)}
                  placeholder=" "
                  min="0"
                />
                <label htmlFor="food-f">Chất béo (g)</label>
              </div>
            </div>

            {/* 3 trường 1 hàng */}
            <div className="fc-fields-grid-3">
              <div className="fc-field">
                <input
                  type="number"
                  step="0.1"
                  id="food-salt"
                  value={form.saltG}
                  onChange={(e) => onChange("saltG", e.target.value)}
                  placeholder=" "
                  min="0"
                />
                <label htmlFor="food-salt">Muối (g)</label>
              </div>
              <div className="fc-field">
                <input
                  type="number"
                  step="0.1"
                  id="food-sugar"
                  value={form.sugarG}
                  onChange={(e) => onChange("sugarG", e.target.value)}
                  placeholder=" "
                  min="0"
                />
                <label htmlFor="food-sugar">Đường (g)</label>
              </div>
              <div className="fc-field">
                <input
                  type="number"
                  step="0.1"
                  id="food-fiber"
                  value={form.fiberG}
                  onChange={(e) => onChange("fiberG", e.target.value)}
                  placeholder=" "
                  min="0"
                />
                <label htmlFor="food-fiber">Chất xơ (g)</label>
              </div>
            </div>

            {/* Đường kẻ ngang */}
            <hr className="fc-divider" />

            {/* Khu vực Rich Text Editor */}
            <h3 className="fc-section-title">Ghi chú / Mô tả chi tiết</h3>

            {/* TODO: Thay <textarea> bằng component RTE nếu muốn */}
            <div className="fc-field">
              <textarea
                id="food-desc"
                className="fc-textarea"
                value={form.description}
                onChange={(e) => onChange("description", e.target.value)}
                placeholder=" "
                rows="5"
              ></textarea>
              <label htmlFor="food-desc">Mô tả</label>
            </div>
          </div>
        </form>

        {msg && <div className="fc-ok">{msg}</div>}
      </div>
    </div>
  );
}
