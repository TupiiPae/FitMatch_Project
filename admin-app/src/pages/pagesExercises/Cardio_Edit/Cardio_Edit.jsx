import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getExercise, updateExercise, listMuscleGroups, listEquipments,
  uploadExerciseVideoApi, removeExerciseVideoApi, api
} from "../../../lib/api";
import "../Cardio_Create/Cardio_Create.css";
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

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => { if (!u) return u; try { return new URL(u, API_ORIGIN).toString(); } catch { return u; } };

const TYPES = ["Strength", "Cardio", "Sport"];
const EQUIPMENTS_FALLBACK = ["Không có","Tạ đòn","Tạ đơn","Máy","Banh","Dây kháng lực","Kettlebell","BOSU","TRX"];
const MUSCLES_FALLBACK = ["Ngực","Lưng","Vai","Bụng","Hông","Đùi trước","Đùi sau","Mông","Bắp chân","Tay trước","Tay sau","Cẳng tay","Cổ","Toàn thân","Core"];
const LEVELS = ["Cơ bản", "Trung bình", "Nâng cao"];

const init = {
  imageUrl: "",
  videoUrl: "",
  name: "",
  type: "Cardio",
  primaryMuscles: [],
  secondaryMuscles: [],
  equipment: "",
  level: "",
  caloriePerRep: "",
  guideHtml: "",
  descriptionHtml: "",
};

