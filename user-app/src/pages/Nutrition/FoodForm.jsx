import { useEffect, useState } from "react";
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

  const onPickFile = (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f); setPreview(URL.createObjectURL(f));
  };
  const clearThumb = () => { if (preview) URL.revokeObjectURL(preview); setFile(null); setPreview(""); };
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

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
      ...(isEdit ? {} : { sourceType: "user_submitted" }),
    };

    try {
      if (file) {
        const fd = new FormData(); fd.append("image", file);
        Object.entries(payload).forEach(([k, v]) => { if (v !== null && v !== undefined) fd.append(k, String(v)); });
        if (isEdit) await updateFoodWithImage(id, fd);
        else await createFoodWithImage(fd);
      } else {
        if (isEdit) await updateFood(id, payload);
        else await createFoodJSON(payload);
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

  // Xóa món (giữ logic cũ)
  const [confirmDel, setConfirmDel] = useState(false);
  const onConfirmDelete = async () => {
    try {
      await deleteFood(id);
      toast.success("Đã xóa món");
      setConfirmDel(false);
      nav("/dinh-duong/ghi-lai");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Xóa thất bại");
    }
  };

  if (loading) return <div className="ff-wrap"><div className="muted">Đang tải...</div></div>;

  return (
    <div className="ff-wrap">
      {/* ===== Toolbar ===== */}
      <div className="ff-toolbar">
        <div className="ff-toolbox">
          <button type="button" className="tool-left" onClick={() => nav(-1)}>
            <i className="fa-solid fa-chevron-left"></i> Quay lại
          </button>

          <div className="tool-right">
            {isEdit && (
              <button type="button" className="btn ghost danger" onClick={() => setConfirmDel(true)}>
                Xóa
              </button>
            )}
            <button type="button" className="btn primary" onClick={submit}>
              {isEdit ? "Lưu" : "Tạo món"}
            </button>
          </div>
        </div>
      </div>

      {/* ===== 2 columns: Trái form – Phải ảnh ===== */}
      <form className="ff-grid" onSubmit={submit}>
        {/* LEFT: card điền thông tin */}
        <section className="ff-left">
          {/* Tên món ăn */}
          <div className="card">
            <div className="sec-title">Tên món ăn <span className="req">*</span></div>
            <input
              className={`ipt ${errs.name ? "input-invalid" : ""}`}
              value={form.name}
              onChange={(e) => up("name", e.target.value)}
              onBlur={() => setErrs(p => ({ ...p, name: foodValidators.name(form.name) }))}
              placeholder="VD: Ức gà áp chảo"
              required
              maxLength={50}
            />
            <div className="error-stack" aria-live="polite">
              {errs.name && <span className="error-item">{errs.name}</span>}
            </div>

            <div className="sep" />

            {/* Thông tin chung */}
            <div className="sec-title">Thông tin chung</div>
            <div className="row">
              <label>Khẩu phần (tùy chọn)</label>
              <input
                className="ipt"
                value={form.portionName}
                onChange={(e) => up("portionName", e.target.value)}
                placeholder="VD: 1 phần / 1 lon / 1 lát..."
              />
            </div>

            <div className="row two">
              <div>
                <label>Khối lượng <span className="req">*</span></label>
                <input
                  className={`ipt ${errs.massG ? "input-invalid" : ""}`}
                  type="number" min="0" step="1"
                  value={form.massG}
                  onChange={(e) => up("massG", e.target.value)}
                  onBlur={() => setErrs(p => ({ ...p, massG: foodValidators.massG(form.massG) }))}
                  placeholder="VD: 100"
                  required
                />
                <div className="error-stack" aria-live="polite">
                  {errs.massG && <span className="error-item">{errs.massG}</span>}
                </div>
              </div>
              <div className="unit-select">
                <label>Đơn vị <span className="req">*</span></label>
                <div className="unit-toggle">
                  {UNIT_OPTIONS.map((u) => (
                    <button
                      key={u}
                      type="button"
                      className={`unit ${form.unit === u ? "on" : ""}`}
                      onClick={() => up("unit", u)}
                    >
                      {u.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="sep" />

            {/* Thông tin giá trị đa lượng */}
            <div className="sec-title">Thông tin giá trị đa lượng</div>

            <div className="row">
              <label>Năng lượng (cal) <span className="req">*</span></label>
              <input
                className={`ipt ${errs.kcal ? "input-invalid" : ""}`}
                type="number" step="1" min="0"
                value={form.kcal}
                onChange={(e) => up("kcal", e.target.value)}
                onBlur={() => setErrs(p => ({ ...p, kcal: foodValidators.kcal(form.kcal) }))}
                placeholder="VD: 165"
                required
              />
              <div className="error-stack" aria-live="polite">
                {errs.kcal && <span className="error-item">{errs.kcal}</span>}
              </div>
            </div>

            <div className="row three">
              <div>
                <label>Chất đạm (g)</label>
                <input
                  className={`ipt ${errs.proteinG ? "input-invalid" : ""}`}
                  type="number" step="0.1" min="0"
                  value={form.proteinG}
                  onChange={(e) => up("proteinG", e.target.value)}
                  onBlur={() => setErrs(p => ({ ...p, proteinG: foodValidators.optionalNumber(form.proteinG) }))}
                />
                <div className="error-stack" aria-live="polite">
                  {errs.proteinG && <span className="error-item">{errs.proteinG}</span>}
                </div>
              </div>
              <div>
                <label>Đường bột (carb) (g)</label>
                <input
                  className={`ipt ${errs.carbG ? "input-invalid" : ""}`}
                  type="number" step="0.1" min="0"
                  value={form.carbG}
                  onChange={(e) => up("carbG", e.target.value)}
                  onBlur={() => setErrs(p => ({ ...p, carbG: foodValidators.optionalNumber(form.carbG) }))}
                />
                <div className="error-stack" aria-live="polite">
                  {errs.carbG && <span className="error-item">{errs.carbG}</span>}
                </div>
              </div>
              <div>
                <label>Chất béo (fat) (g)</label>
                <input
                  className={`ipt ${errs.fatG ? "input-invalid" : ""}`}
                  type="number" step="0.1" min="0"
                  value={form.fatG}
                  onChange={(e) => up("fatG", e.target.value)}
                  onBlur={() => setErrs(p => ({ ...p, fatG: foodValidators.optionalNumber(form.fatG) }))}
                />
                <div className="error-stack" aria-live="polite">
                  {errs.fatG && <span className="error-item">{errs.fatG}</span>}
                </div>
              </div>
            </div>

            <div className="row three">
              <div>
                <label>Muối (g)</label>
                <input
                  className={`ipt ${errs.saltG ? "input-invalid" : ""}`}
                  type="number" step="0.1" min="0"
                  value={form.saltG}
                  onChange={(e) => up("saltG", e.target.value)}
                  onBlur={() => setErrs(p => ({ ...p, saltG: foodValidators.optionalNumber(form.saltG) }))}
                />
                <div className="error-stack" aria-live="polite">
                  {errs.saltG && <span className="error-item">{errs.saltG}</span>}
                </div>
              </div>
              <div>
                <label>Đường (g)</label>
                <input
                  className={`ipt ${errs.sugarG ? "input-invalid" : ""}`}
                  type="number" step="0.1" min="0"
                  value={form.sugarG}
                  onChange={(e) => up("sugarG", e.target.value)}
                  onBlur={() => setErrs(p => ({ ...p, sugarG: foodValidators.optionalNumber(form.sugarG) }))}
                />
                <div className="error-stack" aria-live="polite">
                  {errs.sugarG && <span className="error-item">{errs.sugarG}</span>}
                </div>
              </div>
              <div>
                <label>Chất xơ (g)</label>
                <input
                  className={`ipt ${errs.fiberG ? "input-invalid" : ""}`}
                  type="number" step="0.1" min="0"
                  value={form.fiberG}
                  onChange={(e) => up("fiberG", e.target.value)}
                  onBlur={() => setErrs(p => ({ ...p, fiberG: foodValidators.optionalNumber(form.fiberG) }))}
                />
                <div className="error-stack" aria-live="polite">
                  {errs.fiberG && <span className="error-item">{errs.fiberG}</span>}
                </div>
              </div>
            </div>

            <div className="sep" />

            {/* Rich Text Editor (giao diện) */}
            <div className="sec-title">Mô tả / Ghi chú</div>
            <div className="rte">
              <div className="rte-toolbar">
                <button type="button" className="ic"><i className="fa-solid fa-bold"></i></button>
                <button type="button" className="ic"><i className="fa-solid fa-italic"></i></button>
                <span className="vr" />
                <button type="button" className="ic"><i className="fa-solid fa-list-ul"></i></button>
                <button type="button" className="ic"><i className="fa-solid fa-list-ol"></i></button>
                <span className="vr" />
                <button type="button" className="ic"><i className="fa-solid fa-link"></i></button>
                <button type="button" className="ic"><i className="fa-regular fa-image"></i></button>
              </div>
              <div className="rte-editor" contentEditable suppressContentEditableWarning data-placeholder="Viết mô tả món ăn (không bắt buộc)…">
              </div>
            </div>

            {/* Lỗi chung/tin nhắn */}
            <div className="error-stack" aria-live="polite">
              {errs.global && <span className="error-item">{errs.global}</span>}
            </div>
            {msg && <div className="form-msg">{msg}</div>}
          </div>
        </section>

        {/* RIGHT: card hình ảnh */}
        <aside className="ff-right">
          <div className="card thumb-card">
            <div className="sec-title">Hình ảnh</div>

            <div className="thumb-box">
              {preview || existingUrl ? (
                <img
                  src={preview || toAbs(existingUrl)}
                  alt="preview"
                  className="thumb-img"
                  onError={(e)=>{ e.currentTarget.src="/images/food-placeholder.jpg"; }}
                />
              ) : (
                <div className="thumb-placeholder"><i className="fa-regular fa-image"></i></div>
              )}
            </div>

            <div className="thumb-ctl">
              <label className="btn light">
                <input type="file" hidden accept="image/*" onChange={onPickFile} />
                Chọn ảnh
              </label>
              {(preview || existingUrl) && (
                <button type="button" className="btn ghost" onClick={clearThumb}>Xóa ảnh</button>
              )}
            </div>

            <div className="hint">Chỉ 1 ảnh (*.png, *.jpg, *.jpeg). Chọn ảnh lại để thay đổi.</div>
          </div>
        </aside>
      </form>

      {/* Popup xác nhận xóa */}
      {confirmDel && (
        <div className="modal" onClick={() => setConfirmDel(false)}>
          <div className="modal-card small" onClick={(e)=>e.stopPropagation()}>
            <div className="modal-head"><h3>Xác nhận xóa món</h3></div>
            <div className="modal-body">
              <div className="muted">Bạn chắc chắn muốn xóa món ăn này? Thao tác không thể hoàn tác.</div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={()=>setConfirmDel(false)}>Hủy</button>
              <button className="btn bad" onClick={onConfirmDelete}>Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
