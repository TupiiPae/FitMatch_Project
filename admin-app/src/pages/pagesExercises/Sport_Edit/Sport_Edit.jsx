// admin-app/src/pages/pagesExercises/Sport_Edit/Sport_Edit.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getExercise,
  updateExercise,
  listMuscleGroups,
  listEquipments,
  api,
} from "../../../lib/api";
import "../Sport_Create/Sport_Create.css";
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

import RichTextEditorTiptap from "../../../components/Editor/RichTextEditorTiptap";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => { if (!u) return u; try { return new URL(u, API_ORIGIN).toString(); } catch { return u; } };

const TYPES = ["Strength", "Cardio", "Sport"];
const EQUIPMENTS_FALLBACK = ["Không có","Tạ đòn","Tạ đơn","Dây cáp","Máy","Banh","Dây kháng lực","Kettlebell","BOSU","TRX"];
const MUSCLES_FALLBACK = ["Ngực","Lưng","Vai","Bụng","Hông","Đùi trước","Đùi sau","Mông","Bắp chân","Tay trước","Tay sau","Cẳng tay","Cổ","Toàn thân","Core"];
const LEVELS = ["Cơ bản", "Trung bình", "Nâng cao"];

const init = {
  imageUrl: "",
  name: "",
  type: "Sport",
  primaryMuscles: [],
  secondaryMuscles: [],
  equipment: "",
  level: "",
  caloriePerRep: "",
  descriptionHtml: "",
};

