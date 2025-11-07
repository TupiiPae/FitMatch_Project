// admin-app/src/pages/Food_Edit/Food_Edit.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getFood,
  updateFood,
  updateFoodWithImage,
  api, // để lấy baseURL
} from "../../../lib/api.js";
import "../Food_Create/Food_Create.css"; // Dùng chung CSS với Food_Create
import { toast } from "react-toastify";

// (MỚI) Import các component MUI
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";

/* ------- Helpers chung ------- */
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try { return new URL(u, API_ORIGIN).toString(); } catch { return u; }
};
const withBust = (u) => (u ? `${u}${u.includes("?") ? "&" : "?"}v=${Date.now()}` : u);

const initialState = {
  name: "",
  servingDesc: "",
  massG: 100,
  unit: "g",
  imageUrl: "",
  kcal: "",
  proteinG: "",
  carbG: "",
  fatG: "",
  saltG: "",
  sugarG: "",
  fiberG: "",
  description: "",
};

export default function FoodEdit() {
  const { id } = useParams();
  const nav = useNavigate();

  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // (MỚI) Dùng 'errors' state thay cho 'msg'
  const [errors, setErrors] = useState({});

  // ảnh
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  // (MỚI) Thêm Refs cho các trường để cuộn tới khi lỗi
  const refImageBox = useRef(null);
  const refMassG = useRef(null);
  const refKcal = useRef(null);
  const refImgUrl = useRef(null);
  const refDesc = useRef(null);
  const refProtein = useRef(null);
  const refCarb = useRef(null);
  const refFat = useRef(null);

  const onChange = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  // number helpers
  const toNum = (v) => {
    const s = String(v ?? "").trim();
    if (s === "") return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  };
  const toNumOrNull = (v) => {
    const s = String(v ?? "").trim();
    if (s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  // cleanup blob
  useEffect(() => {
    return () => {
      if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // load data
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getFood(id);
        if (!mounted) return;
        setForm({
          name: data?.name ?? "",
          servingDesc: data?.portionName ?? "",
          massG: data?.massG ?? 100,
          unit: data?.unit ?? "g",
          imageUrl: data?.imageUrl ?? "",
          kcal: data?.kcal ?? "",
          proteinG: data?.proteinG ?? "",
          carbG: data?.carbG ?? "",
          fatG: data?.fatG ?? "",
          saltG: data?.saltG ?? "",
          sugarG: data?.sugarG ?? "",
          fiberG: data?.fiberG ?? "",
          description: data?.description ?? "",
        });
        setPreview(data?.imageUrl ? withBust(toAbs(data.imageUrl)) : null);
      } catch (e) {
        // (MỚI) Dùng toast.error thay cho setMsg
        toast.error(e?.response?.data?.message || "Không tải được dữ liệu món ăn.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (preview && preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    if (form.imageUrl) onChange("imageUrl", "");
  };
  const openFile = () => fileRef.current?.click();
  const handleImagePreview = () => {
    if (!file) setPreview(form.imageUrl ? toAbs(form.imageUrl) : null);
  };

  // (MỚI) Hàm cuộn tới lỗi (copy từ Strength_Create)
  const scrollToFirstError = (errs) => {
    const order = [
      ["image", refImageBox],
      ["massG", refMassG],
      ["kcal", refKcal],
      ["imageUrl", refImgUrl],
      ["proteinG", refProtein],
      ["carbG", refCarb],
      ["fatG", refFat],
      ["description", refDesc],
    ];
    const first = order.find(([k]) => errs[k]);
    if (first && first[1]?.current) {
      try {
        first[1].current.scrollIntoView({ behavior: "smooth", block: "center" });
        if (typeof first[1].current.focus === "function") first[1].current.focus();
      } catch {}
    }
  };

  // (MỚI) Cập nhật hàm validate để trả về object 'errs'
  const validate = () => {
    const errs = {};
    // Tên (name) không cần validate vì nó 'disabled'

    // Ảnh: Phải có ảnh (hoặc file, hoặc link)
    if (!file && !form.imageUrl) errs.image = "Vui lòng chọn ảnh hoặc nhập link ảnh";

    const massG = toNum(form.massG);
    if (massG === undefined || massG <= 0) errs.massG = "Khối lượng phải là số dương";

    const kcal = toNum(form.kcal);
    if (kcal === undefined || kcal < 0) errs.kcal = "Vui lòng nhập Calo (kcal) ≥ 0";

    // Kiểm tra các trường số khác (nếu nhập thì phải >= 0)
    if (toNum(form.proteinG) < 0) errs.proteinG = "Giá trị phải ≥ 0";
    if (toNum(form.carbG) < 0) errs.carbG = "Giá trị phải ≥ 0";
    if (toNum(form.fatG) < 0) errs.fatG = "Giá trị phải ≥ 0";
    if (toNum(form.saltG) < 0) errs.saltG = "Giá trị phải ≥ 0";
    if (toNum(form.sugarG) < 0) errs.sugarG = "Giá trị phải ≥ 0";
    if (toNum(form.fiberG) < 0) errs.fiberG = "Giá trị phải ≥ 0";

    setErrors(errs);
    return errs;
  };

  // (MỚI) Cập nhật onSubmit để dùng toast.error và logic 'errs'
  const onSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;

    const errs = validate();
    if (Object.keys(errs).length) {
      toast.error("Vui lòng kiểm tra lại các dữ liệu nhập.");
      scrollToFirstError(errs);
      return;
    }

    setSaving(true);
    
    const payload = {
      // Tên (name) không được gửi đi khi update
      portionName: String(form.servingDesc || "").trim() || undefined,
      massG: toNum(form.massG),
      unit: form.unit === "ml" ? "ml" : "g",
      imageUrl: file ? undefined : (String(form.imageUrl || "").trim() || undefined),
      kcal: toNumOrNull(form.kcal),
      proteinG: toNumOrNull(form.proteinG),
      carbG: toNumOrNull(form.carbG),
      fatG: toNumOrNull(form.fatG),
      saltG: toNumOrNull(form.saltG),
      sugarG: toNumOrNull(form.sugarG),
      fiberG: toNumOrNull(form.fiberG),
      description: String(form.description || "").trim() || undefined,
    };

    try {
      if (file) {
        const fd = new FormData();
        fd.append("image", file);
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== null && v !== undefined && v !== "") fd.append(k, String(v));
        });
        const res = await updateFoodWithImage(id, fd);
        const newUrl = res?.imageUrl || res?.data?.imageUrl;
        if (newUrl) setPreview(withBust(toAbs(newUrl)));
      } else {
        await updateFood(id, payload);
        if (payload.imageUrl) setPreview(withBust(toAbs(payload.imageUrl)));
      }
      toast.success("Chỉnh sửa món ăn thành công!");
      nav("/foods?updated=" + Date.now());
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        (err?.response?.status === 422
          ? "Dữ liệu không hợp lệ."
          : "Có lỗi xảy ra, vui lòng thử lại.");
      toast.error(message);
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // (MỚI) Các helper cho layout (copy từ Strength_Create)
  const menuProps = {
    disableScrollLock: true,
    PaperProps: { sx: { maxHeight: 280, "& ul": { maxHeight: 280 } } },
    MenuListProps: { dense: true },
  };
  const rowGrid2 = {
    display: "grid",
    gap: 2,
    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
    alignItems: "start",
  };
  const rowGrid3 = {
    display: "grid",
    gap: 4,
    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
    alignItems: "start",
  };


  if (loading) {
    return (
      // (MỚI) Dùng class 'strength-create-page'
      <div className="strength-create-page">
        <div className="card"><div style={{ padding: '20px', textAlign: 'center' }}>Đang tải…</div></div>
      </div>
    );
  }

  return (
    // (MỚI) Dùng class 'strength-create-page'
    <div className="strength-create-page">
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/"><i className="fa-solid fa-house" /> <span>Trang chủ</span></Link>
        <span className="separator">/</span>
        <span className="current-group"><i className="fa-solid fa-utensils" /> <span>Quản lý Món ăn</span></span>
        <span className="separator">/</span>
        <span className="current-page">Chỉnh sửa món ăn</span>
      </nav>

      <div className="card">
        <div className="page-head">
          <h2>Chỉnh sửa món ăn</h2>
          <div className="head-actions">
            <button className="btn ghost" type="button" onClick={() => nav(-1)}>
              <span>Hủy</span>
            </button>
            <button className="btn primary" type="submit" form="edit-food-form" disabled={saving}>
              <span>{saving ? "Đang lưu..." : "Lưu thay đổi"}</span>
            </button>
          </div>
        </div>

        {/* (MỚI) Dùng class 'sc-' từ CSS của Strength_Create */}
        <form id="edit-food-form" className="sc-form-layout" onSubmit={onSubmit}>
          {/* Cột trái: ảnh */}
          <div className="sc-layout-left">
            <h3 className="sc-section-title">Hình ảnh món ăn</h3>

            <div
              className="sc-image-box"
              role="button"
              tabIndex={0}
              onClick={openFile}
              onKeyDown={(e) => { if (e.key === "Enter") openFile(); }}
              ref={refImageBox} // (MỚI) Thêm ref
            >
              {preview ? (
                <img src={preview} alt="Xem trước" onError={() => setPreview(null)} />
              ) : (
                <div className="sc-placeholder">
                  <i className="fa-regular fa-image" />
                  <span>Nhấp để chọn ảnh</span>
                </div>
              )}
            </div>

            {/* (MỚI) Hiển thị lỗi ảnh */}
            {errors.image && (
              <FormHelperText error sx={{ ml: "14px", mt: "-8px" }}>
                {errors.image}
              </FormHelperText>
            )}

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={pickFile}
            />

            {/* (MỚI) Dùng TextField của MUI */}
            <div className="sc-field-title-upl">Link hình ảnh (URL)</div>
            <TextField
              inputRef={refImgUrl}
              label="Hoặc dán link hình ảnh (URL)"
              value={form.imageUrl}
              onChange={(e) => { if (file) setFile(null); onChange("imageUrl", e.target.value); }}
              onBlur={handleImagePreview}
              variant="outlined"
              fullWidth
              size="medium"
            />
          </div>

          {/* Cột phải */}
          <div className="sc-layout-right">
            <h3 className="sc-section-title">Thông tin chung</h3>

            {/* (MỚI) Dùng Box sx={rowGrid2} và TextField */}
            <Box sx={rowGrid2}>
              <Box sx={{ gridColumn: { xs: "1", md: "1 / -1"} }}>
                <div className="sc-field-title">Tên món ăn *</div>
                <TextField
                  label="Tên món ăn (không thể chỉnh sửa)"
                  value={form.name}
                  fullWidth
                  disabled
                  readOnly
                />
              </Box>

              <Box sx={{ gridColumn: { xs: "1", md: "1 / -1"} }}>
                <div className="sc-field-title">Mô tả khẩu phần</div>
                <TextField
                  label="Mô tả khẩu phần (ví dụ: 1 đĩa)"
                  value={form.servingDesc}
                  onChange={(e) => onChange("servingDesc", e.target.value)}
                  fullWidth
                />
              </Box>

              <Box>
                <div className="sc-field-title">Khối lượng *</div>
                <TextField
                  inputRef={refMassG}
                  type="number"
                  label="Khối lượng *"
                  value={form.massG}
                  onChange={(e) => onChange("massG", e.target.value)}
                  error={!!errors.massG}
                  helperText={errors.massG}
                  fullWidth
                  inputProps={{ min: 1 }}
                />
              </Box>

              {/* (MỚI) Dùng FormControl và Select */}
              <Box>
                <div className="sc-field-title">Đơn vị *</div>
                <FormControl fullWidth>
                  <InputLabel id="unit-label">Đơn vị *</InputLabel>
                  <Select
                    labelId="unit-label"
                    label="Đơn vị *"
                    value={form.unit}
                    onChange={(e) => onChange("unit", e.target.value)}
                    MenuProps={menuProps}
                  >
                    <MenuItem value="g">g (gram)</MenuItem>
                    <MenuItem value="ml">ml (millilit)</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>

            <hr className="sc-divider" />
            <h3 className="sc-section-title">Thông tin dinh dưỡng</h3>

            <Box>
              <div className="sc-field-title">Calo (kcal) *</div>
              <TextField
                inputRef={refKcal}
                type="number"
                label="Calo (kcal) *"
                value={form.kcal}
                onChange={(e) => onChange("kcal", e.target.value)}
                error={!!errors.kcal}
                helperText={errors.kcal}
                fullWidth
                inputProps={{ step: "0.1", min: 0 }}
              />
            </Box>

            <Box sx={rowGrid3}>
              <Box>
                <div className="sc-field-title">Đạm (g)</div>
                <TextField
                  inputRef={refProtein}
                  type="number"
                  label="Đạm (g)"
                  value={form.proteinG}
                  onChange={(e) => onChange("proteinG", e.target.value)}
                  error={!!errors.proteinG}
                  helperText={errors.proteinG}
                  fullWidth
                  inputProps={{ step: "0.1", min: 0 }}
                />
              </Box>
              <Box>
                <div className="sc-field-title">Đường bột (g)</div>
                <TextField
                  inputRef={refCarb}
                  type="number"
                  label="Đường bột (g)"
                  value={form.carbG}
                  onChange={(e) => onChange("carbG", e.target.value)}
                  error={!!errors.carbG}
                  helperText={errors.carbG}
                  fullWidth
                  inputProps={{ step: "0.1", min: 0 }}
                />
              </Box>
              <Box>
                <div className="sc-field-title">Chất béo (g)</div>
                <TextField
                  inputRef={refFat}
                  type="number"
                  label="Chất béo (g)"
                  value={form.fatG}
                  onChange={(e) => onChange("fatG", e.target.value)}
                  error={!!errors.fatG}
                  helperText={errors.fatG}
                  fullWidth
                  inputProps={{ step: "0.1", min: 0 }}
                />
              </Box>
            </Box>

            <Box sx={rowGrid3}>
              <Box>
                <div className="sc-field-title">Muối (g)</div>
                <TextField
                  type="number"
                  label="Muối (g)"
                  value={form.saltG}
                  onChange={(e) => onChange("saltG", e.target.value)}
                  error={!!errors.saltG}
                  helperText={errors.saltG}
                  fullWidth
                  inputProps={{ step: "0.1", min: 0 }}
                />
              </Box>
              <Box>
                <div className="sc-field-title">Đường (g)</div>
                <TextField
                  type="number"
                  label="Đường (g)"
                  value={form.sugarG}
                  onChange={(e) => onChange("sugarG", e.target.value)}
                  error={!!errors.sugarG}
                  helperText={errors.sugarG}
                  fullWidth
                  inputProps={{ step: "0.1", min: 0 }}
                />
              </Box>
              <Box>
                <div className="sc-field-title">Chất xơ (g)</div>
                <TextField
                  type="number"
                  label="Chất xơ (g)"
                  value={form.fiberG}
                  onChange={(e) => onChange("fiberG", e.target.value)}
                  error={!!errors.fiberG}
                  helperText={errors.fiberG}
                  fullWidth
                  inputProps={{ step: "0.1", min: 0 }}
                />
              </Box>
            </Box>

            <hr className="sc-divider" />
            <h3 className="sc-section-title">Ghi chú / Mô tả chi tiết</h3>
            
            <Box>
              <div className="sc-field-title-descF">Mô tả</div>
              <TextField
                inputRef={refDesc}
                label="Mô tả"
                value={form.description}
                onChange={(e) => onChange("description", e.target.value)}
                multiline
                minRows={10}
                fullWidth
              />
            </Box>
          </div>
        </form>
        
        {/* (MỚI) Bỏ thông báo 'msg' cũ */}
      </div>
    </div>
  );
}