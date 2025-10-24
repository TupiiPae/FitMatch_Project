// src/pages/Nutrition/FoodForm.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  createFood as createFoodJSON,
  createFoodWithImage,
  updateFood,
  updateFoodWithImage,
  getFood
} from "../../api/foods";
import api from "../../lib/api";
import "./FoodForm.css";
import { toast } from "react-toastify";

const UNIT_OPTIONS = ["g", "ml"];

// Chuẩn hoá URL ảnh thành tuyệt đối
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

  // Ảnh
  const [file, setFile] = useState(null);          // file người dùng vừa chọn
  const [preview, setPreview] = useState("");      // blob:... cho file mới
  const [existingUrl, setExistingUrl] = useState(""); // URL ảnh hiện có từ server (tương đối/ tuyệt đối)

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f)); // blob:
  };
  const clearThumb = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
    // vẫn giữ existingUrl để còn xem ảnh cũ, chỉ bỏ đi nếu muốn “xóa ảnh” (BE cần endpoint riêng)
  };
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

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
        setExistingUrl(f.imageUrl || ""); // giữ nguyên (tương đối); render sẽ dùng toAbs()
      } catch {
        toast.error("Không tải được dữ liệu món");
      } finally { setLoading(false); }
    })();
  }, [id]);

  const [msg, setMsg] = useState("");

  async function submit(e) {
    if (e?.preventDefault) e.preventDefault();
    setMsg("");

    const name = String(form.name || "").trim();
    const unit = form.unit === "ml" ? "ml" : "g";
    const massRaw = String(form.massG ?? "").trim();
    const massNum = massRaw === "" ? NaN : Number(massRaw);
    if (!name) return setMsg("Tên món là bắt buộc");
    if (!Number.isFinite(massNum) || massNum <= 0) return setMsg("Khối lượng (g/ml) phải là số dương");

    const numOrNull = (v, parseFn = Number) => {
      const s = String(v ?? "").trim(); if (s === "") return null;
      const n = parseFn(s); return Number.isFinite(n) ? n : null;
    };

    const payload = {
      name, massG: massNum, unit,
      portionName: String(form.portionName || "").trim() || undefined,
      kcal: numOrNull(form.kcal), proteinG: numOrNull(form.proteinG), carbG: numOrNull(form.carbG),
      fatG: numOrNull(form.fatG), saltG: numOrNull(form.saltG), sugarG: numOrNull(form.sugarG), fiberG: numOrNull(form.fiberG),
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
      const m = err?.response?.data?.message || (isEdit ? "Lưu thất bại" : "Gửi duyệt thất bại");
      setMsg(m); toast.error(m);
    }
  }

  if (loading) return <div className="cf-wrap"><div className="muted">Đang tải...</div></div>;

  return (
    <div className="cf-wrap">
      <div className="cf-header">
        <h2>{isEdit ? "Chỉnh sửa món ăn" : "Tạo món ăn mới"}</h2>
        <div className="cf-actions">
          <button className="btn ghost" type="button" onClick={() => nav(-1)}>Hủy</button>
          <button className="btn primary" type="button" onClick={submit}>
            {isEdit ? "Lưu" : "Tạo món ăn"}
          </button>
        </div>
      </div>

      <form className="cf-grid" onSubmit={submit}>
        {/* LEFT */}
        <aside className="cf-left">
          <div className="card thumb-card">
            <div className="card-title"></div>
            <div className="thumb-box">
              {/* Ưu tiên blob preview; nếu không có thì dùng ảnh server đã có */}
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
                <button type="button" className="btn ghost" onClick={clearThumb}>
                  Xóa ảnh
                </button>
              )}
            </div>
            <div className="hint">Chỉ 1 ảnh (*.png, *.jpg, *.jpeg)</div>
          </div>

          {!isEdit && (
            <div className="card status-card">
              <div className="card-title">Trạng thái duyệt</div>
              <div className="status-dot green"></div>
              <div className="hint">Món mới sẽ ở trạng thái <b>Đang duyệt</b>.</div>
            </div>
          )}
        </aside>

        {/* RIGHT */}
        <section className="cf-right">
          <div className="card">
            <div className="tab-title">Thông tin chung</div>
            <div className="row">
              <label>Tên món <span className="req">*</span></label>
              <input className="ipt" value={form.name} onChange={(e) => up("name", e.target.value)} placeholder="VD: Ức gà áp chảo" required />
            </div>

            <div className="row two">
              <div>
                <label>Khẩu phần (tùy chọn)</label>
                <input className="ipt" value={form.portionName} onChange={(e) => up("portionName", e.target.value)} placeholder="VD: 1 phần / 1 lon / 1 lát..." />
              </div>
            </div>

            <div className="row two">
              <div>
                <label>Khối lượng <span className="req">*</span></label>
                <input className="ipt" type="number" min="0" step="1" value={form.massG} onChange={(e) => up("massG", e.target.value)} placeholder="VD: 100" required />
              </div>
              <div>
                <label>Đơn vị</label>
                <div className="unit-toggle">
                  {UNIT_OPTIONS.map((u) => (
                    <button key={u} type="button" className={`unit ${form.unit === u ? "on" : ""}`} onClick={() => up("unit", u)}>
                      {u.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

            <div className="card">
              <div className="tab-title">Giá trị dinh dưỡng</div>
              <div className="row three">
                <div><label>Calo (cal)</label><input className="ipt" type="number" step="1" min="0" value={form.kcal} onChange={(e) => up("kcal", e.target.value)} /></div>
                <div><label>Đạm (g)</label><input className="ipt" type="number" step="0.1" min="0" value={form.proteinG} onChange={(e) => up("proteinG", e.target.value)} /></div>
                <div><label>Đường bột (g)</label><input className="ipt" type="number" step="0.1" min="0" value={form.carbG} onChange={(e) => up("carbG", e.target.value)} /></div>
              </div>
              <div className="row three">
                <div><label>Chất béo (g)</label><input className="ipt" type="number" step="0.1" min="0" value={form.fatG} onChange={(e) => up("fatG", e.target.value)} /></div>
                <div><label>Muối (g)</label><input className="ipt" type="number" step="0.1" min="0" value={form.saltG} onChange={(e) => up("saltG", e.target.value)} /></div>
                <div><label>Đường (g)</label><input className="ipt" type="number" step="0.1" min="0" value={form.sugarG} onChange={(e) => up("sugarG", e.target.value)} /></div>
              </div>
              <div className="row two">
                <div><label>Chất xơ (g)</label><input className="ipt" type="number" step="0.1" min="0" value={form.fiberG} onChange={(e) => up("fiberG", e.target.value)} /></div>
              </div>

              {msg && <div className="form-msg">{msg}</div>}
              <div className="form-actions">
                <button type="button" className="btn ghost" onClick={() => nav(-1)}>Hủy</button>
                <button type="submit" className="btn primary">{isEdit ? "Lưu" : "Tạo món ăn"}</button>
              </div>
            </div>
        </section>
      </form>
    </div>
  );
}
