// src/pages/Nutrition/SuggestMenuDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./SuggestMenuDetail.css";
import { getSuggestMenu } from "../../api/suggestMenus";
import api from "../../lib/api";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

function getTotals(src = {}) {
  const totalKcal = src.totalKcal ?? src.totalCalories ?? src.kcal ?? 0;
  const proteinG = src.totalProteinG ?? src.proteinG ?? 0;
  const carbG = src.totalCarbG ?? src.carbG ?? 0;
  const fatG = src.totalFatG ?? src.fatG ?? 0;

  return {
    totalKcal: Math.round(Number(totalKcal) || 0),
    proteinG: Math.round(Number(proteinG) || 0),
    carbG: Math.round(Number(carbG) || 0),
    fatG: Math.round(Number(fatG) || 0),
  };
}

// Lấy label ngày: ưu tiên day.name/label, fallback "Ngày X"
function getDayLabel(day, index) {
  if (!day) return `Ngày ${index + 1}`;
  return day.label || day.name || `Ngày ${index + 1}`;
}

// Lấy tên bữa: ưu tiên name/label/mealType, fallback "Bữa X"
function getMealName(meal, index) {
  if (!meal) return `Bữa ${index + 1}`;
  return meal.name || meal.label || meal.mealType || `Bữa ${index + 1}`;
}

// Chuẩn hoá 1 record món ăn trong bữa
function normalizeFood(food) {
  const base = food?.food || food || {};
  return {
    name: base.name || food?.name || "Món ăn",
    imageUrl: base.imageUrl || food?.imageUrl,
    portionName: base.portionName || food?.portionName || "Khẩu phần tiêu chuẩn",
    massG: base.massG ?? food?.massG,
    unit: base.unit || food?.unit || "g",
    kcal: base.kcal ?? food?.kcal ?? 0,
    proteinG: base.proteinG ?? food?.proteinG ?? 0,
    carbG: base.carbG ?? food?.carbG ?? 0,
    fatG: base.fatG ?? food?.fatG ?? 0,
  };
}