export default function SportEdit() {
  const { id } = useParams();
  const nav = useNavigate();

  const [muscleOptions, setMuscleOptions] = useState(MUSCLES_FALLBACK);
  const [equipmentOptions, setEquipmentOptions] = useState(EQUIPMENTS_FALLBACK);

  const [f, setF] = useState(init);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const refName = useRef(null);
  const refImageBox = useRef(null);
  const refCal = useRef(null);
  const refImgUrl = useRef(null);

  const imgInputRef = useRef(null);
  const [imgFile, setImgFile] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);

  const onChange = (k, v) => setF((s) => ({ ...s, [k]: v }));

  // options (alive-guard)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const resM = await listMuscleGroups().catch(() => null);
        if (alive && resM?.length) setMuscleOptions(resM);
      } catch {}
      try {
        const resE = await listEquipments().catch(() => null);
        if (alive && resE?.length) setEquipmentOptions(resE);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  // preload data (alive-guard)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await getExercise(id);
        if (!alive) return;
        const filled = {
          ...init,
          ...data,
          primaryMuscles: data?.primaryMuscles || [],
          secondaryMuscles: data?.secondaryMuscles || [],
          imageUrl: data?.imageUrl || "",
          descriptionHtml: data?.descriptionHtml || "",
        };
        setF(filled);
        if (filled.imageUrl) setImgPreview(toAbs(filled.imageUrl));
      } catch (e) {
        if (alive) {
          toast.error("Không tải được dữ liệu môn thể thao.");
          console.error(e);
        }
      }
    })();
    return () => { alive = false; };
  }, [id]);

  // cleanup preview
  useEffect(() => {
    return () => { if (imgPreview && String(imgPreview).startsWith("blob:")) URL.revokeObjectURL(imgPreview); };
  }, [imgPreview]);

  const pickImage = () => imgInputRef.current?.click();

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgFile(file);
    if (imgPreview && String(imgPreview).startsWith("blob:")) URL.revokeObjectURL(imgPreview);
    setImgPreview(URL.createObjectURL(file));
    if (f.imageUrl) onChange("imageUrl", "");
  };

  const showImgFromUrl = () => { if (!imgFile) setImgPreview(toAbs(f.imageUrl || null)); };

  const validate = () => {
    const errs = {};
    if (!imgFile && !f.imageUrl) errs.image = "Vui lòng chọn ảnh hoặc nhập link ảnh";
    if (!f.type) errs.type = "Vui lòng chọn phân loại";
    if (!Array.isArray(f.primaryMuscles) || f.primaryMuscles.length === 0) errs.primaryMuscles = "Chọn ít nhất 1 nhóm cơ chính";
    if (!f.equipment) errs.equipment = "Vui lòng chọn dụng cụ";
    if (!f.level) errs.level = "Vui lòng chọn mức độ";

    const cal = String(f.caloriePerRep || "").trim();
    if (!cal) errs.caloriePerRep = "Vui lòng nhập giá trị MET";
    else if (!/^\d+(\.\d+)?$/.test(cal)) errs.caloriePerRep = "Chỉ nhập số dương (có thể thập phân)";
    else if (cal.length > 10) errs.caloriePerRep = "Tối đa 10 ký tự";

    const name = String(f.name || "").trim();
    if (!name) errs.name = "Vui lòng nhập tên môn";
    else if (name.length > 100) errs.name = "Tên tối đa 100 ký tự";

    setErrors(errs);
    return errs;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { toast.error("Vui lòng kiểm tra lại các dữ liệu nhập."); return; }

    setSaving(true);
    const payload = {
      type: f.type || "Sport",
      primaryMuscles: f.primaryMuscles,
      secondaryMuscles: f.secondaryMuscles || [],
      equipment: f.equipment,
      level: f.level,
      caloriePerRep: Number(f.caloriePerRep),
      descriptionHtml: String(f.descriptionHtml || "").trim() || undefined,
      imageUrl: imgFile ? undefined : (f.imageUrl?.trim() || undefined),
    };

    try {
      if (imgFile) {
        const fd = new FormData();
        fd.append("image", imgFile);
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined && v !== null) {
            if (Array.isArray(v)) fd.append(k, JSON.stringify(v));
            else fd.append(k, String(v));
          }
        });
        await updateExercise(id, fd, true);
      } else {
        await updateExercise(id, payload, false);
      }

      toast.success("Cập nhật môn thể thao thành công!");
      nav("/exercises/sport");
    } catch (err) {
      let msg = err?.response?.data?.message;
      if (!msg) {
        if (err?.response?.status === 413) msg = "File quá lớn.";
        else if (err?.response?.status === 422) msg = "Dữ liệu không hợp lệ.";
        else msg = "Lỗi máy chủ, thử lại sau.";
      }
      toast.error(msg);
      console.error(err);
    } finally { setSaving(false); }
  };

  const menuProps = {
    disableScrollLock: true,
    PaperProps: { sx: { maxHeight: 280, "& ul": { maxHeight: 280 } } },
    MenuListProps: { dense: true },
  };

  const rowGrid2 = { display: "grid", gap: 4, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } };
  const rowGrid3 = { display: "grid", gap: 4, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" } };

  return (
    <div className="strength-create-page">
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/"><i className="fa-solid fa-house" /><span>Trang chủ</span></Link>
        <span className="separator">/</span>
        <span className="current-group"><i className="fa-solid fa-football" /><span>Quản lý Bài tập</span></span>
        <span className="separator">/</span>
        <span className="current-page">Chỉnh sửa môn thể thao (Sport)</span>
      </nav>

      <div className="card">
        <div className="page-head">
          <h2>Chỉnh sửa môn thể thao (Sport)</h2>
          <div className="head-actions">
            <button type="button" className="btn ghost" onClick={() => nav(-1)}>Hủy</button>
            <button type="submit" form="sport-edit-form" className="btn primary" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </div>

        <form id="sport-edit-form" className="sc-form-layout" onSubmit={onSubmit}>
          <div className="sc-layout-left">
            <h3 className="sc-section-title">Hình ảnh</h3>

            <div className="sc-image-box" role="button" tabIndex={0} onClick={pickImage} ref={refImageBox}>
              {imgPreview ? <img src={toAbs(imgPreview)} alt="Xem trước" />
                : f.imageUrl ? <img src={toAbs(f.imageUrl)} alt="Xem trước" />
                : <div className="sc-placeholder"><i className="fa-regular fa-image" /><span>Nhấp để chọn ảnh</span></div>}
            </div>
            {errors.image && <FormHelperText error sx={{ ml: "14px", mt: "-8px" }}>{errors.image}</FormHelperText>}

            <input ref={imgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPickImage} />

            <div className="sc-field-title-upl">Link hình ảnh (URL)</div>
            <TextField
              inputRef={refImgUrl}
              label="Hoặc dán link hình ảnh (URL)"
              value={f.imageUrl}
              onChange={(e) => { if (imgFile) setImgFile(null); onChange("imageUrl", e.target.value); }}
              onBlur={showImgFromUrl}
              variant="outlined"
              fullWidth
              size="medium"
            />
          </div>

          <div className="sc-layout-right">
            <h3 className="sc-section-title">Thông tin chung</h3>

            <Box sx={rowGrid2}>
              <Box>
                <div className="sc-field-title">Tên môn *</div>
                <TextField
                  inputRef={refName}
                  label="Tên môn *"
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
                  <Select labelId="type-label" label="Phân loại *" value={f.type} onChange={(e) => onChange("type", e.target.value)} MenuProps={menuProps}>
                    {TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                  <FormHelperText>{errors.type}</FormHelperText>
                </FormControl>
              </Box>
            </Box>

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
                        {selected.map((val) => <Chip key={val} label={val} size="small" />)}
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
                  <FormHelperText>{errors.primaryMuscles}</FormHelperText>
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
                        {selected.map((val) => <Chip key={val} label={val} size="small" />)}
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
                </FormControl>
              </Box>
            </Box>

            <Box sx={rowGrid3}>
              <Box>
                <div className="sc-field-title">Dụng cụ *</div>
                <FormControl fullWidth error={!!errors.equipment}>
                  <InputLabel id="equip-label">Dụng cụ *</InputLabel>
                  <Select labelId="equip-label" label="Dụng cụ *" value={f.equipment} onChange={(e) => onChange("equipment", e.target.value)} MenuProps={menuProps}>
                    {equipmentOptions.map((eq) => <MenuItem key={eq} value={eq}>{eq}</MenuItem>)}
                  </Select>
                  <FormHelperText>{errors.equipment}</FormHelperText>
                </FormControl>
              </Box>

              <Box>
                <div className="sc-field-title">Mức độ *</div>
                <FormControl fullWidth error={!!errors.level}>
                  <InputLabel id="level-label">Mức độ *</InputLabel>
                  <Select labelId="level-label" label="Mức độ *" value={f.level} onChange={(e) => onChange("level", e.target.value)} MenuProps={menuProps}>
                    {LEVELS.map((lv) => <MenuItem key={lv} value={lv}>{lv}</MenuItem>)}
                  </Select>
                  <FormHelperText>{errors.level}</FormHelperText>
                </FormControl>
              </Box>

              <Box>
                <div className="sc-field-title">Giá trị MET *</div>
                <TextField
                  label="Giá trị MET *"
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
            <h3 className="sc-section-title">Mô tả môn thể thao</h3>
            <RichTextEditorTiptap
              valueHtml={f.descriptionHtml}
              onChangeHtml={(html) => onChange("descriptionHtml", html)}
              minHeight={260}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
