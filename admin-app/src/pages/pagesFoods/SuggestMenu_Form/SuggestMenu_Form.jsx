// admin-app/src/pages/pagesFoods/SuggestMenu_Form/SuggestMenu_Form.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  listFoodsAdminOnly,
  createSuggestMenuApi,
  getSuggestMenu,
  updateSuggestMenuApi,
} from "../../../lib/api";
import { toast } from "react-toastify";

import "./SuggestMenu_Form.css";
import "../Food_Create/Food_Create.css"; // để reuse 1 số style btn/card nếu muốn

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import FormHelperText from "@mui/material/FormHelperText";
import MenuItem from "@mui/material/MenuItem";
import Autocomplete from "@mui/material/Autocomplete";
import RichTextEditorTiptap from "../../../components/Editor/RichTextEditorTiptap";

const CATEGORY_OPTIONS = ["Cân bằng", "Ít tinh bột - Tăng đạm"];

const DAY_OPTIONS = [
  { label: "1 ngày", value: 1 },
  { label: "2 ngày", value: 2 },
  { label: "3 ngày", value: 3 },
  { label: "4 ngày", value: 4 },
  { label: "5 ngày", value: 5 },
  { label: "6 ngày", value: 6 },
  { label: "7 ngày", value: 7 },
];

const initMenu = {
  name: "",
  descriptionHtml: "",
  imageUrl: "",
  category: "",
  numDays: 1,
};

const makeEmptyItem = () => ({
  foodId: "",
  foodName: "",
  kcal: 0,
  proteinG: 0,
  carbG: 0,
  fatG: 0,
});

const makeEmptyMeal = () => ({
  items: [makeEmptyItem()],
});

const makeEmptyDay = () => ({
  meals: [makeEmptyMeal()],
});