export default function SuggestMenuDetail() {
  const nav = useNavigate();
  const { id } = useParams();

  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const data = await getSuggestMenu(id);
        setMenu(data || null);
        setActiveDayIndex(0);
      } catch (e) {
        console.error(e);
        setErr("Không tải được dữ liệu Thực đơn gợi ý.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const days = useMemo(() => {
    if (!menu) return [];
    return Array.isArray(menu.days) ? menu.days : [];
  }, [menu]);

  const activeDay = days[activeDayIndex] || null;

  const dayMeals = useMemo(() => {
    if (!activeDay) return [];
    // tuỳ BE đặt tên trường, ưu tiên .meals, fallback .sessions
    if (Array.isArray(activeDay.meals)) return activeDay.meals;
    if (Array.isArray(activeDay.sessions)) return activeDay.sessions;
    return [];
  }, [activeDay]);

  const totalsMenu = getTotals(menu || {});
  const totalsDay = getTotals(activeDay || {});

  const cate = menu?.category || "Chưa phân loại";
  const numDays = menu?.numDays || days.length || (menu?.days?.length ?? 0);

  if (loading) {
    return (
      <div className="smd-page">
        <div className="smd-inner">
          <div className="smd-state">Đang tải Thực đơn gợi ý...</div>
        </div>
      </div>
    );
  }

  if (err || !menu) {
    return (
      <div className="smd-page">
        <div className="smd-inner">
          <div className="smd-state smd-error">
            {err || "Không tìm thấy Thực đơn gợi ý."}
          </div>
          <button
            type="button"
            className="smd-back smd-back-inline"
            onClick={() => nav(-1)}
          >
            <i className="fa-solid fa-arrow-left-long" />
            <span>Quay lại danh sách</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="smd-page">
      <div className="smd-inner">
        {/* Nút quay lại */}
        <button
          type="button"
          className="smd-back"
          onClick={() => nav(-1)}
        >
          <i className="fa-solid fa-arrow-left-long"></i>
          <span>Quay lại</span>
        </button>

        <div className="smd-layout">
          {/* ===== BÊN TRÁI: Ảnh + tên + mô tả + ngày ===== */}
          <div className="smd-left">
            {/* Hero image */}
            <div className="smd-hero-wrap">
              <div className="smd-hero-box">
                {menu.imageUrl ? (
                  <img
                    src={toAbs(menu.imageUrl)}
                    alt={menu.name}
                    className="smd-hero-img"
                  />
                ) : (
                  <div className="smd-hero-placeholder">
                    <i className="fa-regular fa-image" />
                  </div>
                )}
              </div>
            </div>

            {/* Tên + tag */}
            <div className="smd-title-row">
              <h1 className="smd-title">{menu.name || "Thực đơn gợi ý"}</h1>
              <div className="smd-tags">
                <span className="smd-tag main">#{cate}</span>
                {numDays ? (
                  <span className="smd-tag">~ {numDays} ngày</span>
                ) : null}
              </div>
            </div>

            {/* Mô tả ngắn */}
            {(menu.description || menu.note || menu.shortDesc) && (
              <div className="smd-desc">
                {menu.description || menu.note || menu.shortDesc}
              </div>
            )}

            {/* Tabs các ngày */}
            <div className="smd-day-tabs">
              {days.length === 0 && (
                <span className="smd-day-empty">
                  Thực đơn này chưa có dữ liệu ngày cụ thể.
                </span>
              )}

              {days.map((d, idx) => (
                <button
                  key={d._id || idx}
                  type="button"
                  className={
                    "smd-day-tab" + (idx === activeDayIndex ? " active" : "")
                  }
                  onClick={() => setActiveDayIndex(idx)}
                >
                  {getDayLabel(d, idx)}
                </button>
              ))}
            </div>

            {/* Nội dung 1 ngày: bữa + món ăn */}
            <div className="smd-day-panel">
              {!activeDay && (
                <div className="smd-day-state">
                  Chưa có dữ liệu Bữa cho thực đơn này.
                </div>
              )}

              {activeDay && dayMeals.length === 0 && (
                <div className="smd-day-state">
                  Ngày này chưa có bữa ăn nào được thiết lập.
                </div>
              )}

              {activeDay &&
                dayMeals.length > 0 &&
                dayMeals.map((meal, mIdx) => {
                  const foods = Array.isArray(meal.items)
                    ? meal.items
                    : Array.isArray(meal.foods)
                    ? meal.foods
                    : [];

                  const mealTotals = getTotals(meal || {});

                  return (
                    <section className="smd-meal" key={meal._id || mIdx}>
                      <div className="smd-meal-head">
                        <div className="smd-meal-title">
                          <span className="smd-meal-badge">
                            {getMealName(meal, mIdx)}
                          </span>
                        </div>
                        <div className="smd-meal-kcal">
                          {mealTotals.totalKcal ? (
                            <>
                              {mealTotals.totalKcal.toLocaleString()} Cal ·{" "}
                              <span className="protein">
                                {mealTotals.proteinG}g Protein
                              </span>{" "}
                              ·{" "}
                              <span className="carb">
                                {mealTotals.carbG}g Carb
                              </span>{" "}
                              ·{" "}
                              <span className="fat">
                                {mealTotals.fatG}g Fat
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      {/* Danh sách món trong bữa */}
                      <div className="smd-food-list">
                        {foods.length === 0 && (
                          <div className="smd-food-empty">
                            Bữa này chưa có món ăn nào.
                          </div>
                        )}

                        {foods.map((f, fIdx) => {
                          const nf = normalizeFood(f);

                          return (
                            <div
                              key={f._id || fIdx}
                              className="smd-food-row"
                            >
                              <div className="smd-food-thumb">
                                {nf.imageUrl ? (
                                  <img
                                    src={toAbs(nf.imageUrl)}
                                    alt={nf.name}
                                  />
                                ) : (
                                  <div className="smd-food-thumb-fallback">
                                    <i className="fa-regular fa-image" />
                                  </div>
                                )}
                              </div>

                              <div className="smd-food-main">
                                <div className="smd-food-name">
                                  {nf.name}
                                </div>
                                <div className="smd-food-sub">
                                  {nf.portionName} ·{" "}
                                  {nf.massG != null
                                    ? `${nf.massG} ${nf.unit || "g"}`
                                    : `Khối lượng tiêu chuẩn`}{" "}
                                  · {nf.kcal} Cal
                                </div>
                                <div className="smd-food-macros-line">
                                  <span className="protein">
                                    {nf.proteinG}g Protein
                                  </span>{" "}
                                  |{" "}
                                  <span className="carb">
                                    {nf.carbG}g Carb
                                  </span>{" "}
                                  |{" "}
                                  <span className="fat">
                                    {nf.fatG}g Fat
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
            </div>
          </div>

          {/* ===== BÊN PHẢI: Box tổng calo + macros ===== */}
          <aside className="smd-right">
            <section className="smd-summary-card">
              <h2 className="smd-summary-title">Tổng quan Thực đơn</h2>
              <p className="smd-summary-sub">
                Thực đơn gợi ý giúp bạn có cái nhìn tổng thể về năng lượng
                và các nhóm chất trong ngày.
              </p>

              <div className="smd-total-row">
                <div className="smd-total-circle">
                  <div className="label">Tổng Calo</div>
                  <div className="value">
                    {totalsMenu.totalKcal.toLocaleString()}
                  </div>
                  <div className="unit">Cal/ngày</div>
                </div>

                <div className="smd-macro-list">
                  <div className="smd-macro-item">
                    <span className="dot protein" />
                    <div className="text">
                      <div className="label">Đạm (Protein)</div>
                      <div className="value">
                        {totalsMenu.proteinG} g
                      </div>
                    </div>
                  </div>
                  <div className="smd-macro-item">
                    <span className="dot carb" />
                    <div className="text">
                      <div className="label">Đường bột (Carb)</div>
                      <div className="value">
                        {totalsMenu.carbG} g
                      </div>
                    </div>
                  </div>
                  <div className="smd-macro-item">
                    <span className="dot fat" />
                    <div className="text">
                      <div className="label">Chất béo (Fat)</div>
                      <div className="value">
                        {totalsMenu.fatG} g
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {activeDay && (
                <div className="smd-day-summary">
                  <div className="smd-day-summary-label">
                    Ngày đang xem:{" "}
                    <span>{getDayLabel(activeDay, activeDayIndex)}</span>
                  </div>
                  <div className="smd-day-summary-line">
                    {totalsDay.totalKcal ? (
                      <>
                        {totalsDay.totalKcal.toLocaleString()} Cal ·{" "}
                        <span className="protein">
                          {totalsDay.proteinG}g Protein
                        </span>{" "}
                        ·{" "}
                        <span className="carb">
                          {totalsDay.carbG}g Carb
                        </span>{" "}
                        ·{" "}
                        <span className="fat">
                          {totalsDay.fatG}g Fat
                        </span>
                      </>
                    ) : (
                      "Chưa có tổng calo/ngày cụ thể."
                    )}
                  </div>
                </div>
              )}

              <div className="smd-summary-meta">
                <div className="meta-item">
                  <span className="label">Danh mục</span>
                  <span className="value">{cate}</span>
                </div>
                <div className="meta-item">
                  <span className="label">Số ngày</span>
                  <span className="value">{numDays || "—"}</span>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
