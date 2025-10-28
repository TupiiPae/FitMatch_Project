import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createFood } from "../../../lib/api.js";
import "./Food_Create.css"; // Dùng file CSS mới

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
  description: "", // (MỚI) Cho Rich Text Editor
};

export default function FoodCreate() {
  const nav = useNavigate();
  const [form, setForm] = useState(initialState);
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState(null);

  const onChange = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    try {
      const body = {
        name: form.name,
        servingDesc: form.servingDesc,
        massG: num(form.massG),
        unit: form.unit,
        imageUrl: form.imageUrl,
        kcal: num(form.kcal),
        proteinG: num(form.proteinG),
        carbG: num(form.carbG),
        fatG: num(form.fatG),
        saltG: num(form.saltG),
        sugarG: num(form.sugarG),
        fiberG: num(form.fiberG),
        description: form.description,
      };
      await createFood(body);
      setMsg("Tạo món ăn thành công!");
      setForm(initialState);
      setPreview(null);
    } catch (err) {
      setMsg("Đã xảy ra lỗi. Vui lòng thử lại.");
      console.error(err);
    }
  };

  const handleImagePreview = () => {
    setPreview(form.imageUrl);
  };

  return (
    <div className="food-create-page">
      {/* ===== Breadcrumb ===== */}
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/">
          <i className="fa-solid fa-house"></i>
          <span>Trang chủ</span>
        </Link>
        <span className="separator">/</span>
        <span className="current-group">
          <i className="fa-solid fa-utensils"></i>
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
              <i className="fa-solid fa-xmark"></i> <span>Hủy</span>
            </button>
            <button
              className="btn primary"
              type="submit"
              form="create-food-form"
            >
              <i className="fa-solid fa-check"></i> <span>Lưu & Tạo mới</span>
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
            <div className="fc-image-box">
              {preview ? (
                <img
                  src={preview}
                  alt="Xem trước"
                  onError={() => setPreview(null)}
                />
              ) : (
                <div className="placeholder">
                  <i className="fa-regular fa-image"></i>
                  <span>Xem trước hình ảnh</span>
                </div>
              )}
            </div>
            
            {/* Trường Input Float Label */}
            <div className="fc-field">
              <input
                type="url"
                id="food-image-url"
                placeholder=" " // Quan trọng: phải có 1 dấu cách
                value={form.imageUrl}
                onChange={(e) => onChange("imageUrl", e.target.value)}
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
                <label htmlFor="food-unit">Đơn vị (bắt buộc)</label>
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
              />
              <label htmlFor="food-kcal">Calo (kcal)</label>
            </div>
            
            {/* 3 trường 1 hàng */}
            <div className="fc-fields-grid-3">
              <div className="fc-field">
                <input type="number" step="0.1" id="food-p" value={form.proteinG} onChange={(e) => onChange("proteinG", e.target.value)} placeholder=" " />
                <label htmlFor="food-p">Đạm (g)</label>
              </div>
              <div className="fc-field">
                <input type="number" step="0.1" id="food-c" value={form.carbG} onChange={(e) => onChange("carbG", e.target.value)} placeholder=" " />
                <label htmlFor="food-c">Carb (g)</label>
              </div>
              <div className="fc-field">
                <input type="number" step="0.1" id="food-f" value={form.fatG} onChange={(e) => onChange("fatG", e.target.value)} placeholder=" " />
                <label htmlFor="food-f">Chất béo (g)</label>
              </div>
            </div>

            {/* 3 trường 1 hàng */}
            <div className="fc-fields-grid-3">
              <div className="fc-field">
                <input type="number" step="0.1" id="food-salt" value={form.saltG} onChange={(e) => onChange("saltG", e.target.value)} placeholder=" " />
                <label htmlFor="food-salt">Muối (g)</label>
              </div>
              <div className="fc-field">
                <input type="number" step="0.1" id="food-sugar" value={form.sugarG} onChange={(e) => onChange("sugarG", e.target.value)} placeholder=" " />
                <label htmlFor="food-sugar">Đường (g)</label>
              </div>
              <div className="fc-field">
                <input type="number" step="0.1" id="food-fiber" value={form.fiberG} onChange={(e) => onChange("fiberG", e.target.value)} placeholder=" " />
                <label htmlFor="food-fiber">Chất xơ (g)</label>
              </div>
            </div>
            
            {/* Đường kẻ ngang */}
            <hr className="fc-divider" />
            
            {/* Khu vực Rich Text Editor */}
            <h3 className="fc-section-title">Ghi chú / Mô tả chi tiết</h3>
            
            {/* TODO: Thay thế <textarea> bằng component Rich Text Editor */}
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