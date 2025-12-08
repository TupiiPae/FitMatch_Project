// src/pages/Nutrition/SuggestMenuDetail.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./SuggestMenuDetail.css";
import { getSuggestMenu } from "../../api/suggestMenus";
import api from "../../lib/api";
import DetailModal from "./components/DetailModal/DetailModal"; // <- thêm dòng này

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

// Lấy label ngày: ưu tiên title / name/label, fallback "Ngày X"
function getDayLabel(day, index) {
  if (!day) return `Ngày ${index + 1}`;
  return day.title || day.label || day.name || `Ngày ${index + 1}`;
}

// Lấy tên bữa: ưu tiên title / name/label/mealType, fallback "Bữa X"
function getMealName(meal, index) {
  if (!meal) return `Bữa ${index + 1}`;
  return (
    meal.title ||
    meal.name ||
    meal.label ||
    meal.mealType ||
    `Bữa ${index + 1}`
  );
}

// Chuẩn hoá 1 record món ăn trong bữa
function normalizeFood(food) {
  // "food" ở đây là 1 item trong MenuItemSchema
  // - food.food: doc Food đã populate (nếu BE populate)
  // - food.foodName, food.kcal,...: dữ liệu snapshot lưu trong SuggestMenu
  const base = food?.food || food || {};

  const name =
    food?.foodName ||
    base.name ||
    food?.name ||
    "Món ăn";

  const imageUrl = base.imageUrl || food?.imageUrl;
  const portionName =
    base.portionName || food?.portionName || "Khẩu phần tiêu chuẩn";
  const massG = base.massG ?? food?.massG;
  const unit = base.unit || food?.unit || "g";

  const kcal = food?.kcal ?? base.kcal ?? 0;
  const proteinG = food?.proteinG ?? base.proteinG ?? 0;
  const carbG = food?.carbG ?? base.carbG ?? 0;
  const fatG = food?.fatG ?? base.fatG ?? 0;

  return {
    name,
    imageUrl,
    portionName,
    massG,
    unit,
    kcal: Math.round(Number(kcal) || 0),
    proteinG: Math.round(Number(proteinG) || 0),
    carbG: Math.round(Number(carbG) || 0),
    fatG: Math.round(Number(fatG) || 0),
  };
}

export default function SuggestMenuDetail() {
  const nav = useNavigate();
  const { id } = useParams();

  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  // --- state cho DetailModal ---
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailFood, setDetailFood] = useState(null);

  // mở modal chi tiết món
  const openFoodDetail = (item) => {
    if (!item) return;
    const nf = normalizeFood(item);
    const base = item?.food || item || {};

    // gom thêm các trường DetailModal cần: description, sugarG, fiberG
    const fullFood = {
      ...nf,
      _id: base._id || item._id,
      description: base.description || item.description || "",
      sugarG: base.sugarG ?? item.sugarG ?? null,
      fiberG: base.fiberG ?? item.fiberG ?? null,
    };

    setDetailFood(fullFood);
    setDetailOpen(true);
  };

  const closeFoodDetail = () => {
    setDetailOpen(false);
    setDetailFood(null);
  };

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

  // Tính tổng calo/ngày:
  // - Ưu tiên field tổng từ BE: activeDay.totalKcal/totalProteinG/...
  // - Nếu không có → cộng từ các bữa → rồi cộng từ từng item trong bữa
  const totalsDay = useMemo(() => {
    if (!activeDay) {
      return { totalKcal: 0, proteinG: 0, carbG: 0, fatG: 0 };
    }

    const baseTotals = getTotals(activeDay || {});
    if (baseTotals.totalKcal) return baseTotals;

    let totalKcal = 0;
    let proteinG = 0;
    let carbG = 0;
    let fatG = 0;

    dayMeals.forEach((meal) => {
      if (!meal) return;

      // nếu BE có totalKcal cho bữa thì dùng luôn
      const mt = getTotals(meal || {});
      if (mt.totalKcal) {
        totalKcal += mt.totalKcal;
        proteinG += mt.proteinG;
        carbG += mt.carbG;
        fatG += mt.fatG;
        return;
      }

      const foods = Array.isArray(meal.items)
        ? meal.items
        : Array.isArray(meal.foods)
        ? meal.foods
        : [];

      foods.forEach((it) => {
        const base = it?.food || it || {};
        const kcal = Number(it?.kcal ?? base.kcal ?? 0) || 0;
        const p = Number(it?.proteinG ?? base.proteinG ?? 0) || 0;
        const c = Number(it?.carbG ?? base.carbG ?? 0) || 0;
        const fat = Number(it?.fatG ?? base.fatG ?? 0) || 0;

        totalKcal += kcal;
        proteinG += p;
        carbG += c;
        fatG += fat;
      });
    });

    return {
      totalKcal: Math.round(totalKcal),
      proteinG: Math.round(proteinG),
      carbG: Math.round(carbG),
      fatG: Math.round(fatG),
    };
  }, [activeDay, dayMeals]);

  const cate = menu?.category || "Chưa phân loại";
  const numDays = menu?.numDays || days.length || (menu?.days?.length ?? 0);

  // Mô tả rich-text: sử dụng descriptionHtml từ BE
  const descHtml =
    menu?.descriptionHtml ||
    menu?.description ||
    menu?.note ||
    menu?.shortDesc ||
    "";

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

            {/* Mô tả của Thực đơn (rich-text) – nằm ngay dưới hashtag và trên Tabs ngày */}
            {descHtml && (
              <div
                className="smd-desc"
                dangerouslySetInnerHTML={{ __html: descHtml }}
              />
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

                  // Tổng calo của bữa:
                  // - ưu tiên meal.totalKcal nếu BE có
                  // - nếu không → cộng từ từng món trong bữa
                  const mealTotals = (() => {
                    const baseTotals = getTotals(meal || {});
                    if (baseTotals.totalKcal) return baseTotals;

                    let totalKcal = 0;
                    let proteinG = 0;
                    let carbG = 0;
                    let fatG = 0;

                    foods.forEach((it) => {
                      const base = it?.food || it || {};
                      const kcal =
                        Number(it?.kcal ?? base.kcal ?? 0) || 0;
                      const p =
                        Number(it?.proteinG ?? base.proteinG ?? 0) || 0;
                      const c =
                        Number(it?.carbG ?? base.carbG ?? 0) || 0;
                      const fat =
                        Number(it?.fatG ?? base.fatG ?? 0) || 0;

                      totalKcal += kcal;
                      proteinG += p;
                      carbG += c;
                      fatG += fat;
                    });

                    return {
                      totalKcal: Math.round(totalKcal),
                      proteinG: Math.round(proteinG),
                      carbG: Math.round(carbG),
                      fatG: Math.round(fatG),
                    };
                  })();

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
                              {/* Tổng calo bữa ăn – cùng hàng với title, góc phải */}
                              Tổng:{" "}
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
                              onClick={() => openFoodDetail(f)} // <- mở DetailModal
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
                                    ? `${nf.massG} ${
                                        nf.unit || "g"
                                      }`
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

        {/* DetailModal – dùng chung với RecordMeal / DailyJournal */}
        <DetailModal
          open={detailOpen}
          food={detailFood}
          onClose={closeFoodDetail}
        />
        {/* Không truyền onAddToLog => modal chỉ xem chi tiết, không có nút "Thêm vào Nhật ký" */}
      </div>
    </div>
  );
}
