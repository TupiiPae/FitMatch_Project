import React, { useEffect, useMemo, useState } from "react";
import api from "../../../../lib/api";
import "./DetailModal.css";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

const nNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmt = (v, d = 2) => {
  const n = nNum(v);
  if (n == null) return "—";
  return n.toLocaleString("vi-VN", { maximumFractionDigits: d });
};

export default function DetailModal({ open, food, onClose, onAddToLog }) {
  const [showNutrition, setShowNutrition] = useState(false);

  const safeFood = food || {};
  const {
    _id,
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
    createdByAdmin,
    sourceType,
  } = safeFood;

  useEffect(() => {
    if (!open) setShowNutrition(false);
  }, [open, _id]);

  const desc =
    description && String(description).trim() ? description : "Chưa có mô tả";

  const isAdminCreated =
  !!createdByAdmin || String(sourceType || "").toLowerCase() === "admin_created";

  const head = useMemo(() => {
    const pG = nNum(proteinG) ?? 0;
    const cG = nNum(carbG) ?? 0;
    const fG = nNum(fatG) ?? 0;

    const pCal = pG * 4;
    const cCal = cG * 4;
    const fCal = fG * 9;

    const total = pCal + cCal + fCal;
    const pct = (x) => (total > 0 ? (x / total) * 100 : 0);

    const pPct = pct(pCal);
    const cPct = pct(cCal);
    const fPct = pct(fCal);

    const ringBg = `conic-gradient(
      #3b82f6 0% ${cPct}%,
      #ef4444 ${cPct}% ${cPct + pPct}%,
      #f59e0b ${cPct + pPct}% 100%
    )`;

    return {
      ringBg,
      protein: { pct: Math.round(pPct), g: fmt(proteinG, 2) },
      carb: { pct: Math.round(cPct), g: fmt(carbG, 2) },
      fat: { pct: Math.round(fPct), g: fmt(fatG, 2) },
    };
  }, [proteinG, carbG, fatG]);

  if (!open || !food) return null;

  return (
    <div
      className="detail-modal-backdrop"
      data-fm-modal="true"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="food-modal-new" onClick={(e) => e.stopPropagation()}>
        <div className="fm-col-left">
          <img
            src={toAbs(imageUrl) || "/images/food-placeholder.jpg"}
            alt={name || "food"}
          />
        </div>

        <div className="fm-col-right">
          <button className="close-icon-btn" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>

          <div className="fm-scroll-content">
            <div className="fm-header-info">
              <h3 className="fm-title-lg">{name}</h3>
              <div className="fm-sub-text">
                {portionName || "Khẩu phần tiêu chuẩn"} · {massG ?? "—"}{" "}
                {unit || "g"}
              </div>
            </div>

            <div className="fm-macro-head">
              <div className="fm-ring" style={{ background: head.ringBg }}>
                <div className="fm-ring-center">
                  <div className="fm-ring-kcal">{fmt(kcal, 0)}</div>
                  <div className="fm-ring-unit">Cal</div>
                </div>
              </div>

              <div className="fm-macro-pill is-protein">
                <div className="fm-pill-badge">{head.protein.pct}%</div>
                <div className="fm-pill-gram">{head.protein.g} g</div>
                <div className="fm-pill-label">
                  <i className="fa-solid fa-bolt"></i> CHẤT ĐẠM
                </div>
              </div>

              <div className="fm-macro-pill is-carb">
                <div className="fm-pill-badge">{head.carb.pct}%</div>
                <div className="fm-pill-gram">{head.carb.g} g</div>
                <div className="fm-pill-label">
                  <i className="fa-solid fa-wheat-awn"></i> ĐƯỜNG BỘT
                </div>
              </div>

              <div className="fm-macro-pill is-fat">
                <div className="fm-pill-badge">{head.fat.pct}%</div>
                <div className="fm-pill-gram">{head.fat.g} g</div>
                <div className="fm-pill-label">
                  <i className="fa-solid fa-droplet"></i> CHẤT BÉO
                </div>
              </div>
            </div>

            {isAdminCreated && (
              <div className="fm-verified">
                <div className="fm-verified">
                  <span className="fm-verified-badge" aria-hidden="true">
                    <i className="fa-solid fa-check"></i>
                  </span>
                  <span>Được tạo bởi đội ngũ dinh dưỡng Fitmatch</span>
                </div>
              </div>
            )}

            <div className="fm-block-title">Giá trị dinh dưỡng</div>

            <button
              type="button"
              className={`fm-toggle-btn ${showNutrition ? "is-open" : ""}`}
              onClick={() => setShowNutrition((v) => !v)}
            >
              <span>
                {showNutrition
                  ? "Ẩn giá trị dinh dưỡng"
                  : "Hiển thị giá trị dinh dưỡng"}
              </span>
              <i className="fa-solid fa-chevron-down"></i>
            </button>

            {showNutrition && (
              <div className="fm-nutri-panel">
                <div className="fm-nutri-row">
                  <span className="k">Năng lượng</span>
                  <span className="v">{fmt(kcal, 0)} cal</span>
                </div>

                <div className="fm-nutri-row">
                  <span className="k">Đường bột (carb)</span>
                  <span className="v">{fmt(carbG, 2)} g</span>
                </div>
                <div className="fm-nutri-sub">
                  <div className="fm-nutri-subrow">
                    <span className="k">Chất xơ</span>
                    <span className="v">{fmt(fiberG, 2)} g</span>
                  </div>
                  <div className="fm-nutri-subrow">
                    <span className="k">Đường</span>
                    <span className="v">{fmt(sugarG, 2)} g</span>
                  </div>
                </div>

                <div className="fm-nutri-row">
                  <span className="k">Chất béo (fat)</span>
                  <span className="v">{fmt(fatG, 2)} g</span>
                </div>

                <div className="fm-nutri-row">
                  <span className="k">Chất đạm (protein)</span>
                  <span className="v">{fmt(proteinG, 2)} g</span>
                </div>

                <div className="fm-nutri-row">
                  <span className="k">Muối</span>
                  <span className="v">{fmt(saltG, 2)} g</span>
                </div>
              </div>
            )}

            <div className="fm-desc-title">Mô tả</div>
            <p className="desc-text">{desc}</p>
          </div>

          {onAddToLog && (
            <div className="fm-bottom-action">
              <button className="btn-add-log" onClick={() => onAddToLog(food)}>
                <i className="fa-solid fa-circle-plus"></i> Thêm vào Nhật ký
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
