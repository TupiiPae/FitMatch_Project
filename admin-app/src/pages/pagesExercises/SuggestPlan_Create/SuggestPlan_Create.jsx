// admin-app/src/pages/pagesExercises/SuggestPlan_Create/SuggestPlan_Create.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  listExercisesAdminOnly,
  createSuggestPlanApi,
  getSuggestPlan,
  updateSuggestPlanApi,
} from "../../../lib/api";
import { toast } from "react-toastify";

import "./SuggestPlan_Create.css";
import "../Strength_Create/Strength_Create.css";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import FormHelperText from "@mui/material/FormHelperText";
import Autocomplete from "@mui/material/Autocomplete";
import MenuItem from "@mui/material/MenuItem";
import RichTextEditorTiptap from "../../../components/Editor/RichTextEditorTiptap";

const nameRegex = /^[\p{L}\p{M}\s0-9'’\-.,()\/]+$/u;
const CATEGORY_OPTIONS = [
  "Tại Gym",
  "Tại nhà",
  "Du lịch",
  "Chỉ tạ đơn",
  "Cardio và HIIT",
  "Bodyweight",
];

const LEVEL_OPTIONS = ["Cơ bản", "Trung bình", "Nâng cao"];

const GOAL_OPTIONS = ["Tăng cơ bắp", "Tăng sức mạnh", "Giảm cân nặng"];

const initPlan = {
  name: "",
  descriptionHtml: "",
  imageUrl: "",
  category: "", // Phân loại
  level: "",    // Mức độ
  goal: "",     // Mục tiêu
};

const makeEmptySession = () => ({
  title: "",
  description: "",
  items: [
    {
      exerciseId: "",
      exerciseName: "",
      repsText: "",
    },
  ],
});

export default function SuggestPlanCreate() {
  const nav = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [plan, setPlan] = useState(initPlan);
  const [sessions, setSessions] = useState([makeEmptySession()]);
  const [exerciseOptions, setExerciseOptions] = useState([]);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [imgFile, setImgFile] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const imgInputRef = useRef(null);
  const refName = useRef(null);
  const refImageBox = useRef(null);

  // ---- load danh sách bài tập (dropdown) ----
  useEffect(() => {
    (async () => {
      try {
        setLoadingExercises(true);
        const res = await listExercisesAdminOnly({
          limit: 500,
          skip: 0,
        }).catch(() => null);
        const items = res?.items || res || [];
        const opts = items.map((e) => ({
          id: e._id || e.id,
          label: e.name || "(Không tên)",
        }));
        setExerciseOptions(opts);
      } catch (err) {
        console.error(err);
        toast.error("Không tải được danh sách bài tập");
      } finally {
        setLoadingExercises(false);
      }
    })();
  }, []);

  // ---- load chi tiết lịch tập khi EDIT ----
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        setLoadingDetail(true);
        const doc = await getSuggestPlan(id);

        setPlan({
          name: doc?.name || "",
          descriptionHtml: doc?.descriptionHtml || "",
          imageUrl: doc?.imageUrl || "",
          category: doc?.category || "",
          level: doc?.level || "",
          goal: doc?.goal || "",
        });

        const mappedSessions = (doc?.sessions || []).map((s) => ({
          title: s?.title || "",
          description: s?.description || "",
          items: (s?.exercises || s?.items || []).map((it) => ({
            exerciseId: it?.exercise?._id || it?.exercise || "",
            exerciseName: it?.exercise?.name || "",
            repsText: it?.reps || "",
          })),
        }));

        setSessions(
          mappedSessions.length ? mappedSessions : [makeEmptySession()]
        );

        if (doc?.imageUrl) {
          setImgFile(null);
          setImgPreview(doc.imageUrl);
        }
      } catch (err) {
        console.error(err);
        toast.error("Không tải được lịch tập gợi ý");
        nav("/exercises/suggest-plan");
      } finally {
        setLoadingDetail(false);
      }
    })();
  }, [isEdit, id, nav]);

  useEffect(() => {
    return () => {
      if (imgPreview && imgPreview.startsWith("blob:")) {
        URL.revokeObjectURL(imgPreview);
      }
    };
  }, [imgPreview]);

  const onChangePlan = (k, v) =>
    setPlan((s) => ({
      ...s,
      [k]: v,
    }));

  const pickImage = () => imgInputRef.current?.click();

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgFile(file);
    if (imgPreview && imgPreview.startsWith("blob:"))
      URL.revokeObjectURL(imgPreview);
    setImgPreview(URL.createObjectURL(file));
    if (plan.imageUrl) onChangePlan("imageUrl", "");
  };

  const showImgFromUrl = () => {
    if (!imgFile) setImgPreview(plan.imageUrl || null);
  };

  // ------- thao tác sessions ----------
  const updateSessionField = (idx, key, value) => {
    setSessions((prev) => {
      const clone = [...prev];
      clone[idx] = { ...clone[idx], [key]: value };
      return clone;
    });
  };

  const addSession = () => {
    setSessions((prev) => [...prev, makeEmptySession()]);
  };

  const removeSession = (idx) => {
    setSessions((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== idx);
    });
  };

  const addExerciseToSession = (sIdx) => {
    setSessions((prev) => {
      const clone = [...prev];
      const s = { ...clone[sIdx] };
      s.items = [
        ...(s.items || []),
        { exerciseId: "", exerciseName: "", repsText: "" },
      ];
      clone[sIdx] = s;
      return clone;
    });
  };

  const removeExerciseFromSession = (sIdx, eIdx) => {
    setSessions((prev) => {
      const clone = [...prev];
      const s = { ...clone[sIdx] };
      if ((s.items || []).length <= 1) return prev;
      s.items = s.items.filter((_, i) => i !== eIdx);
      clone[sIdx] = s;
      return clone;
    });
  };

  const updateExerciseItem = (sIdx, eIdx, patch) => {
    setSessions((prev) => {
      const clone = [...prev];
      const s = { ...clone[sIdx] };
      const items = [...(s.items || [])];
      items[eIdx] = { ...items[eIdx], ...patch };
      s.items = items;
      clone[sIdx] = s;
      return clone;
    });
  };

  // ------- validate ----------
  const validate = () => {
    const errs = { sessions: [] };

    const name = String(plan.name || "").trim();
    if (!name) {
      errs.name = "Vui lòng nhập tên lịch tập gợi ý";
    } else if (name.length > 200) {
      errs.name = "Tên lịch tối đa 200 ký tự";
    } else if (!nameRegex.test(name)) {
      errs.name =
        "Tên chỉ gồm chữ, số, khoảng trắng và ' - . , ( ) / (không dùng ký tự đặc biệt khác)";
    }

    if (!imgFile && !plan.imageUrl) {
      errs.image = "Vui lòng chọn ảnh hoặc dán link hình ảnh";
    }

    const descHtml = String(plan.descriptionHtml || "");
    const plainDesc = descHtml.replace(/<[^>]*>/g, "").trim();
    if (!plainDesc) {
      errs.descriptionHtml = "Vui lòng nhập mô tả lịch tập";
    }

    if (!plan.category) {
      errs.category = "Vui lòng chọn Phân loại lịch tập";
    }
    if (!plan.level) {
      errs.level = "Vui lòng chọn Mức độ";
    }
    if (!plan.goal) {
      errs.goal = "Vui lòng chọn Mục tiêu";
    }

    if (!sessions.length) {
      errs.sessionsGeneral = "Cần ít nhất 1 buổi tập trong lịch";
    }

    errs.sessions = sessions.map((s) => {
      const se = { items: [] };
      const title = String(s.title || "").trim();
      const desc = String(s.description || "");

      if (!title) {
        se.title = "Vui lòng nhập tên buổi tập";
      } else if (title.length > 200) {
        se.title = "Tên buổi tập tối đa 200 ký tự";
      } else if (!nameRegex.test(title)) {
        se.title =
          "Tên buổi tập chỉ gồm chữ, số, khoảng trắng và ' - . , ( ) /";
      }

      if (desc && desc.length > 1000) {
        se.description = "Mô tả buổi tập tối đa 1000 ký tự";
      }

      const itemsErr = (s.items || []).map((it) => {
        const ie = {};
        if (!it.exerciseId) {
          ie.exerciseId = "Vui lòng chọn bài tập";
        }
        const reps = String(it.repsText || "").trim();
        if (!reps) {
          ie.repsText = "Vui lòng nhập Hiệp - Reps";
        } else if (reps.length > 100) {
          ie.repsText = "Hiệp - Reps tối đa 100 ký tự";
        }
        return ie;
      });

      se.items = itemsErr;
      return se;
    });

    const hasTopErr =
      errs.name ||
      errs.image ||
      errs.descriptionHtml ||
      errs.category ||
      errs.level ||
      errs.goal ||
      errs.sessionsGeneral;

    const hasSessionErr = errs.sessions.some((se) => {
      if (se.title || se.description) return true;
      return (se.items || []).some(
        (ie) => ie.exerciseId || ie.repsText
      );
    });

    setErrors(errs);
    return !(hasTopErr || hasSessionErr);
  };

  // ------- submit (create / update) ----------
  const onSubmit = async (e) => {
    e.preventDefault();
    const ok = validate();
    if (!ok) {
      toast.error("Vui lòng kiểm tra lại các dữ liệu nhập.");
      return;
    }

    const name = String(plan.name || "").trim();

    const normalizedSessions = sessions
      .map((s) => {
        const title = String(s.title || "").trim();
        const description = String(s.description || "").trim();
        const exercises = (s.items || [])
          .map((it) => {
            const exerciseId = it.exerciseId;
            const reps = String(it.repsText || "").trim();
            if (!exerciseId || !reps) return null;
            return { exerciseId, reps };
          })
          .filter(Boolean);
        if (!title || !exercises.length) return null;
        return { title, description, exercises };
      })
      .filter(Boolean);

    const payload = {
      name,
      descriptionHtml: plan.descriptionHtml,
      imageUrl: imgFile ? undefined : plan.imageUrl?.trim() || undefined,
      category: plan.category,
      level: plan.level,
      goal: plan.goal,
      sessions: normalizedSessions,
    };

    setSaving(true);
    try {
      if (isEdit) {
        // UPDATE
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
          await updateSuggestPlanApi(id, fd, true);
        } else {
          await updateSuggestPlanApi(id, payload, false);
        }

        toast.success("Cập nhật lịch tập gợi ý thành công!");
        nav("/exercises/suggest-plan", {
          state: { justUpdated: true, updatedId: id },
        });
      } else {
        // CREATE
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
          created = await createSuggestPlanApi(fd, true);
        } else {
          created = await createSuggestPlanApi(payload, false);
        }

        const createdId = created?._id || created?.id;
        toast.success("Tạo lịch tập gợi ý thành công!");
        nav("/exercises/suggest-plan", {
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
    ? "Chỉnh sửa lịch tập gợi ý"
    : "Tạo lịch tập gợi ý";

  return (
    <div className="suggest-plan-create-page">
      {/* Breadcrumb */}
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/">
          <i className="fa-solid fa-house" aria-hidden="true"></i>
          <span>Trang chủ</span>
        </Link>
        <span className="separator">/</span>
        <span className="current-group">
          <i className="fa-solid fa-dumbbell" aria-hidden="true" />
          <span>Quản lý Bài tập</span>
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
              onClick={() => nav("/exercises/suggest-plan")}
            >
              Hủy
            </button>
            <button
              type="submit"
              form="suggest-plan-create-form"
              className="btn primary"
              disabled={saving || loadingDetail}
            >
              {saving
                ? "Đang lưu..."
                : isEdit
                ? "Cập nhật"
                : "Lưu"}
            </button>
          </div>
        </div>

        {isEdit && loadingDetail && (
          <div style={{ padding: "8px 16px", fontSize: 13, color: "#6b7280" }}>
            Đang tải dữ liệu lịch tập...
          </div>
        )}

        <form
          id="suggest-plan-create-form"
          className="sc-form-layout"
          onSubmit={onSubmit}
        >
          {/* LEFT: 1/3 - Thumb ảnh */}
          <div className="sc-layout-left">
            <h3 className="sc-section-title">Ảnh lịch tập</h3>

            <div
              className="sc-image-box"
              role="button"
              tabIndex={0}
              onClick={pickImage}
              onKeyDown={(e) => e.key === "Enter" && pickImage()}
              ref={refImageBox}
            >
              {imgPreview ? (
                <img src={imgPreview} alt="Xem trước" />
              ) : plan.imageUrl ? (
                <img
                  src={plan.imageUrl}
                  alt="Xem trước"
                  onError={() => setImgPreview(null)}
                />
              ) : (
                <div className="sc-placeholder">
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

            <div className="sc-field-title-upl">Link hình ảnh (URL)</div>
            <TextField
              label="Hoặc dán link hình ảnh (URL)"
              value={plan.imageUrl}
              onChange={(e) => {
                if (imgFile) setImgFile(null);
                onChangePlan("imageUrl", e.target.value);
              }}
              onBlur={showImgFromUrl}
              variant="outlined"
              fullWidth
              size="medium"
            />
          </div>

          {/* RIGHT: 2/3 - Thông tin & Lịch tập */}
          <div className="sc-layout-right">
            <h3 className="sc-section-title">Thông tin lịch tập</h3>

            <Box sx={{ display: "flex", flexDirection: "column"}}>
              <div className="sc-field-title">Tên lịch tập gợi ý *</div>
              <TextField 
                  inputRef={refName}
                  label="Tên lịch tập gợi ý *"
                  value={plan.name}
                  onChange={(e) => onChangePlan("name", e.target.value)}
                  error={!!errors.name}
                  helperText={errors.name}
                  fullWidth
              />

              <div className="sp-field-title-desc">
                Mô tả lịch tập *
              </div>
              <RichTextEditorTiptap
                valueHtml={plan.descriptionHtml}
                onChangeHtml={(html) =>
                  onChangePlan("descriptionHtml", html)
                }
                minHeight={200}
              />
              {errors.descriptionHtml && (
                <div className="sc-err-msg">
                  {errors.descriptionHtml}
                </div>
              )}

              <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
                    gap: 2,
                    marginTop: 2,
                    alignItems: "start",
                  }}
                >
                  {/* 1. Phân loại */}
                  <Box>
                    <div className="sc-field-title">Phân loại *</div>
                    <TextField
                      select
                      label="Phân loại *"
                      value={plan.category}
                      onChange={(e) => onChangePlan("category", e.target.value)}
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

                  {/* 2. Mức độ */}
                  <Box>
                    <div className="sc-field-title">Mức độ *</div>
                    <TextField
                      select
                      label="Mức độ *"
                      value={plan.level}
                      onChange={(e) => onChangePlan("level", e.target.value)}
                      error={!!errors.level}
                      helperText={errors.level}
                      fullWidth
                      SelectProps={{
                      MenuProps: {
                        autoFocus: false,
                        MenuListProps: { autoFocusItem: false },
                      },
                    }}
                    >
                      {LEVEL_OPTIONS.map((opt) => (
                        <MenuItem key={opt} value={opt}>
                          {opt}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>

                  {/* 3. Mục tiêu */}
                  <Box>
                    <div className="sc-field-title">Mục tiêu *</div>
                    <TextField
                      select
                      label="Mục tiêu *"
                      value={plan.goal}
                      onChange={(e) => onChangePlan("goal", e.target.value)}
                      error={!!errors.goal}
                      helperText={errors.goal}
                      fullWidth
                      SelectProps={{
                      MenuProps: {
                        autoFocus: false,
                        MenuListProps: { autoFocusItem: false },
                      },
                    }}
                    >
                      {GOAL_OPTIONS.map((opt) => (
                        <MenuItem key={opt} value={opt}>
                          {opt}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Box>
                </Box>
            </Box>

            <hr className="sc-divider" />

            <h3 className="sc-section-title">Lịch tập</h3>
            {errors.sessionsGeneral && (
              <div className="sc-err-msg">
                {errors.sessionsGeneral}
              </div>
            )}

            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 3 }}
            >
              {sessions.map((s, sIdx) => {
                const sErr = errors.sessions?.[sIdx] || {};
                return (
                  <div key={sIdx} className="sp-session-box">
                    <div className="sp-session-head">
                      <div className="sp-session-title sc-section-title">
                        Buổi tập {sIdx + 1}
                      </div>
                      <div className="sp-add-session-wrap">
                        <button
                          type="button"
                          className="sp-session-icon sp-session-add"
                          onClick={() => addExerciseToSession(sIdx)}
                          title="Thêm bài tập"
                        >
                          <i className="fa-solid fa-plus" aria-hidden="true" />
                        </button>

                        {/* Icon Xóa buổi */}
                        <button
                          type="button"
                          className="sp-session-icon sp-session-remove"
                          onClick={() => removeSession(sIdx)}
                          disabled={sessions.length <= 1}
                          title="Xóa buổi tập"
                        >
                          <i className="fa-regular fa-trash-can" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <Box sx={{ display: "grid", gap: 2 }}>
                      <Box>
                        <div className="sc-field-title">
                          Tên buổi tập *
                        </div>
                        <TextField
                          label="Tên buổi tập *"
                          value={s.title}
                          onChange={(e) =>
                            updateSessionField(
                              sIdx,
                              "title",
                              e.target.value
                            )
                          }
                          error={!!sErr.title}
                          helperText={sErr.title}
                          fullWidth
                        />
                      </Box>

                      <Box>
                        <div className="sc-field-title">
                          Mô tả buổi tập
                        </div>
                        <TextField
                          label="Mô tả buổi tập"
                          value={s.description}
                          onChange={(e) =>
                            updateSessionField(
                              sIdx,
                              "description",
                              e.target.value
                            )
                          }
                          error={!!sErr.description}
                          helperText={sErr.description}
                          fullWidth
                          multiline
                          minRows={2}
                          maxRows={4}
                        />
                      </Box>
                    </Box>

                    <div className="sp-exercise-list-title">
                      Danh sách bài tập trong buổi
                    </div>

                    <div className="sp-exercise-list">
                      {s.items.map((it, eIdx) => {
                        const iErr = sErr.items?.[eIdx] || {};
                        const selectedOption =
                          exerciseOptions.find(
                            (o) => o.id === it.exerciseId
                          ) || null;

                        return (
                          <div
                            key={eIdx}
                            className="sp-exercise-item"
                          >
                            <div className="sp-exercise-item-header">
                              <div className="sp-exercise-item-title sc-section-title">
                                Bài tập {eIdx + 1}
                              </div>
                              <button
                                type="button"
                                className="sp-icon-btn"
                                onClick={() =>
                                  removeExerciseFromSession(
                                    sIdx,
                                    eIdx
                                  )
                                }
                                disabled={s.items.length <= 1}
                                title="Xóa bài tập"
                              >
                                <i className="fa-solid fa-xmark" />
                              </button>
                            </div>

                            <div className="sp-exercise-fields">
                              <div className="sp-exercise-col">
                                <div className="sc-field-title">
                                  Chọn bài tập *
                                </div>
                                <Autocomplete
                                  loading={loadingExercises}
                                  options={exerciseOptions}
                                  getOptionLabel={(option) =>
                                    option.label || ""
                                  }
                                  value={selectedOption}
                                  onChange={(e, val) =>
                                    updateExerciseItem(sIdx, eIdx, {
                                      exerciseId: val?.id || "",
                                      exerciseName: val?.label || "",
                                    })
                                  }
                                  renderInput={(params) => (
                                    <TextField
                                      {...params}
                                      label="Chọn bài tập"
                                      placeholder="Tìm theo tên bài tập"
                                      error={!!iErr.exerciseId}
                                      helperText={
                                        iErr.exerciseId
                                      }
                                    />
                                  )}
                                  ListboxProps={{
                                    style: { maxHeight: 280 },
                                  }}
                                />
                              </div>

                              <div className="sp-exercise-col">
                                <div className="sc-field-title">
                                  Hiệp - Reps *
                                </div>
                                <TextField
                                  label="Ví dụ: 4 hiệp x 12 lần"
                                  value={it.repsText}
                                  onChange={(e) =>
                                    updateExerciseItem(sIdx, eIdx, {
                                      repsText: e.target.value,
                                    })
                                  }
                                  error={!!iErr.repsText}
                                  helperText={iErr.repsText}
                                  fullWidth
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              <div>
                <Button variant="outlined" onClick={addSession}>
                  + Thêm buổi tập
                </Button>
              </div>
            </Box>
          </div>
        </form>
      </div>
    </div>
  );
}
