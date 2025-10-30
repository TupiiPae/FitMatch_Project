import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  getFood,
  updateFood,
  updateFoodWithImage,
} from "../../../lib/api.js";
import "../Food_Create/Food_Create.css"; // tái dùng CSS của create
import { toast } from "react-toastify";

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
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ảnh
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const onChange = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  // helpers number
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
        setPreview(data?.imageUrl || null);
      } catch (e) {
        setMsg(e?.response?.data?.message || "Không tải được dữ liệu món ăn.");
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
  const handleImagePreview = () => { if (!file) setPreview(form.imageUrl || null); };

  // validate: KHÔNG cho sửa name → input disabled; vẫn kiểm tra mass/unit/kcal
  const validate = () => {
    const massG = toNum(form.massG);
    if (massG === undefined || massG <= 0) return "Khối lượng phải lớn hơn 0.";
    const unit = form.unit === "ml" ? "ml" : "g";
    if (!["g", "ml"].includes(unit)) return "Đơn vị không hợp lệ.";
    const kcal = toNum(form.kcal);
    if (kcal === undefined || kcal < 0) return "Vui lòng nhập Calo (kcal) ≥ 0.";
    return "";
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    const v = validate();
    if (v) { setMsg(v); return; }

    const payload = {
      // name KHÔNG cho sửa
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
          if (v !== null && v !== undefined) fd.append(k, String(v));
        });
        await updateFoodWithImage(id, fd);
      } else {
        await updateFood(id, payload);
      }
       toast.success("Chỉnh sửa món ăn thành công!");
        nav("/foods");
    } catch (err) {
        const message =
        err?.response?.data?.message ||
        (err?.response?.status === 422
            ? "Dữ liệu không hợp lệ."
            : "Có lỗi xảy ra, vui lòng thử lại.");
        setMsg(message);
        toast.error(message);
        console.error(err);
    } finally {
        setSaving(false);
    }
    };

  if (loading) return <div className="food-create-page"><div className="card"><div className="empty">Đang tải…</div></div></div>;

  return (
    <div className="food-create-page">
      {/* Breadcrumb */}
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/"><i className="fa-solid fa-house" /> <span>Trang chủ</span></Link>
        <span className="separator">/</span>
        <span className="current-group"><i className="fa-solid fa-utensils" /> <span>Quản lý Món ăn</span></span>
        <span className="separator">/</span>
        <span className="current-page">Chỉnh sửa món ăn</span>
      </nav>

      <div className="card">
        {/* Head */}
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

        {/* Form giống create */}
        <form id="edit-food-form" className="fc-form-layout" onSubmit={onSubmit}>
          {/* Cột trái: ảnh */}
          <div className="fc-image-col">
            <h3 className="fc-section-title">Hình ảnh món ăn</h3>

            <div
              className="fc-image-box"
              role="button"
              tabIndex={0}
              onClick={openFile}
              onKeyDown={(e) => { if (e.key === "Enter") openFile(); }}
            >
              {preview ? (
                <img src={preview} alt="Xem trước" onError={() => setPreview(null)} />
              ) : (
                <div className="placeholder">
                  <span>Xem trước hình ảnh (nhấp để chọn)</span>
                </div>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={pickFile}
            />

            <div className="fc-field">
              <input
                type="url"
                id="food-image-url"
                placeholder=" "
                value={form.imageUrl}
                onChange={(e) => { if (file) setFile(null); onChange("imageUrl", e.target.value); }}
                onBlur={handleImagePreview}
              />
              <label htmlFor="food-image-url">Link hình ảnh (URL)</label>
            </div>
          </div>

          {/* Cột phải */}
          <div className="fc-fields-col">
            <h3 className="fc-section-title">Thông tin chung</h3>

            <div className="fc-fields-grid-2">
              {/* Tên món: KHÔNG cho sửa */}
              <div className="fc-field fc-grid-span-2">
                <input id="food-name" value={form.name} placeholder=" " disabled readOnly />
                <label htmlFor="food-name">Tên món ăn (không thể chỉnh sửa)</label>
              </div>

              <div className="fc-field fc-grid-span-2">
                <input
                  id="food-serving"
                  value={form.servingDesc}
                  onChange={(e) => onChange("servingDesc", e.target.value)}
                  placeholder=" "
                />
                <label htmlFor="food-serving">Mô tả khẩu phần (ví dụ: 1 đĩa)</label>
              </div>

              <div className="fc-field">
                <input
                  type="number"
                  id="food-mass"
                  value={form.massG}
                  onChange={(e) => onChange("massG", e.target.value)}
                  required
                  placeholder=" "
                  min="1"
                />
                <label htmlFor="food-mass">Khối lượng (bắt buộc)</label>
              </div>

              <div className="fc-field fc-field-select">
                <select
                  id="food-unit"
                  value={form.unit}
                  onChange={(e) => onChange("unit", e.target.value)}
                >
                  <option value="g">g (gram)</option>
                  <option value="ml">ml (millilit)</option>
                </select>
              </div>
            </div>

            <hr className="fc-divider" />

            <h3 className="fc-section-title">Thông tin dinh dưỡng</h3>

            <div className="fc-field">
              <input
                type="number"
                step="0.1"
                id="food-kcal"
                value={form.kcal}
                onChange={(e) => onChange("kcal", e.target.value)}
                placeholder=" "
                min="0"
                required
              />
              <label htmlFor="food-kcal">Calo (kcal)</label>
            </div>

            <div className="fc-fields-grid-3">
              <div className="fc-field">
                <input
                  type="number" step="0.1" id="food-p"
                  value={form.proteinG} onChange={(e)=>onChange("proteinG", e.target.value)}
                  placeholder=" " min="0"
                />
                <label htmlFor="food-p">Đạm (g)</label>
              </div>
              <div className="fc-field">
                <input
                  type="number" step="0.1" id="food-c"
                  value={form.carbG} onChange={(e)=>onChange("carbG", e.target.value)}
                  placeholder=" " min="0"
                />
                <label htmlFor="food-c">Đường bột (g)</label>
              </div>
              <div className="fc-field">
                <input
                  type="number" step="0.1" id="food-f"
                  value={form.fatG} onChange={(e)=>onChange("fatG", e.target.value)}
                  placeholder=" " min="0"
                />
                <label htmlFor="food-f">Chất béo (g)</label>
              </div>
            </div>

            <div className="fc-fields-grid-3">
              <div className="fc-field">
                <input
                  type="number" step="0.1" id="food-salt"
                  value={form.saltG} onChange={(e)=>onChange("saltG", e.target.value)}
                  placeholder=" " min="0"
                />
                <label htmlFor="food-salt">Muối (g)</label>
              </div>
              <div className="fc-field">
                <input
                  type="number" step="0.1" id="food-sugar"
                  value={form.sugarG} onChange={(e)=>onChange("sugarG", e.target.value)}
                  placeholder=" " min="0"
                />
                <label htmlFor="food-sugar">Đường (g)</label>
              </div>
              <div className="fc-field">
                <input
                  type="number" step="0.1" id="food-fiber"
                  value={form.fiberG} onChange={(e)=>onChange("fiberG", e.target.value)}
                  placeholder=" " min="0"
                />
                <label htmlFor="food-fiber">Chất xơ (g)</label>
              </div>
            </div>

            <hr className="fc-divider" />

            <h3 className="fc-section-title">Ghi chú / Mô tả chi tiết</h3>
            <div className="fc-field">
              <textarea
                id="food-desc"
                className="fc-textarea"
                value={form.description}
                onChange={(e) => onChange("description", e.target.value)}
                placeholder=" "
                rows="5"
              />
              <label htmlFor="food-desc">Mô tả</label>
            </div>
          </div>
        </form>

        {msg && <div className="fc-ok">{msg}</div>}
      </div>
    </div>
  );
}
