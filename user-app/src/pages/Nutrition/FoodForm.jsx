import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  createFood as createFoodJSON,
  createFoodWithImage,
  updateFood,
  updateFoodWithImage,
  getFood,
  deleteFood,
} from "../../api/foods";
import api from "../../lib/api";
import "./FoodForm.css";
import { toast } from "react-toastify";
import { foodValidators } from "../../lib/validators";

const UNIT_OPTIONS = ["g", "ml"];
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

export default function FoodForm() {
  const nav = useNavigate();
  const { id } = useParams();
  const loc = useLocation();
  const isEdit = !!id;
  const aiPrefillState = loc?.state?.aiPrefill || null;

  const [loading, setLoading] = useState(!!id);

  const [form, setForm] = useState({
    name: "",
    massG: "",
    unit: "g",
    portionName: "",
    kcal: "",
    proteinG: "",
    carbG: "",
    fatG: "",
    saltG: "",
    sugarG: "",
    fiberG: "",
    description: "",
  });

  const [errs, setErrs] = useState({
    name: "",
    massG: "",
    kcal: "",
    proteinG: "",
    carbG: "",
    fatG: "",
    saltG: "",
    sugarG: "",
    fiberG: "",
    global: "",
  });

  const [submitTried, setSubmitTried] = useState(false);
  const showErr = (k) => submitTried && !!errs[k];

  const validateField = (key, nextForm) => {
    switch (key) {
      case "name":
        return foodValidators.name(nextForm.name);
      case "massG":
        return foodValidators.massG(nextForm.massG);
      case "kcal":
        return foodValidators.kcal(nextForm.kcal);
      case "proteinG":
        return foodValidators.optionalNumber(nextForm.proteinG);
      case "carbG":
        return foodValidators.optionalNumber(nextForm.carbG);
      case "fatG":
        return foodValidators.optionalNumber(nextForm.fatG);
      case "saltG":
        return foodValidators.optionalNumber(nextForm.saltG);
      case "sugarG":
        return foodValidators.optionalNumber(nextForm.sugarG);
      case "fiberG":
        return foodValidators.optionalNumber(nextForm.fiberG);
      default:
        return "";
    }
  };

  const up = (k, v) => {
    setForm((s) => {
      const next = { ...s, [k]: v };
      if (submitTried) {
        setErrs((p) => ({ ...p, [k]: validateField(k, next) }));
      }
      return next;
    });
  };

  const runValidateAll = () => {
    const next = foodValidators.validateAll(form);
    setErrs(next);
    return !Object.values(next).some(Boolean);
  };

  const [msg, setMsg] = useState("");

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [existingUrl, setExistingUrl] = useState("");
  const fileInputRef = useRef(null);

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setExistingUrl("");
  };

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  const openFileDialog = () => fileInputRef.current?.click();

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data } = await getFood(id);
        const f = data || {};
        setForm({
          name: f.name || "",
          portionName: f.portionName || "",
          massG: f.massG ?? "",
          unit: f.unit || "g",
          kcal: f.kcal ?? "",
          proteinG: f.proteinG ?? "",
          carbG: f.carbG ?? "",
          fatG: f.fatG ?? "",
          saltG: f.saltG ?? "",
          sugarG: f.sugarG ?? "",
          fiberG: f.fiberG ?? "",
          description: f.description || "",
        });
        setExistingUrl(f.imageUrl || "");
      } catch {
        toast.error("Không tải được dữ liệu món");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function submit(e) {
    if (e?.preventDefault) e.preventDefault();
    setMsg("");
    setErrs((p) => ({ ...p, global: "" }));
    setSubmitTried(true);

    if (!runValidateAll()) {
      toast.error("Vui lòng kiểm tra lại các trường bắt buộc.");
      return;
    }

    const name = String(form.name || "").trim();
    const unit = form.unit === "ml" ? "ml" : "g";
    const massNum = Number(String(form.massG ?? "").trim());
    const numOrNull = (v) => {
      const s = String(v ?? "").trim();
      if (s === "") return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };

    const payload = {
      name,
      massG: massNum,
      unit,
      portionName: String(form.portionName || "").trim() || undefined,
      kcal: numOrNull(form.kcal),
      proteinG: numOrNull(form.proteinG),
      carbG: numOrNull(form.carbG),
      fatG: numOrNull(form.fatG),
      saltG: numOrNull(form.saltG),
      sugarG: numOrNull(form.sugarG),
      fiberG: numOrNull(form.fiberG),
      description: String(form.description || "").trim() || undefined,
      ...(isEdit ? {} : { sourceType: "user_submitted" }),
    };

    try {
      if (file) {
        const fd = new FormData();
        fd.append("image", file);
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== null && v !== undefined) fd.append(k, String(v));
        });
        if (isEdit) await updateFoodWithImage(id, fd);
        else await createFoodWithImage(fd);
      } else {
        const payloadWithImage = {
          ...payload,
          imageUrl: existingUrl || undefined,
        };
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
          global: data.message || prev.global,
        }));
        toast.error("Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.");
      } else {
        const m = data.message || (isEdit ? "Lưu thất bại" : "Gửi duyệt thất bại");
        setMsg(m);
        toast.error(m);
      }
    }
  }

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

  const appliedPrefillRef = useRef(false);

  useEffect(() => {
    if (isEdit) return;
    if (appliedPrefillRef.current) return;

    let prefill = aiPrefillState;

    if (!prefill) {
      try {
        const raw = sessionStorage.getItem("fm_ai_food_prefill");
        if (raw) prefill = JSON.parse(raw);
      } catch {}
    }

    if (!prefill) return;

    appliedPrefillRef.current = true;
    try {
      sessionStorage.removeItem("fm_ai_food_prefill");
    } catch {}

    setForm((s) => ({
      ...s,
      name: prefill.name || s.name,
      portionName: prefill.portionName || s.portionName,
      massG: prefill.massG != null ? String(prefill.massG) : s.massG,
      unit: prefill.unit === "ml" ? "ml" : "g",
      kcal: prefill.kcal != null ? String(prefill.kcal) : s.kcal,
      proteinG: prefill.proteinG != null ? String(prefill.proteinG) : s.proteinG,
      carbG: prefill.carbG != null ? String(prefill.carbG) : s.carbG,
      fatG: prefill.fatG != null ? String(prefill.fatG) : s.fatG,
      saltG: prefill.saltG != null ? String(prefill.saltG) : s.saltG,
      sugarG: prefill.sugarG != null ? String(prefill.sugarG) : s.sugarG,
      fiberG: prefill.fiberG != null ? String(prefill.fiberG) : s.fiberG,
      description: prefill.description || s.description,
    }));

    if (prefill.imageUrl) {
      setFile(null);
      if (preview) {
        try {
          URL.revokeObjectURL(preview);
        } catch {}
      }
      setPreview("");
      setExistingUrl(prefill.imageUrl);
    }

    toast.info("Đã tự điền dữ liệu từ AI. Bạn hãy kiểm tra và nhấn Tạo món.");
  }, [isEdit, aiPrefillState, preview]);

  if (loading)
    return (
      <div className="ff-wrap">
        <div className="muted">Đang tải...</div>
      </div>
    );

  const currentImageUrl = preview || (existingUrl ? toAbs(existingUrl) : null);

  const showName = String(form.name || "").trim() || "Tên món ăn";
  const showMass = String(form.massG || "").trim();
  const showUnit = form.unit === "ml" ? "ml" : "g";
  const showKcal = String(form.kcal || "").trim();
  const showP = String(form.proteinG || "").trim();
  const showC = String(form.carbG || "").trim();
  const showF = String(form.fatG || "").trim();

  return (
    <div className="ff-wrap">
      <div className="ff-toolbar">
        <div className="ff-toolbox">
          <button type="button" className="tool-left" onClick={() => nav(-1)}>
            <i className="fa-solid fa-arrow-left-long"></i> Quay lại 
          </button>
          <div className="tool-mid">{isEdit ? "Chỉnh sửa món" : "Tạo món ăn"}</div>
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

      <form className="ff-grid-card" onSubmit={submit} noValidate>
        <div className="ff-image-col">
          <div className="ff-card">
            <div className="ff-card-head">
              <h3 className="ff-card-title">Hình ảnh món ăn</h3>
              <div className="ff-card-sub">Nhấp để chọn ảnh hoặc dán URL</div>
            </div>

            <div
              className="ff-image-box"
              role="button"
              tabIndex={0}
              onClick={openFileDialog}
              onKeyDown={(e) => {
                if (e.key === "Enter") openFileDialog();
              }}
            >
              {currentImageUrl ? (
                <img
                  src={currentImageUrl}
                  alt="Xem trước"
                  onError={(e) => {
                    e.currentTarget.src = "/images/food-placeholder.jpg";
                  }}
                />
              ) : (
                <div className="ff-placeholder">
                  <i className="fa-regular fa-image"></i>
                  <span>Xem trước hình ảnh</span>
                  <span className="ff-placeholder-sub">Nhấp để chọn ảnh</span>
                </div>
              )}
            </div>

            <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={onPickFile} />

            <div className="ff-field">
              <label className="ff-label ff-label-url" htmlFor="food-image-url">
                Link hình ảnh (URL)
              </label>
              <input
                className="ff-ipt"
                type="url"
                id="food-image-url"
                placeholder="Dán link hình ảnh (không bắt buộc)"
                value={existingUrl}
                onChange={(e) => {
                  if (file) setFile(null);
                  if (preview) URL.revokeObjectURL(preview);
                  setPreview("");
                  setExistingUrl(e.target.value);
                }}
              />
            </div>
          </div>

          {/* <div className="ff-summary">
            <div className="ff-summary-top">
              <div className="ff-summary-name" title={showName}>
                {showName}
              </div>
              <div className="ff-summary-meta">
                {showMass ? (
                  <span>
                    {showMass} {showUnit}
                  </span>
                ) : (
                  <span className="muted">Chưa nhập khối lượng</span>
                )}
              </div>
            </div>

            <div className="ff-summary-kcal">
              <div className="ff-summary-kcal-label">Calories</div>
              <div className="ff-summary-kcal-value">{showKcal ? showKcal : "—"}</div>
              <div className="ff-summary-kcal-unit">kcal</div>
            </div>

            <div className="ff-summary-macros">
              <div className="ff-macro-pill">
                <span className="k">P</span>
                <span className="v">{showP ? showP : "—"}</span>
                <span className="u">g</span>
              </div>
              <div className="ff-macro-pill">
                <span className="k">C</span>
                <span className="v">{showC ? showC : "—"}</span>
                <span className="u">g</span>
              </div>
              <div className="ff-macro-pill">
                <span className="k">F</span>
                <span className="v">{showF ? showF : "—"}</span>
                <span className="u">g</span>
              </div>
            </div>
          </div> */}
        </div>

        <div className="ff-fields-col">
          <section className="ff-card">
            <div className="ff-card-head">
              <h3 className="ff-card-title">Thông tin cơ bản</h3>
            </div>

            <div className={`ff-field ${showErr("name") ? "is-invalid" : ""}`}>
              <label className="ff-label" htmlFor="food-name">
                Tên món ăn <span className="req">*</span>
              </label>
              <input
                className="ff-ipt"
                id="food-name"
                value={form.name}
                onChange={(e) => up("name", e.target.value)}
                placeholder="Nhập tên món ăn"
                maxLength={50}
                aria-required="true"
              />
              <div className="error-stack" aria-live="polite">
                {showErr("name") && <span className="error-item">{errs.name}</span>}
              </div>
            </div>

            <div className="ff-field">
              <label className="ff-label" htmlFor="food-portion">
                Mô tả khẩu phần
              </label>
              <input
                className="ff-ipt"
                id="food-portion"
                value={form.portionName}
                onChange={(e) => up("portionName", e.target.value)}
                placeholder="VD: 1 phần / 1 lon / 1 lát..."
              />
            </div>

            <div className="ff-fields-grid-2">
              <div className={`ff-field ${showErr("massG") ? "is-invalid" : ""}`}>
                <label className="ff-label" htmlFor="food-mass">
                  Khối lượng <span className="req">*</span>
                </label>
                <input
                  className="ff-ipt"
                  type="number"
                  min="0"
                  step="1"
                  id="food-mass"
                  value={form.massG}
                  onChange={(e) => up("massG", e.target.value)}
                  placeholder="Nhập số khối lượng"
                  aria-required="true"
                />
                <div className="error-stack" aria-live="polite">
                  {showErr("massG") && <span className="error-item">{errs.massG}</span>}
                </div>
              </div>

              <div className="ff-field ff-field-select">
                <label className="ff-label" htmlFor="food-unit">
                  Đơn vị
                </label>
                <select
                  id="food-unit"
                  className="ff-ipt"
                  value={form.unit}
                  onChange={(e) => up("unit", e.target.value)}
                >
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={`ff-field ${showErr("kcal") ? "is-invalid" : ""}`}>
              <label className="ff-label" htmlFor="food-kcal">
                Calories <span className="req">*</span>
              </label>
              <input
                className="ff-ipt"
                type="number"
                step="1"
                min="0"
                id="food-kcal"
                value={form.kcal}
                onChange={(e) => up("kcal", e.target.value)}
                placeholder="VD: 250"
                aria-required="true"
              />
              <div className="error-stack" aria-live="polite">
                {showErr("kcal") && <span className="error-item">{errs.kcal}</span>}
              </div>
            </div>
          </section>

          <section className="ff-card">
            <div className="ff-card-head">
              <h3 className="ff-card-title">Thành phần dinh dưỡng</h3>
            </div>

            <div className="ff-fields-grid-3">
              <div className={`ff-field ${showErr("proteinG") ? "is-invalid" : ""}`}>
                <label className="ff-label" htmlFor="food-protein">
                  Protein (g)
                </label>
                <input
                  className="ff-ipt"
                  type="number"
                  step="0.1"
                  min="0"
                  id="food-protein"
                  value={form.proteinG}
                  onChange={(e) => up("proteinG", e.target.value)}
                  placeholder="VD: 18"
                />
                <div className="error-stack" aria-live="polite">
                  {showErr("proteinG") && <span className="error-item">{errs.proteinG}</span>}
                </div>
              </div>

              <div className={`ff-field ${showErr("carbG") ? "is-invalid" : ""}`}>
                <label className="ff-label" htmlFor="food-carb">
                  Carb (g)
                </label>
                <input
                  className="ff-ipt"
                  type="number"
                  step="0.1"
                  min="0"
                  id="food-carb"
                  value={form.carbG}
                  onChange={(e) => up("carbG", e.target.value)}
                  placeholder="VD: 30"
                />
                <div className="error-stack" aria-live="polite">
                  {showErr("carbG") && <span className="error-item">{errs.carbG}</span>}
                </div>
              </div>

              <div className={`ff-field ${showErr("fatG") ? "is-invalid" : ""}`}>
                <label className="ff-label" htmlFor="food-fat">
                  Fat (g)
                </label>
                <input
                  className="ff-ipt"
                  type="number"
                  step="0.1"
                  min="0"
                  id="food-fat"
                  value={form.fatG}
                  onChange={(e) => up("fatG", e.target.value)}
                  placeholder="VD: 10"
                />
                <div className="error-stack" aria-live="polite">
                  {showErr("fatG") && <span className="error-item">{errs.fatG}</span>}
                </div>
              </div>
            </div>

            <details className="ff-adv">
              <summary className="ff-adv-sum">
                <div className="ff-adv-left">
                  <span className="ff-adv-title">Thêm thông tin dinh dưỡng</span>
                </div>
                <i className="fa-solid fa-chevron-down ff-adv-ico" aria-hidden="true" />
              </summary>

              <div className="ff-adv-body">
                <div className="ff-fields-grid-3">
                  <div className={`ff-field ${showErr("saltG") ? "is-invalid" : ""}`}>
                    <label className="ff-label" htmlFor="food-salt">
                      Muối (g)
                    </label>
                    <input
                      className="ff-ipt"
                      type="number"
                      step="0.1"
                      min="0"
                      id="food-salt"
                      value={form.saltG}
                      onChange={(e) => up("saltG", e.target.value)}
                      placeholder="VD: 0.5"
                    />
                    <div className="error-stack" aria-live="polite">
                      {showErr("saltG") && <span className="error-item">{errs.saltG}</span>}
                    </div>
                  </div>

                  <div className={`ff-field ${showErr("sugarG") ? "is-invalid" : ""}`}>
                    <label className="ff-label" htmlFor="food-sugar">
                      Đường (g)
                    </label>
                    <input
                      className="ff-ipt"
                      type="number"
                      step="0.1"
                      min="0"
                      id="food-sugar"
                      value={form.sugarG}
                      onChange={(e) => up("sugarG", e.target.value)}
                      placeholder="VD: 5"
                    />
                    <div className="error-stack" aria-live="polite">
                      {showErr("sugarG") && <span className="error-item">{errs.sugarG}</span>}
                    </div>
                  </div>

                  <div className={`ff-field ${showErr("fiberG") ? "is-invalid" : ""}`}>
                    <label className="ff-label" htmlFor="food-fiber">
                      Chất xơ (g)
                    </label>
                    <input
                      className="ff-ipt"
                      type="number"
                      step="0.1"
                      min="0"
                      id="food-fiber"
                      value={form.fiberG}
                      onChange={(e) => up("fiberG", e.target.value)}
                      placeholder="VD: 3"
                    />
                    <div className="error-stack" aria-live="polite">
                      {showErr("fiberG") && <span className="error-item">{errs.fiberG}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </details>
          </section>

          <section className="ff-card">
            <div className="ff-card-head">
              <h3 className="ff-card-title">Ghi chú <span>(không bắt buộc)</span></h3>
            </div>

            <div className="ff-field">
              <label className="ff-label" htmlFor="food-desc">
                Mô tả món ăn
              </label>
              <textarea
                className="ff-textarea"
                id="food-desc"
                value={form.description}
                onChange={(e) => up("description", e.target.value)}
                placeholder="VD: Món này dùng cho bữa sáng, ăn kèm với trứng, bánh mì..."
                rows={10}
                maxLength={1000}
              />
            </div>

            <div className="error-stack" aria-live="polite">
              {errs.global && <span className="error-item">{errs.global}</span>}
            </div>
            {msg && <div className="form-msg">{msg}</div>}
          </section>
        </div>
      </form>

      <div className="ff-sticky-actions" aria-hidden="false">
        <button type="button" className="ff-sticky-back" onClick={() => nav(-1)}>
          <i className="fa-solid fa-arrow-left-long"></i>
          <span>Quay lại</span>
        </button>

        {isEdit && (
          <button type="button" className="ff-sticky-del" onClick={openConfirmDelete}>
            <i className="fa-regular fa-trash-can"></i>
            <span>Xóa</span>
          </button>
        )}

        <button type="button" className="ff-sticky-main" onClick={submit}>
          {isEdit ? "Lưu" : "Tạo món"}
        </button>
      </div>

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
              <button className="btn ghost" onClick={closeConfirmDelete}>
                Hủy
              </button>
              <button className="btn bad" onClick={confirmDeleteNow}>
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}