export default function SuggestMenu_Form() {
  const nav = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [menu, setMenu] = useState(initMenu);
  const [days, setDays] = useState([makeEmptyDay()]);

  const [foodOptions, setFoodOptions] = useState([]);
  const [loadingFoods, setLoadingFoods] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [imgFile, setImgFile] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const imgInputRef = useRef(null);
  const refName = useRef(null);

  // ----- load danh sách món ăn cho dropdown -----
  useEffect(() => {
    (async () => {
      try {
        setLoadingFoods(true);
        const res = await listFoodsAdminOnly({
          limit: 500,
          skip: 0,
          status: "approved",
        }).catch(() => null);

        const items = res?.items || res || [];
        const opts = items.map((f) => ({
          id: f._id || f.id,
          label: f.name || "(Không tên)",
          kcal: f.kcal || 0,
          proteinG: f.proteinG || 0,
          carbG: f.carbG || 0,
          fatG: f.fatG || 0,
        }));
        setFoodOptions(opts);
      } catch (err) {
        console.error(err);
        toast.error("Không tải được danh sách món ăn");
      } finally {
        setLoadingFoods(false);
      }
    })();
  }, []);

  // ----- load chi tiết khi edit -----
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        setLoadingDetail(true);
        const doc = await getSuggestMenu(id);

        setMenu({
          name: doc?.name || "",
          descriptionHtml: doc?.descriptionHtml || "",
          imageUrl: doc?.imageUrl || "",
          category: doc?.category || "",
          numDays: doc?.numDays || (doc?.days?.length || 1),
        });

        const mappedDays = (doc?.days || []).map((d) => ({
          meals: (d?.meals || []).map((m) => ({
            items:
              (m?.items || []).map((it) => ({
                foodId: it?.food?._id || it?.food || "",
                foodName: it?.food?.name || it?.foodName || "",
                kcal: it?.kcal ?? it?.food?.kcal ?? 0,
                proteinG: it?.proteinG ?? it?.food?.proteinG ?? 0,
                carbG: it?.carbG ?? it?.food?.carbG ?? 0,
                fatG: it?.fatG ?? it?.food?.fatG ?? 0,
              })) || [makeEmptyItem()],
          })) || [makeEmptyMeal()],
        }));

        setDays(mappedDays.length ? mappedDays : [makeEmptyDay()]);

        if (doc?.imageUrl) {
          setImgFile(null);
          setImgPreview(doc.imageUrl);
        }
      } catch (err) {
        console.error(err);
        toast.error("Không tải được thực đơn gợi ý");
        nav("/foods/suggest-menu");
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [isEdit, id, nav]);

  // cleanup preview
  useEffect(() => {
    return () => {
      if (imgPreview && imgPreview.startsWith("blob:")) {
        URL.revokeObjectURL(imgPreview);
      }
    };
  }, [imgPreview]);

  const onChangeMenu = (k, v) =>
    setMenu((s) => ({
      ...s,
      [k]: v,
    }));

  // tính tổng macro toàn thực đơn (FE)
  const totals = useMemo(() => {
    let kcal = 0;
    let p = 0;
    let c = 0;
    let f = 0;
    days.forEach((d) =>
      (d.meals || []).forEach((m) =>
        (m.items || []).forEach((it) => {
          kcal += Number(it.kcal || 0);
          p += Number(it.proteinG || 0);
          c += Number(it.carbG || 0);
          f += Number(it.fatG || 0);
        })
      )
    );
    return {
      kcal: Math.round(kcal),
      proteinG: Math.round(p),
      carbG: Math.round(c),
      fatG: Math.round(f),
    };
  }, [days]);

  // ----- image -----
  const pickImage = () => imgInputRef.current?.click();

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgFile(file);
    if (imgPreview && imgPreview.startsWith("blob:")) {
      URL.revokeObjectURL(imgPreview);
    }
    setImgPreview(URL.createObjectURL(file));
    if (menu.imageUrl) onChangeMenu("imageUrl", "");
  };

  const showImgFromUrl = () => {
    if (!imgFile) setImgPreview(menu.imageUrl || null);
  };

  // ----- change số ngày -> tự build số box ngày -----
  const onChangeNumDays = (value) => {
    const n = Number(value || 0) || 1;
    onChangeMenu("numDays", n);
    setDays((prev) => {
      let next = [...prev];
      while (next.length < n) next.push(makeEmptyDay());
      if (next.length > n) next = next.slice(0, n);
      return next;
    });
  };

  // ----- thao tác days / meals / items -----
  const addMeal = (dayIdx) => {
    setDays((prev) => {
      const clone = [...prev];
      const d = { ...clone[dayIdx] };
      d.meals = [...(d.meals || []), makeEmptyMeal()];
      clone[dayIdx] = d;
      return clone;
    });
  };

  const removeMeal = (dayIdx, mealIdx) => {
    setDays((prev) => {
      const clone = [...prev];
      const d = { ...clone[dayIdx] };
      if ((d.meals || []).length <= 1) return prev;
      d.meals = d.meals.filter((_, i) => i !== mealIdx);
      clone[dayIdx] = d;
      return clone;
    });
  };

  const addItem = (dayIdx, mealIdx) => {
    setDays((prev) => {
      const clone = [...prev];
      const d = { ...clone[dayIdx] };
      const meals = [...(d.meals || [])];
      const m = { ...meals[mealIdx] };
      m.items = [...(m.items || []), makeEmptyItem()];
      meals[mealIdx] = m;
      d.meals = meals;
      clone[dayIdx] = d;
      return clone;
    });
  };

  const removeItem = (dayIdx, mealIdx, itemIdx) => {
    setDays((prev) => {
      const clone = [...prev];
      const d = { ...clone[dayIdx] };
      const meals = [...(d.meals || [])];
      const m = { ...meals[mealIdx] };
      if ((m.items || []).length <= 1) return prev;
      m.items = m.items.filter((_, i) => i !== itemIdx);
      meals[mealIdx] = m;
      d.meals = meals;
      clone[dayIdx] = d;
      return clone;
    });
  };

  const updateItem = (dayIdx, mealIdx, itemIdx, patch) => {
    setDays((prev) => {
      const clone = [...prev];
      const d = { ...clone[dayIdx] };
      const meals = [...(d.meals || [])];
      const m = { ...meals[mealIdx] };
      const items = [...(m.items || [])];
      items[itemIdx] = { ...items[itemIdx], ...patch };
      m.items = items;
      meals[mealIdx] = m;
      d.meals = meals;
      clone[dayIdx] = d;
      return clone;
    });
  };

  // ----- validate -----
  const validate = () => {
    const errs = { days: [] };

    const name = String(menu.name || "").trim();
    if (!name) {
      errs.name = "Vui lòng nhập tên thực đơn gợi ý";
    } else if (name.length > 100) {
      errs.name = "Tên thực đơn tối đa 100 ký tự";
    }

    if (!imgFile && !menu.imageUrl) {
      errs.image = "Vui lòng chọn hình ảnh thực đơn";
    }

    const descHtml = String(menu.descriptionHtml || "");
    const plainDesc = descHtml.replace(/<[^>]*>/g, "").trim();
    if (!plainDesc) {
      errs.descriptionHtml = "Vui lòng nhập mô tả thực đơn";
    }

    if (!menu.category) {
      errs.category = "Vui lòng chọn Phân loại";
    }
    if (!menu.numDays || menu.numDays < 1) {
      errs.numDays = "Vui lòng chọn Số ngày";
    }

    if (!days.length) {
      errs.daysGeneral = "Cần ít nhất 1 ngày trong thực đơn";
    }

    let hasItemSelected = false;

    errs.days = days.map((d) => {
      const dErr = { meals: [] };
      const mealsErr = (d.meals || []).map((m) => {
        const mErr = { items: [] };
        const itemsErr = (m.items || []).map((it) => {
          const ie = {};
          if (!it.foodId) {
            ie.foodId = "Vui lòng chọn món ăn";
          } else {
            hasItemSelected = true;
          }
          return ie;
        });
        mErr.items = itemsErr;
        return mErr;
      });
      dErr.meals = mealsErr;
      return dErr;
    });

    if (!hasItemSelected) {
      errs.daysGeneral = "Cần chọn ít nhất 1 món ăn trong thực đơn";
    }

    const hasTopErr =
      errs.name ||
      errs.image ||
      errs.descriptionHtml ||
      errs.category ||
      errs.numDays ||
      errs.daysGeneral;

    const hasDayErr = errs.days.some((d) =>
      (d.meals || []).some((m) =>
        (m.items || []).some((ie) => ie.foodId)
      )
    );

    setErrors(errs);
    return !(hasTopErr || hasDayErr);
  };

  // ----- submit -----
  const onSubmit = async (e) => {
    e.preventDefault();
    const ok = validate();
    if (!ok) {
      toast.error("Vui lòng kiểm tra lại các dữ liệu nhập.");
      return;
    }

    const name = String(menu.name || "").trim();

    const normalizedDays = days
      .map((d, dIdx) => {
        const meals = (d.meals || [])
          .map((m, mIdx) => {
            const items = (m.items || [])
              .map((it) => {
                if (!it.foodId) return null;
                return {
                  foodId: it.foodId,
                  // gửi kèm macro (BE vẫn sẽ tính lại từ Food)
                  kcal: it.kcal,
                  proteinG: it.proteinG,
                  carbG: it.carbG,
                  fatG: it.fatG,
                };
              })
              .filter(Boolean);
            if (!items.length) return null;
            return { title: `Bữa ${mIdx + 1}`, items };
          })
          .filter(Boolean);
        if (!meals.length) return null;
        return { title: `Ngày ${dIdx + 1}`, meals };
      })
      .filter(Boolean);

    const payload = {
      name,
      descriptionHtml: menu.descriptionHtml,
      imageUrl: imgFile ? undefined : menu.imageUrl?.trim() || undefined,
      category: menu.category,
      numDays: menu.numDays,
      days: normalizedDays,
    };

    if (!normalizedDays.length) {
      toast.error("Thực đơn cần ít nhất 1 món ăn hợp lệ.");
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        if (imgFile) {
          const fd = new FormData();
          fd.append("image", imgFile);
          Object.entries(payload).forEach(([k, v]) => {
            if (v === undefined || v === null) return;
            if (Array.isArray(v)) {
              fd.append(k, JSON.stringify(v));
            } else {
              fd.append(k, String(v));
            }
          });
          await updateSuggestMenuApi(id, fd, true);
        } else {
          await updateSuggestMenuApi(id, payload, false);
        }

        toast.success("Cập nhật thực đơn gợi ý thành công!");
        nav("/foods/suggest-menu", {
          state: { justUpdated: true, updatedId: id },
        });
      } else {
        let created;
        if (imgFile) {
          const fd = new FormData();
          fd.append("image", imgFile);
          Object.entries(payload).forEach(([k, v]) => {
            if (v === undefined || v === null) return;
            if (Array.isArray(v)) {
              fd.append(k, JSON.stringify(v));
            } else {
              fd.append(k, String(v));
            }
          });
          created = await createSuggestMenuApi(fd, true);
        } else {
          created = await createSuggestMenuApi(payload, false);
        }

        const createdId = created?._id || created?.id;
        toast.success("Tạo thực đơn gợi ý thành công!");
        nav("/foods/suggest-menu", {
          state: { justCreated: true, createdId },
        });
      }
    } catch (err) {
      console.error(err);
      let msg = err?.response?.data?.message;
      if (!msg) {
        if (err?.response?.status === 413) msg = "File ảnh quá lớn.";
        else if (err?.response?.status === 422) msg = "Dữ liệu không hợp lệ.";
        else msg = "Lỗi máy chủ, vui lòng thử lại.";
      }
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const pageTitle = isEdit
    ? "Chỉnh sửa thực đơn gợi ý"
    : "Tạo thực đơn gợi ý";

  return (
    <div className="smf-page">
      {/* Breadcrumb */}
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/">
          <i className="fa-solid fa-house" aria-hidden="true"></i>
          <span>Trang chủ</span>
        </Link>
        <span className="separator">/</span>
        <span className="current-group">
          <i className="fa-solid fa-bowl-food" aria-hidden="true" />
          <span>Quản lý Món ăn</span>
        </span>
        <span className="separator">/</span>
        <span className="current-page">{pageTitle}</span>
      </nav>

      <div className="card">
        <div className="page-head">
          <h2>{pageTitle}</h2>
          <div className="head-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={() => nav("/foods/suggest-menu")}
            >
              Hủy
            </button>
            <button
              type="submit"
              form="suggest-menu-form"
              className="btn primary"
              disabled={saving || loadingDetail}
            >
              {saving ? "Đang lưu..." : isEdit ? "Cập nhật" : "Lưu"}
            </button>
          </div>
        </div>

        {isEdit && loadingDetail && (
          <div
            style={{
              padding: "8px 16px",
              fontSize: 13,
              color: "#6b7280",
            }}
          >
            Đang tải dữ liệu thực đơn...
          </div>
        )}

        <form
          id="suggest-menu-form"
          className="smf-form-layout"
          onSubmit={onSubmit}
        >
          {/* LEFT: Ảnh + tổng macro */}
          <div className="smf-left">
            <h3 className="smf-section-title">Ảnh thực đơn</h3>

            <div
              className="smf-image-box"
              role="button"
              tabIndex={0}
              onClick={pickImage}
              onKeyDown={(e) => e.key === "Enter" && pickImage()}
            >
              {imgPreview ? (
                <img src={imgPreview} alt="Xem trước" />
              ) : menu.imageUrl ? (
                <img
                  src={menu.imageUrl}
                  alt="Xem trước"
                  onError={() => setImgPreview(null)}
                />
              ) : (
                <div className="smf-placeholder">
                  <i className="fa-regular fa-image" />
                  <span>Nhấp để chọn ảnh</span>
                </div>
              )}
            </div>
            {errors.image && (
              <FormHelperText error sx={{ ml: "14px", mt: "-8px" }}>
                {errors.image}
              </FormHelperText>
            )}

            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={onPickImage}
            />

            <div className="smf-field-title-upl">Link hình ảnh (URL)</div>
            <TextField
              label="Hoặc dán link hình ảnh (URL)"
              value={menu.imageUrl}
              onChange={(e) => {
                if (imgFile) setImgFile(null);
                onChangeMenu("imageUrl", e.target.value);
              }}
              onBlur={showImgFromUrl}
              variant="outlined"
              fullWidth
              size="medium"
            />

            {/* Tổng macro */}
            <div className="smf-totals-wrap">
              <div className="smf-total-header">
                <span className="smf-label">Tổng Calorie</span>
                <span className="smf-kcal-big">{totals.kcal.toLocaleString()} <span>kcal</span></span>
              </div>
              
              <div className="smf-divider"></div>

              <div className="smf-total-macros">
                <div className="macro-item protein">
                  <span className="dot"></span>
                  <span className="macro-name">Đạm</span>
                  <span className="macro-val">{totals.proteinG}g</span>
                </div>
                <div className="macro-item carbs">
                  <span className="dot"></span>
                  <span className="macro-name">Đường bột</span>
                  <span className="macro-val">{totals.carbG}g</span>
                </div>
                <div className="macro-item fat">
                  <span className="dot"></span>
                  <span className="macro-name">Chất béo</span>
                  <span className="macro-val">{totals.fatG}g</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Thông tin + Bố cục thực đơn */}
          <div className="smf-right">
            <h3 className="smf-section-title">Thông tin thực đơn</h3>

            <Box sx={{ display: "flex", flexDirection: "column" }}>
              <div className="smf-field-title">Tên thực đơn gợi ý *</div>
              <TextField
                inputRef={refName}
                label="Tên thực đơn gợi ý *"
                value={menu.name}
                onChange={(e) => onChangeMenu("name", e.target.value)}
                error={!!errors.name}
                helperText={errors.name}
                fullWidth
              />

              <div className="smf-field-title-desc">Mô tả thực đơn *</div>
              <RichTextEditorTiptap
                valueHtml={menu.descriptionHtml}
                onChangeHtml={(html) => onChangeMenu("descriptionHtml", html)}
                minHeight={200}
              />
              {errors.descriptionHtml && (
                <div className="smf-err-msg">
                  {errors.descriptionHtml}
                </div>
              )}

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                  gap: 2,
                  marginTop: 2,
                  alignItems: "start",
                }}
              >
                {/* Phân loại */}
                <Box>
                  <div className="smf-field-title">Phân loại *</div>
                  <TextField
                    select
                    label="Phân loại *"
                    value={menu.category}
                    onChange={(e) =>
                      onChangeMenu("category", e.target.value)
                    }
                    error={!!errors.category}
                    helperText={errors.category}
                    fullWidth
                    SelectProps={{
                      MenuProps: {
                        autoFocus: false,
                        MenuListProps: { autoFocusItem: false },
                      },
                    }}
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <MenuItem key={opt} value={opt}>
                        {opt}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>

                {/* Số ngày */}
                <Box>
                  <div className="smf-field-title">Số ngày *</div>
                  <TextField
                    select
                    label="Số ngày *"
                    value={menu.numDays || ""}
                    onChange={(e) => onChangeNumDays(e.target.value)}
                    error={!!errors.numDays}
                    helperText={errors.numDays}
                    fullWidth
                    SelectProps={{
                      MenuProps: {
                        autoFocus: false,
                        MenuListProps: { autoFocusItem: false },
                      },
                    }}
                  >
                    {DAY_OPTIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
              </Box>
            </Box>

            <hr className="smf-divider" />

            <h3 className="smf-section-title">Bố cục thực đơn</h3>
            {errors.daysGeneral && (
              <div className="smf-err-msg">{errors.daysGeneral}</div>
            )}

            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {days.map((d, dayIdx) => {
                const dErr = errors.days?.[dayIdx] || {};
                return (
                  <div key={dayIdx} className="smf-day-box">
                    <div className="smf-day-head">
                      <div className="smf-day-title smf-section-title">
                        Ngày thứ {dayIdx + 1}
                      </div>
                      <div className="smf-day-actions">
                        <button
                          type="button"
                          className="smf-day-addmeal"
                          onClick={() => addMeal(dayIdx)}
                          title="Thêm bữa"
                        >
                          <i className="fa-solid fa-plus" />
                          <span>Thêm bữa</span>
                        </button>
                      </div>
                    </div>

                    <div className="smf-meal-list">
                      {(d.meals || []).map((m, mealIdx) => {
                        const mErr = dErr.meals?.[mealIdx] || {};
                        return (
                          <div key={mealIdx} className="smf-meal-box">
                            <div className="smf-meal-head">
                              <div className="smf-meal-title smf-section-title">
                                Bữa thứ {mealIdx + 1}
                              </div>
                              <button
                                type="button"
                                className="smf-meal-remove"
                                onClick={() => removeMeal(dayIdx, mealIdx)}
                                disabled={(d.meals || []).length <= 1}
                                title="Xóa bữa"
                              >
                                <i className="fa-regular fa-trash-can" />
                              </button>
                            </div>

                            <div className="smf-meal-body">
                              {(m.items || []).map((it, itemIdx) => {
                                const iErr = mErr.items?.[itemIdx] || {};
                                const selectedOption =
                                  foodOptions.find(
                                    (o) => o.id === it.foodId
                                  ) || null;

                                return (
                                  <div
                                    key={itemIdx}
                                    className="smf-item-row"
                                  >
                                    <div className="smf-item-header">
                                      <div className="smf-item-title">
                                        Món ăn thứ {itemIdx + 1}
                                      </div>
                                      <button
                                        type="button"
                                        className="smf-item-remove"
                                        onClick={() =>
                                          removeItem(dayIdx, mealIdx, itemIdx)
                                        }
                                        disabled={
                                          (m.items || []).length <= 1
                                        }
                                        title="Xóa món"
                                      >
                                        <i className="fa-solid fa-xmark" />
                                      </button>
                                    </div>

                                    <div className="smf-item-fields">
                                      <div className="smf-item-col">
                                        <div className="smf-field-title">
                                          Chọn món *
                                        </div>
                                        <Autocomplete
                                          loading={loadingFoods}
                                          options={foodOptions}
                                          getOptionLabel={(option) =>
                                            option.label || ""
                                          }
                                          value={selectedOption}
                                          onChange={(_e, val) => {
                                            if (!val) {
                                              updateItem(
                                                dayIdx,
                                                mealIdx,
                                                itemIdx,
                                                {
                                                  foodId: "",
                                                  foodName: "",
                                                  kcal: 0,
                                                  proteinG: 0,
                                                  carbG: 0,
                                                  fatG: 0,
                                                }
                                              );
                                            } else {
                                              updateItem(
                                                dayIdx,
                                                mealIdx,
                                                itemIdx,
                                                {
                                                  foodId: val.id,
                                                  foodName: val.label,
                                                  kcal: val.kcal,
                                                  proteinG: val.proteinG,
                                                  carbG: val.carbG,
                                                  fatG: val.fatG,
                                                }
                                              );
                                            }
                                          }}
                                          renderInput={(params) => (
                                            <TextField
                                              {...params}
                                              label="Chọn món"
                                              placeholder="Tìm theo tên món ăn"
                                              error={!!iErr.foodId}
                                              helperText={iErr.foodId}
                                            />
                                          )}
                                          ListboxProps={{
                                            style: { maxHeight: 280 },
                                          }}
                                        />
                                      </div>

                                      <div className="smf-item-col smf-item-macros">
                                        <div className="smf-field-title">
                                          Giá trị dinh dưỡng
                                        </div>
                                        <div className="smf-item-macros-row">
                                          <span>
                                            Calorie:{" "}
                                            {Math.round(it.kcal || 0)} kcal
                                          </span>
                                          <br />
                                          <div className="smf-item-macros-row-break">
                                            <span>
                                              Đạm:{" "}
                                              {Math.round(
                                                it.proteinG || 0
                                              )}{" "}
                                              g
                                            </span>,
                                            <span>
                                              Đường bột:{" "}
                                              {Math.round(
                                                it.carbG || 0
                                              )}{" "}
                                              g
                                            </span>,
                                            <span>
                                              Chất béo:{" "}
                                              {Math.round(
                                                it.fatG || 0
                                              )}{" "}
                                              g
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}

                              <div className="smf-add-item-wrap">
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => addItem(dayIdx, mealIdx)}
                                >
                                  + Thêm món
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </Box>
          </div>
        </form>
      </div>
    </div>
  );
}
