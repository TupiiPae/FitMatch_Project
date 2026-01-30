import React from "react";
import api from "../../../../lib/api";
import "./AddModal.css";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

// Giờ ăn: 6h–23h giống code cũ
const HOUR_OPTIONS = Array.from({ length: 18 }, (_, i) => 6 + i); // 6..23

/**
 * Modal "Thêm vào nhật ký" – dùng chung cho RecordMeal / DailyJournal
 */
export default function AddModal({
  open,
  food,
  date,
  hour,
  quantity,
  massG,
  onChangeDate,
  onChangeHour,
  onChangeQuantity,
  onClose,
  onConfirm,
}) {
  if (!open || !food) return null;

  const qNum = Number(quantity || 1);
  const f = food || {};

  const fmt = (v) =>
    v == null ? "-" : Math.round(v * qNum * 10) / 10;

  // Khối lượng khẩu phần thay đổi theo số lượng
  let totalMassText = "-";
  if (massG != null && massG !== "") {
    const base = Number(massG);
    if (!Number.isNaN(base)) {
      totalMassText = `${Math.round(base * qNum)} g`;
    }
  }

  const handleDecrease = () => {
    onChangeQuantity(Math.max(1, Math.round((quantity || 1) - 1)));
  };
  const handleIncrease = () => {
    onChangeQuantity(Math.max(1, Math.round((quantity || 1) + 1)));
  };
  const handleQuantityInput = (e) => {
    const raw = +e.target.value || 1;
    onChangeQuantity(Math.max(1, Math.round(raw)));
  };

  return (
      <div
        className="add-modal-backdrop"
        data-fm-modal="true"
        role="dialog"
        aria-modal="true"
        onClick={onClose}
      >
      <div
        className="add-modal-card add-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER: Ảnh + tên món + nút X */}
        <div className="am-head">
          <div className="am-thumb-wrap">
            <img
              className="am-thumb"
              src={toAbs(food.imageUrl) || "/images/food-placeholder.jpg"}
              alt={food.name || "food"}
            />

            <button className="am-close-btn" onClick={onClose}>
              <i className="fa-solid fa-xmark"></i>
            </button>

            <div className="am-hmeta">
              <h3 className="am-food-name">{food.name}</h3>
            </div>
          </div>
        </div>

        {/* BODY SCROLLABLE */}
        <div className="am-body">
          {/* Ngày / giờ */}
          <div className="am-when">
            <div className="am-when-item">
              <div className="am-field">
                <label>Ngày <i className="fa-regular fa-calendar"></i></label>
                <div className="am-date">
                  <input
                    className="am-date-input"
                    type="date"
                    value={date || ""}               // date đang là YYYY-MM-DD
                    onChange={(e) => onChangeDate(e.target.value)}
                    aria-label="Chọn ngày"
                  />
                  <i className="fa-regular fa-calendar am-date-ico" />
                </div>
              </div>
            </div>

            <div className="am-when-item">
              <div className="am-field">
                <label>Giờ <i className="fa-regular fa-clock"></i></label>
                <select
                  value={hour}
                  onChange={(e) => onChangeHour(+e.target.value)}
                >
                  {HOUR_OPTIONS.map((h) => (
                    <option key={h} value={h}>
                      {`${h}:00`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Khối lượng khẩu phần */}
          <div className="am-portion-block">
            <label>Khối lượng khẩu phần (g)</label>
            <input
              type="text"
              value={totalMassText}
              readOnly
              className="am-input readonly"
            />
            <div className="am-note">
              Khối lượng mặc định theo món, tự động thay đổi theo số lượng
            </div>
          </div>

          {/* Số lượng khẩu phần */}
          <div className="am-qty-block">
            <div className="am-qty-label-row">
              <div className="am-qty-icon">
                <i className="fa-solid fa-utensils"></i>
              </div>
              <div className="am-qty-text">
                <div className="am-qty-title">Số lượng</div>
                <div className="am-qty-sub">(khẩu phần)</div>
              </div>
            </div>

            <div className="am-qty-ctl">
              <button type="button" onClick={handleDecrease}>
                –
              </button>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={handleQuantityInput}
              />
              <button type="button" onClick={handleIncrease}>
                +
              </button>
            </div>
          </div>

          {/* Giá trị dinh dưỡng */}
          <div className="am-macro-section">
            <div className="am-macro-title">
              Giá trị dinh dưỡng <span>(ước tính)</span>
            </div>
            <div className="am-macro-box">
              <div className="am-macro-row calories">
                <span className="lbl">Calories</span>
                <span className="val">
                  {fmt(f.kcal)} kcal
                </span>
              </div>
              <div className="am-macro-row">
                <span className="lbl">Chất đạm (Protein)</span>
                <span className="val">
                  {fmt(f.proteinG)} g
                </span>
              </div>
              <div className="am-macro-row">
                <span className="lbl">Đường bột (Carbs)</span>
                <span className="val">
                  {fmt(f.carbG)} g
                </span>
              </div>
              <div className="am-macro-row">
                <span className="lbl">Chất béo (Fat)</span>
                <span className="val">
                  {fmt(f.fatG)} g
                </span>
              </div>
              <div className="am-macro-row">
                <span className="lbl">Muối (Salt)</span>
                <span className="val">
                  {fmt(f.saltG)} g
                </span>
              </div>
              <div className="am-macro-row">
                <span className="lbl">Đường (Sugar)</span>
                <span className="val">
                  {fmt(f.sugarG)} g
                </span>
              </div>
              <div className="am-macro-row">
                <span className="lbl">Chất xơ (Fiber)</span>
                <span className="val">
                  {fmt(f.fiberG)} g
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Nút CTA đáy – đỏ full width */}
        <div className="am-actions">
          <button className="am-submit-btn" onClick={onConfirm}>
            Thêm vào nhật ký
          </button>
        </div>
      </div>
    </div>
  );
}
