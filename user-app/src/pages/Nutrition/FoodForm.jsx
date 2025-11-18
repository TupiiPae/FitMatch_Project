import { useEffect, useState, useRef } from "react"; // Thêm useRef
import { useNavigate, useParams } from "react-router-dom";
import {
  createFood as createFoodJSON,
  createFoodWithImage,
  updateFood,
  updateFoodWithImage,
  getFood,
  deleteFood
} from "../../api/foods";
import api from "../../lib/api";
import "./FoodForm.css";
import { toast } from "react-toastify";
import { foodValidators } from "../../lib/validators";

const UNIT_OPTIONS = ["g", "ml"];
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => { if (!u) return u; try { return new URL(u, API_ORIGIN).toString(); } catch { return u; } };

export default function FoodForm() {
  const nav = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [loading, setLoading] = useState(!!id);
  const [form, setForm] = useState({
    name: "", massG: "", unit: "g", portionName: "",
    kcal: "", proteinG: "", carbG: "", fatG: "", saltG: "", sugarG: "", fiberG: "",
    // Thêm description (ghi chú) vào state
    description: "", 
  });
  const up = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const [errs, setErrs] = useState({
    name: "", massG: "", kcal: "",
    proteinG: "", carbG: "", fatG: "",
    saltG: "", sugarG: "", fiberG: "",
    global: ""
  });

  // Ảnh
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [existingUrl, setExistingUrl] = useState("");
  const fileInputRef = useRef(null); // Thêm ref cho input file

  const onPickFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f); setPreview(URL.createObjectURL(f));
    setExistingUrl(""); // Xóa ảnh cũ/ảnh URL nếu chọn file mới
  };
  // Bỏ clearThumb vì không còn nút "Xóa ảnh"
  // const clearThumb = () => { if (preview) URL.revokeObjectURL(preview); setFile(null); setPreview(""); };
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // Mở hộp thoại chọn file
  const openFileDialog = () => fileInputRef.current?.click();

  // Load khi sửa
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data } = await getFood(id);
        const f = data || {};
        setForm({
          name: f.name || "", portionName: f.portionName || "",
          massG: f.massG ?? "", unit: f.unit || "g",
          kcal: f.kcal ?? "", proteinG: f.proteinG ?? "", carbG: f.carbG ?? "", fatG: f.fatG ?? "",
          saltG: f.saltG ?? "", sugarG: f.sugarG ?? "", fiberG: f.fiberG ?? "",
          description: f.description || "", // Load description
        });
        setExistingUrl(f.imageUrl || "");
      } catch {
        toast.error("Không tải được dữ liệu món");
      } finally { setLoading(false); }
    })();
  }, [id]);

  // Validate tổng
  const runValidateAll = () => {
    const next = foodValidators.validateAll(form);
    setErrs(next);
    return !Object.values(next).some(Boolean);
  };

  const [msg, setMsg] = useState("");

  async function submit(e) {
    if (e?.preventDefault) e.preventDefault();
    setMsg("");
    setErrs((p) => ({ ...p, global: "" }));

    if (!runValidateAll()) {
      toast.error("Vui lòng kiểm tra lại các trường bắt buộc.");
      return;
    }

    const name = String(form.name || "").trim();
    const unit = form.unit === "ml" ? "ml" : "g";
    const massNum = Number(String(form.massG ?? "").trim());
    const numOrNull = (v) => {
      const s = String(v ?? "").trim(); if (s === "") return null;
      const n = Number(s); return Number.isFinite(n) ? n : null;
    };

    const payload = {
      name, massG: massNum, unit,
      portionName: String(form.portionName || "").trim() || undefined,
      kcal: numOrNull(form.kcal),
      proteinG: numOrNull(form.proteinG),
      carbG: numOrNull(form.carbG),
      fatG: numOrNull(form.fatG),
      saltG: numOrNull(form.saltG),
      sugarG: numOrNull(form.sugarG),
      fiberG: numOrNull(form.fiberG),
      description: String(form.description || "").trim() || undefined, // Thêm description
      ...(isEdit ? {} : { sourceType: "user_submitted" }),
    };

    try {
      if (file) {
        const fd = new FormData(); fd.append("image", file);
        Object.entries(payload).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
        if (isEdit) await updateFoodWithImage(id, fd);
        else await createFoodWithImage(fd);
      } else {
        // Gửi cả existingUrl (nếu không chọn file mới)
        const payloadWithImage = { ...payload, imageUrl: existingUrl || undefined };
        if (isEdit) await updateFood(id, payloadWithImage);
        else await createFoodJSON(payloadWithImage);
      }
      toast.success(isEdit ? "Đã lưu chỉnh sửa" : "Đã gửi yêu cầu. Vui lòng đợi admin duyệt.");
      nav("/dinh-duong/ghi-lai");
    } catch (err) {
      const status = err?.response?.status;
      const data = err?.response?.data || {};
      if (status === 422 && data.errors) {
        const map = data.errors || {};
        setErrs((prev) => ({
          ...prev,
          name: map.name || prev.name,
          massG: map.massG || prev.massG,
          kcal: map.kcal || prev.kcal,
          proteinG: map.proteinG || prev.proteinG,
          carbG: map.carbG || prev.carbG,
          fatG: map.fatG || prev.fatG,
          saltG: map.saltG || prev.saltG,
          sugarG: map.sugarG || prev.sugarG,
          fiberG: map.fiberG || prev.fiberG,
          global: data.message || prev.global
        }));
        toast.error("Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.");
      } else {
        const m = data.message || (isEdit ? "Lưu thất bại" : "Gửi duyệt thất bại");
        setMsg(m); toast.error(m);
      }
    }
  }

  // ===== XÓA MÓN: popup xác nhận (giống RecordMeal) =====
    const [confirmDel, setConfirmDel] = useState({ open: false, name: "" });
    const openConfirmDelete = () => setConfirmDel({ open: true, name: form.name || "" });
    const closeConfirmDelete = () => setConfirmDel({ open: false, name: "" });
    const confirmDeleteNow = async () => {
      try {
        await deleteFood(id);
        toast.success("Đã xóa món");
        closeConfirmDelete();
        nav("/dinh-duong/ghi-lai");
      } catch (e) {
        toast.error(e?.response?.data?.message || "Xóa thất bại");
      }
    };

  if (loading) return <div className="ff-wrap"><div className="muted">Đang tải...</div></div>;

  const currentImageUrl = preview || (existingUrl ? toAbs(existingUrl) : null);

  return (
    <div className="ff-wrap">
      {/* ===== Toolbar (Giữ nguyên) ===== */}
      <div className="ff-toolbar">
        <div className="ff-toolbox">
          <button type="button" className="tool-left" onClick={() => nav(-1)}>
            <i className="fa-solid fa-chevron-left"></i> Quay lại
          </button>
          <div className="tool-mid">
            {isEdit ? "Chỉnh sửa món ăn" : "Tạo món ăn"}
          </div>
          <div className="tool-right">
            {isEdit && (
              <button type="button" className="ff-delete-btn" onClick={openConfirmDelete}>
                Xóa
              </button>
            )}
            <button type="button" className="ff-btn" onClick={submit}>
              {isEdit ? "Lưu" : "Tạo món"}
            </button>
          </div>
        </div>
      </div>
      <hr className="ff-line" />
      {/* ===== (THAY ĐỔI) Layout Form Mới (Giống admin) ===== */}
      <form className="ff-grid-card" onSubmit={submit}>
        
        {/* --- CỘT TRÁI: HÌNH ẢNH --- */}
        <div className="ff-image-col">
          <h3 className="ff-section-title">Hình ảnh món ăn</h3>

          {/* Khung ảnh */}
          <div
            className="ff-image-box"
            role="button"
            tabIndex={0}
            onClick={openFileDialog}
            onKeyDown={(e) => { if (e.key === "Enter") openFileDialog(); }}
          >
            {currentImageUrl ? (
              <img
                src={currentImageUrl}
                alt="Xem trước"
                onError={(e) => { e.currentTarget.src = "/images/food-placeholder.jpg"; }}
              />
            ) : (
              <div className="ff-placeholder">
                <i className="fa-regular fa-image"></i>
                <span>Xem trước hình ảnh (nhấp để chọn)</span>
              </div>
            )}
          </div>

          {/* Input file ẩn */}
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept="image/*"
            onChange={onPickFile}
          />
          
          {/* Input URL (Giống admin) */}
          <div className="ff-field">
            <input
              className="ff-ipt"
              type="url"
              id="food-image-url"
              placeholder=" " 
              value={existingUrl} // Dùng existingUrl
              onChange={(e) => {
                if (file) setFile(null); // Bỏ file nếu gõ URL
                if (preview) URL.revokeObjectURL(preview);
                setPreview("");
                setExistingUrl(e.target.value);
              }}
            />
            <label htmlFor="food-image-url">Hoặc dán Link hình ảnh (URL)</label>
          </div>
        </div>

        {/* --- CỘT PHẢI: THÔNG TIN --- */}
        <div className="ff-fields-col">
          {/* Nhóm thông tin chung */}
          <h3 className="ff-section-title">Thông tin chung</h3>

          <div className={`ff-field ${errs.name ? "is-invalid" : ""}`}>
            <input
              className="ff-ipt"
              id="food-name"
              value={form.name}
              onChange={(e) => up("name", e.target.value)}
              onBlur={() => setErrs(p => ({ ...p, name: foodValidators.name(form.name) }))}
              placeholder=" "
              required
              maxLength={50}
            />
            <label htmlFor="food-name">Tên món ăn <span className="req">*</span></label>
            <div className="error-stack" aria-live="polite">
              {errs.name && <span className="error-item">{errs.name}</span>}
            </div>
          </div>

          <div className="ff-field">
            <input
              className="ff-ipt"
              id="food-portion"
              value={form.portionName}
              onChange={(e) => up("portionName", e.target.value)}
              placeholder=" "
            />
            <label htmlFor="food-portion">Mô tả khẩu phần (VD: 1 phần / 1 lon / 1 lát...)</label>
          </div>

          <div className="ff-fields-grid-2">
            <div className={`ff-field ${errs.massG ? "is-invalid" : ""}`}>
              <input
                className="ff-ipt"
                type="number" min="0" step="1"
                id="food-mass"
                value={form.massG}
                onChange={(e) => up("massG", e.target.value)}
                onBlur={() => setErrs(p => ({ ...p, massG: foodValidators.massG(form.massG) }))}
                placeholder=" "
                required
              />
              <label htmlFor="food-mass">Khối lượng <span className="req">*</span></label>
              <div className="error-stack" aria-live="polite">
                {errs.massG && <span className="error-item">{errs.massG}</span>}
              </div>
            </div>

            <div className="ff-field ff-field-select">
              <label htmlFor="food-unit">Đơn vị</label>
              <select
                id="food-unit"
                className="ff-ipt"
                value={form.unit}
                onChange={(e) => up("unit", e.target.value)}
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
          </div>

          <hr className="ff-divider" />

          {/* Nhóm thông tin dinh dưỡng */}
          <h3 className="ff-section-title">Thông tin dinh dưỡng</h3>

          <div className={`ff-field ${errs.kcal ? "is-invalid" : ""}`}>
            <input
              className="ff-ipt"
              type="number" step="1" min="0"
              id="food-kcal"
              value={form.kcal}
              onChange={(e) => up("kcal", e.target.value)}
              onBlur={() => setErrs(p => ({ ...p, kcal: foodValidators.kcal(form.kcal) }))}
              placeholder=" "
              required
            />
            <label htmlFor="food-kcal">Năng lượng (cal) <span className="req">*</span></label>
            <div className="error-stack" aria-live="polite">
              {errs.kcal && <span className="error-item">{errs.kcal}</span>}
            </div>
          </div>

          <div className="ff-fields-grid-3">
            <div className={`ff-field ${errs.proteinG ? "is-invalid" : ""}`}>
              <input
                className="ff-ipt"
                type="number" step="0.1" min="0"
                id="food-protein"
                value={form.proteinG}
                onChange={(e) => up("proteinG", e.target.value)}
                onBlur={() => setErrs(p => ({ ...p, proteinG: foodValidators.optionalNumber(form.proteinG) }))}
                placeholder=" "
              />
              <label htmlFor="food-protein">Chất đạm (g)</label>
              <div className="error-stack" aria-live="polite">
                {errs.proteinG && <span className="error-item">{errs.proteinG}</span>}
              </div>
            </div>
            <div className={`ff-field ${errs.carbG ? "is-invalid" : ""}`}>
              <input
                className="ff-ipt"
                type="number" step="0.1" min="0"
                id="food-carb"
                value={form.carbG}
                onChange={(e) => up("carbG", e.target.value)}
                onBlur={() => setErrs(p => ({ ...p, carbG: foodValidators.optionalNumber(form.carbG) }))}
                placeholder=" "
              />
              <label htmlFor="food-carb">Đường bột (g)</label>
              <div className="error-stack" aria-live="polite">
                {errs.carbG && <span className="error-item">{errs.carbG}</span>}
              </div>
            </div>
            <div className={`ff-field ${errs.fatG ? "is-invalid" : ""}`}>
              <input
                className="ff-ipt"
                type="number" step="0.1" min="0"
                id="food-fat"
                value={form.fatG}
                onChange={(e) => up("fatG", e.target.value)}
                onBlur={() => setErrs(p => ({ ...p, fatG: foodValidators.optionalNumber(form.fatG) }))}
                placeholder=" "
              />
              <label htmlFor="food-fat">Chất béo (g)</label>
              <div className="error-stack" aria-live="polite">
                {errs.fatG && <span className="error-item">{errs.fatG}</span>}
              </div>
            </div>
          </div>

          <div className="ff-fields-grid-3">
            <div className={`ff-field ${errs.saltG ? "is-invalid" : ""}`}>
              <input
                className="ff-ipt"
                type="number" step="0.1" min="0"
                id="food-salt"
                value={form.saltG}
                onChange={(e) => up("saltG", e.target.value)}
                onBlur={() => setErrs(p => ({ ...p, saltG: foodValidators.optionalNumber(form.saltG) }))}
                placeholder=" "
              />
              <label htmlFor="food-salt">Muối (g)</label>
              <div className="error-stack" aria-live="polite">
                {errs.saltG && <span className="error-item">{errs.saltG}</span>}
              </div>
            </div>
            <div className={`ff-field ${errs.sugarG ? "is-invalid" : ""}`}>
              <input
                className="ff-ipt"
                type="number" step="0.1" min="0"
                id="food-sugar"
                value={form.sugarG}
                onChange={(e) => up("sugarG", e.target.value)}
                onBlur={() => setErrs(p => ({ ...p, sugarG: foodValidators.optionalNumber(form.sugarG) }))}
                placeholder=" "
              />
              <label htmlFor="food-sugar">Đường (g)</label>
              <div className="error-stack" aria-live="polite">
                {errs.sugarG && <span className="error-item">{errs.sugarG}</span>}
              </div>
            </div>
            <div className={`ff-field ${errs.fiberG ? "is-invalid" : ""}`}>
              <input
                className="ff-ipt"
                type="number" step="0.1" min="0"
                id="food-fiber"
                value={form.fiberG}
                onChange={(e) => up("fiberG", e.target.value)}
                onBlur={() => setErrs(p => ({ ...p, fiberG: foodValidators.optionalNumber(form.fiberG) }))}
                placeholder=" "
              />
              <label htmlFor="food-fiber">Chất xơ (g)</label>
              <div className="error-stack" aria-live="polite">
                {errs.fiberG && <span className="error-item">{errs.fiberG}</span>}
              </div>
            </div>
          </div>

          <hr className="ff-divider" />
          
          <h3 className="ff-section-title">Mô tả / Ghi chú</h3>
          
          <div className="ff-field">
            <textarea
              className="ff-textarea"
              id="food-desc"
              value={form.description}
              onChange={(e) => up("description", e.target.value)}
              placeholder=" "
              rows="5"
            ></textarea>
            <label htmlFor="food-desc">Mô tả (không bắt buộc)</label>
          </div>

          {/* Lỗi chung/tin nhắn */}
          <div className="error-stack" aria-live="polite">
            {errs.global && <span className="error-item">{errs.global}</span>}
          </div>
          {msg && <div className="form-msg">{msg}</div>}
        </div>
      </form>

      {/* Popup xác nhận xóa (Giữ nguyên) */}
      {/* ===== Confirm Delete (giống RecordMeal) ===== */}
      {confirmDel.open && (
        <div className="modal" onClick={closeConfirmDelete}>
          <div
            className="modal-card confirm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ff-confirm-del-title"
          >
            <div className="cm-head">
              <div className="cm-icon">
                <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
              </div>
              <h3 id="ff-confirm-del-title">Xóa món ăn?</h3>
            </div>
            <div className="cm-body">
              Bạn chắc chắn muốn xóa <b>{confirmDel.name || "món này"}</b>?<br />
              Thao tác này không thể hoàn tác.
            </div>
            <div className="cm-foot">
              <button className="btn ghost" onClick={closeConfirmDelete}>Hủy</button>
              <button className="btn bad" onClick={confirmDeleteNow}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
