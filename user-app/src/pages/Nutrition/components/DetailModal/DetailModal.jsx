import React from "react";
import api from "../../../../lib/api";
import "./DetailModal.css";

// Chuẩn hoá URL ảnh về cùng origin với API
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

/**
 * Modal xem chi tiết món ăn – dùng chung cho RecordMeal / DailyJournal
 *
 * props:
 * - open: boolean
 * - food: object (data món ăn)
 * - onClose: () => void
 * - onAddToLog?: (food) => void   // callback khi bấm "Thêm vào Nhật ký"
 */
export default function DetailModal({ open, food, onClose, onAddToLog }) {
  if (!open || !food) return null;

  const {
    name,
    portionName,
    massG,
    unit,
    kcal,
    proteinG,
    carbG,
    fatG,
    sugarG,
    saltG,
    fiberG,
    description,
    imageUrl,
  } = food;

  const macros = [
    { label: "Calories", value: kcal != null ? `${kcal} kcal` : "-" },
    { label: "Chất đạm (Protein)", value: proteinG != null ? `${proteinG} g` : "-" },
    { label: "Đường bột (Carbs)", value: carbG != null ? `${carbG} g` : "-" },
    { label: "Chất béo (Fat)", value: fatG != null ? `${fatG} g` : "-" },
    { label: "Muối (Salt)", value: saltG != null ? `${saltG} g` : "-" },
    { label: "Đường (Sugar)", value: sugarG != null ? `${sugarG} g` : "-" },
    { label: "Chất xơ (Fiber)", value: fiberG != null ? `${fiberG} g` : "-" },
  ];

  const desc =
    description && description.trim()
      ? description
      : "Chưa có mô tả";

  return (
    <div className="detail-modal-backdrop" onClick={onClose}>
      <div
        className="food-modal-new"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cột trái: Hình ảnh lớn */}
        <div className="fm-col-left">
          <img
            src={toAbs(imageUrl) || "/images/food-placeholder.jpg"}
            alt={name}
          />
        </div>

        {/* Cột phải: Nội dung */}
        <div className="fm-col-right">
          {/* Nút X */}
          <button className="close-icon-btn" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>

          <div className="fm-scroll-content">
            {/* Tên + sub */}
            <div className="fm-header-info">
              <h3 className="fm-title-lg">{name}</h3>
              <div className="fm-sub-text">
                {portionName || "Khẩu phần tiêu chuẩn"} ·{" "}
                {massG ?? "-"} {unit || "g"}
              </div>
            </div>

            {/* Tiêu đề Macros */}
            <div className="fm-description-section">
              <h4>Giá trị đa lượng</h4>
            </div>

            {/* Box macro (dạng bảng dọc, viền dashed) */}
            <div className="fm-macro-box">
              {macros.map((m) => (
                <div key={m.label} className="macro-item">
                  <span className="lbl">{m.label}</span>
                  <span className="val">{m.value}</span>
                </div>
              ))}
            </div>

            {/* Mô tả / Hướng dẫn */}
            <div className="fm-description-section">
              <h4>Mô tả</h4>
              <p className="desc-text">{desc}</p>
            </div>
          </div>

          {/* Nút đáy – canh cùng đáy với ảnh */}
          {onAddToLog && (
            <div className="fm-bottom-action">
              <button
                className="btn-add-log"
                onClick={() => onAddToLog(food)}
              >
                <i className="fa-solid fa-circle-plus"></i>
                {" "}Thêm vào Nhật ký
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
