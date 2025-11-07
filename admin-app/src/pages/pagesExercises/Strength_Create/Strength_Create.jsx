import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  createExercise,
  createExerciseFile,
  listMuscleGroups,
  listEquipments,
} from "../../../lib/api";
import "./Strength_Create.css";
import { toast } from "react-toastify";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import OutlinedInput from "@mui/material/OutlinedInput";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import FormHelperText from "@mui/material/FormHelperText";

const TYPES = ["Strength", "Cardio", "Sport"];
const EQUIPMENTS_FALLBACK = [
  "Không có","Tạ đòn","Tạ đơn","Máy","Banh","Dây kháng lực","Kettlebell","BOSU","TRX"
];
const MUSCLES_FALLBACK = [
  "Ngực","Lưng","Vai","Bụng","Hông","Đùi trước","Đùi sau","Mông","Bắp chân","Tay trước","Tay sau","Cẳng tay","Cổ","Toàn thân","Core"
];
const LEVELS = ["Cơ bản", "Trung bình", "Nâng cao"];

const init = {
  imageUrl: "",
  videoUrl: "",
  name: "",
  type: "Strength",
  primaryMuscles: [],
  secondaryMuscles: [],
  equipment: "",
  level: "",
  caloriePerRep: "",
  guideHtml: "",
  descriptionHtml: "",
};