export default function Cardio_Edit() {
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
  const refGuide = useRef(null);
  const refDesc = useRef(null);
  const refImgUrl = useRef(null);
  const refVidUrl = useRef(null);

  const imgInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [imgFile, setImgFile] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);
  const [videoFile, setVideoFile] = useState(null);

  const onChange = (k, v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    (async () => {
      try { const resM = await listMuscleGroups().catch(() => null); if (resM?.length) setMuscleOptions(resM); } catch {}
      try { const resE = await listEquipments().catch(() => null); if (resE?.length) setEquipmentOptions(resE); } catch {}
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await getExercise(id);
        const filled = { ...init, ...data,
          primaryMuscles: data?.primaryMuscles || [],
          secondaryMuscles: data?.secondaryMuscles || [],
          imageUrl: data?.imageUrl || "",
          videoUrl: data?.videoUrl || "",
        };
        setF(filled);
        if (filled.imageUrl) setImgPreview(toAbs(filled.imageUrl));
      } catch (e) {
        toast.error("Không tải được dữ liệu bài tập.");
        console.error(e);
      }
    })();
  }, [id]);

  useEffect(() => () => { if (imgPreview && String(imgPreview).startsWith("blob:")) URL.revokeObjectURL(imgPreview); }, [imgPreview]);

  const pickImage = () => imgInputRef.current?.click();
  const pickVideo = () => videoInputRef.current?.click();

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgFile(file);
    if (imgPreview && String(imgPreview).startsWith("blob:")) URL.revokeObjectURL(imgPreview);
    setImgPreview(URL.createObjectURL(file));
    if (f.imageUrl) onChange("imageUrl", "");
  };

  const onPickVideo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoFile(file);
    if (f.videoUrl) onChange("videoUrl", "");
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

    setErrors(errs); return errs;
  };

  const handleRemoveVideo = async () => {
    try {
      await removeExerciseVideoApi(id);
      setF((s) => ({ ...s, videoUrl: "" }));
      toast.success("Đã gỡ video khỏi bài tập");
    } catch (err) {
      const msg = err?.response?.data?.message || "Không gỡ được video";
      toast.error(msg);
      console.error(err);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { toast.error("Vui lòng kiểm tra lại các dữ liệu nhập."); return; }

    setSaving(true);
    const payload = {
      type: f.type || "Cardio",
      primaryMuscles: f.primaryMuscles,
      secondaryMuscles: f.secondaryMuscles || [],
      equipment: f.equipment,
      level: f.level,
      caloriePerRep: Number(f.caloriePerRep),
      guideHtml: String(f.guideHtml || "").trim() || undefined,
      descriptionHtml: String(f.descriptionHtml || "").trim() || undefined,
      imageUrl: imgFile ? undefined : (f.imageUrl?.trim() || undefined),
      videoUrl: videoFile ? undefined : (f.videoUrl?.trim() || undefined),
    };

    try {
      let updated = null;
      if (imgFile) {
        const fd = new FormData();
        fd.append("image", imgFile);
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== undefined && v !== null) fd.append(k, Array.isArray(v) ? JSON.stringify(v) : String(v));
        });
        updated = await updateExercise(id, fd, true);
      } else {
        updated = await updateExercise(id, payload, false);
      }

      if (videoFile) {
        try {
          const newUrl = await uploadExerciseVideoApi(id, videoFile);
          setF((s) => ({ ...s, videoUrl: newUrl || s.videoUrl }));
        } catch (e) {
          console.error("Upload video fail:", e);
          toast.warning("Đã lưu thông tin, nhưng upload video thất bại. Bạn có thể thử lại sau.");
        }
      }

      toast.success("Cập nhật bài tập thành công!");
      nav("/exercises/cardio");
    } catch (err) {
      let msg = err?.response?.data?.message;
      if (!msg) msg = err?.response?.status === 413 ? "File quá lớn." : (err?.response?.status === 422 ? "Dữ liệu không hợp lệ." : "Lỗi máy chủ, thử lại sau.");
      toast.error(msg);
      console.error(err);
    } finally { setSaving(false); }
  };

  const menuProps = { disableScrollLock: true, PaperProps: { sx: { maxHeight: 280, "& ul": { maxHeight: 280 } } }, MenuListProps: { dense: true } };
  const rowGrid2 = { display: "grid", gap: 4, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } };
  const rowGrid3 = { display: "grid", gap: 4, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" } };

  return (
    <div className="strength-create-page">
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/"><i className="fa-solid fa-house" /><span>Trang chủ</span></Link>
        <span className="separator">/</span>
        <span className="current-group"><i className="fa-solid fa-person-running" /><span>Quản lý Bài tập</span></span>
        <span className="separator">/</span>
        <span className="current-page">Chỉnh sửa bài tập (Cardio)</span>
      </nav>

      <div className="card">
        <div className="page-head">
          <h2>Chỉnh sửa bài tập (Cardio)</h2>
          <div className="head-actions">
            <button type="button" className="btn ghost" onClick={() => nav(-1)}>Hủy</button>
            <button type="submit" form="cardio-edit-form" className="btn primary" disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </div>

        <form id="cardio-edit-form" className="sc-form-layout" onSubmit={onSubmit}>
          <div className="sc-layout-left">
            <h3 className="sc-section-title">Hình ảnh</h3>

            <div className="sc-image-box" role="button" tabIndex={0} onClick={pickImage} ref={refImageBox}>
              {imgPreview ? <img src={toAbs(imgPreview)} alt="Xem trước" />
                : f.imageUrl ? <img src={toAbs(f.imageUrl)} alt="Xem trước" />
                : <div className="sc-placeholder"><i className="fa-regular fa-image" /><span>Nhấp để chọn ảnh</span></div>}
            </div>
            {errors.image && <FormHelperText error sx={{ ml: "14px", mt: "-8px" }}>{errors.image}</FormHelperText>}

            <input ref={imgInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPickImage} />

            <div className="sc-field-title">Link hình ảnh (URL)</div>
            <TextField inputRef={refImgUrl} label="Hoặc dán link hình ảnh (URL)" value={f.imageUrl} onChange={(e) => { if (imgFile) setImgFile(null); onChange("imageUrl", e.target.value); }} onBlur={showImgFromUrl} variant="outlined" fullWidth size="medium" />

            <hr className="sc-divider" />
            <h3 className="sc-section-title-upl">Video hướng dẫn</h3>
            <Box sx={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <Button variant="outlined" onClick={pickVideo} component="label" fullWidth>
                {videoFile ? `Đã chọn: ${videoFile.name}` : "Tải lên file video (Tối đa 50MB)"}
                <input ref={videoInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={onPickVideo} />
              </Button>

              <div className="sc-field-title-upl">Link video</div>
              <TextField inputRef={refVidUrl} label="Hoặc dán link video (URL)" value={f.videoUrl} onChange={(e) => { if (videoFile) setVideoFile(null); onChange("videoUrl", e.target.value); }} variant="outlined" fullWidth size="medium" />

              <Box sx={{ display: "flex", gap: 1 }}>
                <Button variant="outlined" color="error" onClick={handleRemoveVideo} disabled={!f.videoUrl}>
                  Gỡ video
                </Button>
                {(f.videoUrl || videoFile) && (
                  <span style={{ alignSelf: "center", opacity: 0.75 }}>
                    {videoFile ? "Sẽ thay bằng video mới sau khi lưu." : f.videoUrl ? "Video hiện có sẽ bị xoá." : ""}
                  </span>
                )}
              </Box>
            </Box>
          </div>

          <div className="sc-layout-right">
            <h3 className="sc-section-title">Thông tin chung</h3>

            <Box sx={rowGrid2}>
              <Box>
                <div className="sc-field-title">Tên bài tập *</div>
                <TextField inputRef={refName} label="Tên bài tập *" value={f.name} disabled fullWidth />
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
                <div className="sc-field-title">Giá trị MET</div>
                <TextField label="Giá trị MET" value={f.caloriePerRep} onChange={(e) => onChange("caloriePerRep", e.target.value)} error={!!errors.caloriePerRep} helperText={errors.caloriePerRep} fullWidth inputRef={refCal} />
              </Box>
            </Box>

            <hr className="sc-divider" />
            <h3 className="sc-section-title">Mô tả</h3>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="sc-field-title-desc">Hướng dẫn tập luyện</div>
              <TextField label="Hướng dẫn tập luyện" value={f.guideHtml} onChange={(e) => onChange("guideHtml", e.target.value)} multiline minRows={10} fullWidth inputRef={refGuide} />

              <div className="sc-field-title-desc">Mô tả bài tập</div>
              <TextField label="Mô tả bài tập" value={f.descriptionHtml} onChange={(e) => onChange("descriptionHtml", e.target.value)} multiline minRows={10} fullWidth inputRef={refDesc} />
            </Box>
          </div>
        </form>
      </div>
    </div>
  );
}