export default function StrengthCreate() {
  const nav = useNavigate();

  const [muscleOptions, setMuscleOptions] = useState(MUSCLES_FALLBACK);
  const [equipmentOptions, setEquipmentOptions] = useState(EQUIPMENTS_FALLBACK);

  const [f, setF] = useState(init);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const refName = useRef(null);
  const refImageBox = useRef(null);
  const refCal = useRef(null);
  const refGuide = useRef(null);
  const refDesc = useRef(null);
  const refImgUrl = useRef(null);
  const refVidUrl = useRef(null);

  const imgInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [imgFile, setImgFile] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const [videoFile, setVideoFile] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const resM = await listMuscleGroups().catch(() => null);
        if (resM && Array.isArray(resM) && resM.length) setMuscleOptions(resM);
      } catch {}
      try {
        const resE = await listEquipments().catch(() => null);
        if (resE && Array.isArray(resE) && resE.length) setEquipmentOptions(resE);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (imgPreview && imgPreview.startsWith("blob:")) URL.revokeObjectURL(imgPreview);
    };
  }, [imgPreview]);

  const onChange = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const pickImage = () => imgInputRef.current?.click();
  const pickVideo = () => videoInputRef.current?.click();

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgFile(file);
    if (imgPreview && imgPreview.startsWith("blob:")) URL.revokeObjectURL(imgPreview);
    setImgPreview(URL.createObjectURL(file));
    if (f.imageUrl) onChange("imageUrl", "");
  };

  const onPickVideo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    if (f.videoUrl) onChange("videoUrl", "");
  };

  const showImgFromUrl = () => {
    if (!imgFile) setImgPreview(f.imageUrl || null);
  };

  const scrollToFirstError = (errs) => {
    const order = [
      ["name", refName],
      ["image", refImageBox],
      ["caloriePerRep", refCal],
      ["imageUrl", refImgUrl],
      ["videoUrl", refVidUrl],
      ["guideHtml", refGuide],
      ["descriptionHtml", refDesc],
    ];
    const first = order.find(([k]) => errs[k]);
    if (first && first[1]?.current) {
      try {
        first[1].current.scrollIntoView({ behavior: "smooth", block: "center" });
        if (typeof first[1].current.focus === "function") first[1].current.focus();
      } catch {}
    }
  };

  const validate = () => {
    const errs = {};
    const name = String(f.name || "").trim();
    if (!name) errs.name = "Vui lòng nhập tên bài tập";
    else if (name.length > 100) errs.name = "Tên tối đa 100 ký tự";
    else if (!/^[\p{L}\p{M}\s0-9'’\-.,()\/]+$/u.test(name)) {
      errs.name = "Tên chỉ gồm chữ, số, khoảng trắng và ' - . , ( ) /";
    }

    if (!imgFile && !f.imageUrl) errs.image = "Vui lòng chọn ảnh hoặc nhập link ảnh";
    if (!f.type) errs.type = "Vui lòng chọn phân loại";
    if (!Array.isArray(f.primaryMuscles) || f.primaryMuscles.length === 0) {
      errs.primaryMuscles = "Chọn ít nhất 1 nhóm cơ chính";
    }
    if (!f.equipment) errs.equipment = "Vui lòng chọn dụng cụ";
    if (!f.level) errs.level = "Vui lòng chọn mức độ";

    const cal = String(f.caloriePerRep || "").trim();
    if (!cal) errs.caloriePerRep = "Vui lòng nhập Calorie/rep";
    else if (!/^\d+(\.\d+)?$/.test(cal)) errs.caloriePerRep = "Chỉ nhập số dương (có thể thập phân)";
    else if (cal.length > 10) errs.caloriePerRep = "Tối đa 10 ký tự";

    setErrors(errs);
    return errs;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) {
      toast.error("Vui lòng kiểm tra lại các dữ liệu nhập.");
      scrollToFirstError(errs);
      return;
    }

    setSaving(true);
    const payload = {
      name: String(f.name).trim(),
      type: f.type || "Strength",
      primaryMuscles: f.primaryMuscles,
      secondaryMuscles: f.secondaryMuscles || [],
      equipment: f.equipment,
      level: f.level,
      caloriePerRep: Number(f.caloriePerRep),
      guideHtml: String(f.guideHtml || "").trim() || undefined,
      descriptionHtml: String(f.descriptionHtml || "").trim() || undefined,
      imageUrl: imgFile ? undefined : (f.imageUrl?.trim() || undefined),
      videoUrl: videoFile ? undefined : (f.videoUrl?.trim() || undefined),
      sourceType: "admin_created",
    };

    try {
      let created = null;
      if (imgFile || videoFile) {
        const fd = new FormData();
        if (imgFile) fd.append("image", imgFile);
        if (videoFile) fd.append("video", videoFile);
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined && v !== null) {
            if (Array.isArray(v)) fd.append(k, JSON.stringify(v));
            else fd.append(k, String(v));
          }
        });
        created = await createExerciseFile(fd);
      } else {
        created = await createExercise(payload);
      }

      const createdId = created?._id || created?.id;
      toast.success("Tạo bài tập thành công!");
      nav("/exercises/strength", { state: { justCreated: true, createdId } });
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        (err?.response?.status === 422 ? "Dữ liệu không hợp lệ." : "Lỗi máy chủ, thử lại sau.");
      toast.error(msg);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const menuProps = {
    disableScrollLock: true,
    PaperProps: { sx: { maxHeight: 280, "& ul": { maxHeight: 280 } } },
    MenuListProps: { dense: true },
  };

  const rowGrid2 = {
    display: "grid",
    gap: 4,
    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
    alignItems: "start",
  };
  const rowGrid3 = {
    display: "grid",
    gap: 4,
    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
    alignItems: "start",
  };

  return (
    <div className="strength-create-page">
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
        <span className="current-page">Tạo bài tập</span>
      </nav>

      <div className="card">
        <div className="page-head">
          <h2>Tạo bài tập</h2>
          <div className="head-actions">
            <button type="button" className="btn ghost" onClick={() => nav(-1)}>
              Hủy
            </button>
            <button type="submit" form="strength-create-form" className="btn primary" disabled={saving}>
              {saving ? "Đang lưu..." : "Tạo bài tập"}
            </button>
          </div>
        </div>

        <form id="strength-create-form" className="sc-form-layout" onSubmit={onSubmit}>
          {/* LEFT */}
          <div className="sc-layout-left">
            <h3 className="sc-section-title">Hình ảnh</h3>

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
              ) : f.imageUrl ? (
                <img
                  src={f.imageUrl}
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
              inputRef={refImgUrl}
              label="Hoặc dán link hình ảnh (URL)"
              value={f.imageUrl}
              onChange={(e) => {
                if (imgFile) setImgFile(null);
                onChange("imageUrl", e.target.value);
              }}
              onBlur={showImgFromUrl}
              variant="outlined"
              fullWidth
              size="medium"
            />

            <hr className="sc-divider" />

            <h3 className="sc-section-title">Video hướng dẫn</h3>
            <Box sx={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <Button variant="outlined" onClick={pickVideo} component="label" fullWidth>
                {videoFile ? `Đã chọn: ${videoFile.name}` : "Tải lên file video (MP4, AVI...)"}
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  style={{ display: "none" }}
                  onChange={onPickVideo}
                />
              </Button>

              <div className="sc-field-title-upl">Link video</div>
              <TextField
                inputRef={refVidUrl}
                label="Hoặc dán link video (Youtube, Vimeo...)"
                value={f.videoUrl}
                onChange={(e) => {
                  if (videoFile) setVideoFile(null);
                  onChange("videoUrl", e.target.value);
                }}
                variant="outlined"
                fullWidth
                size="medium"
              />
            </Box>
          </div>

          {/* RIGHT */}
          <div className="sc-layout-right">
            <h3 className="sc-section-title">Thông tin chung</h3>

            {/* Hàng 1: Tên & Phân loại */}
            <Box sx={rowGrid2}>
              <Box>
                <div className="sc-field-title">Tên bài tập *</div>
                <TextField
                  inputRef={refName}
                  label="Tên bài tập *"
                  value={f.name}
                  onChange={(e) => onChange("name", e.target.value)}
                  error={!!errors.name}
                  helperText={errors.name} 
                  fullWidth
                />
              </Box>

              <Box>
                <div className="sc-field-title">Phân loại *</div>
                <FormControl fullWidth error={!!errors.type}>
                  <InputLabel id="type-label">Phân loại *</InputLabel>
                  <Select
                    labelId="type-label"
                    label="Phân loại *"
                    value={f.type}
                    onChange={(e) => onChange("type", e.target.value)}
                    MenuProps={menuProps}
                  >
                    {TYPES.map((t) => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>{errors.type}</FormHelperText> {/* SỬA 2 */}
                </FormControl>
              </Box>
            </Box>

            {/* Hàng 2: Nhóm cơ chính & Nhóm cơ phụ */}
            {/* BỎ mt: 2 Ở DÒNG DƯỚI */}
            <Box sx={rowGrid2}> 
              <Box>
                <div className="sc-field-title">Nhóm cơ chính *</div>
                <FormControl fullWidth error={!!errors.primaryMuscles}>
                  <InputLabel id="pmuscle-label">Nhóm cơ chính *</InputLabel>
                  <Select
                    labelId="pmuscle-label"
                    multiple
                    value={f.primaryMuscles}
                    onChange={(e) => onChange("primaryMuscles", e.target.value)}
                    input={<OutlinedInput label="Nhóm cơ chính *" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {selected.map((val) => (
                          <Chip key={val} label={val} size="small" />
                        ))}
                      </Box>
                    )}
                    MenuProps={menuProps}
                  >
                    {muscleOptions.map((m) => (
                      <MenuItem key={m} value={m}>
                        <Checkbox checked={f.primaryMuscles.indexOf(m) > -1} />
                        <ListItemText primary={m} />
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>{errors.primaryMuscles}</FormHelperText> {/* SỬA 3 */}
                </FormControl>
              </Box>

              <Box>
                <div className="sc-field-title">Nhóm cơ phụ</div>
                <FormControl fullWidth>
                  <InputLabel id="smuscle-label">Nhóm cơ phụ</InputLabel>
                  <Select
                    labelId="smuscle-label"
                    multiple
                    value={f.secondaryMuscles}
                    onChange={(e) => onChange("secondaryMuscles", e.target.value)}
                    input={<OutlinedInput label="Nhóm cơ phụ" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {selected.map((val) => (
                          <Chip key={val} label={val} size="small" />
                        ))}
                      </Box>
                    )}
                    MenuProps={menuProps}
                  >
                    {muscleOptions.map((m) => (
                      <MenuItem key={m} value={m}>
                        <Checkbox checked={f.secondaryMuscles.indexOf(m) > -1} />
                        <ListItemText primary={m} />
                      </MenuItem>
                    ))}
                  </Select>
                  {/* SỬA 4 (Không cần helper text ở đây nếu không có lỗi) */}
                  {/* <FormHelperText>{" "}</FormHelperText> */} 
                </FormControl>
              </Box>
            </Box>

            {/* Hàng 3: Dụng cụ – Mức độ – Calorie/rep */}
            {/* BỎ mt: 2 Ở DÒNG DƯỚI */}
            <Box sx={rowGrid3}>
              <Box>
                <div className="sc-field-title">Dụng cụ *</div>
                <FormControl fullWidth error={!!errors.equipment}>
                  <InputLabel id="equip-label">Dụng cụ *</InputLabel>
                  <Select
                    labelId="equip-label"
                    label="Dụng cụ *"
                    value={f.equipment}
                    onChange={(e) => onChange("equipment", e.target.value)}
                    MenuProps={menuProps}
                  >
                    {equipmentOptions.map((eq) => (
                      <MenuItem key={eq} value={eq}>{eq}</MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>{errors.equipment}</FormHelperText> {/* SỬA 5 */}
                </FormControl>
              </Box>

              <Box>
                <div className="sc-field-title">Mức độ *</div>
                <FormControl fullWidth error={!!errors.level}>
                  <InputLabel id="level-label">Mức độ *</InputLabel>
                  <Select
                    labelId="level-label"
                    label="Mức độ *"
                    value={f.level}
                    onChange={(e) => onChange("level", e.target.value)}
                    MenuProps={menuProps}
                  >
                    {LEVELS.map((lv) => (
                      <MenuItem key={lv} value={lv}>{lv}</MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>{errors.level}</FormHelperText> {/* SỬA 6 */}
                </FormControl>
              </Box>

              <Box>
                <div className="sc-field-title">Calorie/rep *</div>
                <TextField
                  label="Calorie/rep *"
                  value={f.caloriePerRep}
                  onChange={(e) => onChange("caloriePerRep", e.target.value)}
                  error={!!errors.caloriePerRep}
                  helperText={errors.caloriePerRep}
                  fullWidth
                  inputRef={refCal}
                />
              </Box>
            </Box>

            <hr className="sc-divider" />

            <h3 className="sc-section-title">Mô tả</h3>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2}}>
              <div className="sc-field-title-desc">Hướng dẫn tập luyện</div>
              <TextField
                label="Hướng dẫn tập luyện"
                value={f.guideHtml}
                onChange={(e) => onChange("guideHtml", e.target.value)}
                multiline
                minRows={10}
                fullWidth
                inputRef={refGuide}
              />

              <div className="sc-field-title-desc">Mô tả bài tập</div>
              <TextField
                label="Mô tả bài tập"
                value={f.descriptionHtml}
                onChange={(e) => onChange("descriptionHtml", e.target.value)}
                multiline
                minRows={10}
                fullWidth
                inputRef={refDesc}
              />
            </Box>
          </div>
        </form>
      </div>
    </div>
  );
}
