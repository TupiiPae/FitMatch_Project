import React, { useEffect, useMemo, useState } from "react";

const MONTHS = [1, 3, 6, 12];

const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const normalizeFeatures = (v) => {
  if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
  return String(v || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
};

export default function PremiumPlanModal({ initial, onClose, onSubmit }) {
  const isEdit = !!initial?._id;

  const [months, setMonths] = useState(initial?.months ?? 1);
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [currency, setCurrency] = useState(initial?.currency ?? "VND");
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [featuresText, setFeaturesText] = useState((initial?.features || []).join("\n"));
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const autoCode = useMemo(() => `premium_${Number(months)}m`, [months]);

  useEffect(() => {
    if (!isEdit && (!code || code.startsWith("premium_"))) setCode(autoCode);
    if (!isEdit && (!name || name.startsWith("Premium "))) setName(`Premium ${Number(months)} tháng`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months]);

  const validate = () => {
    const m = toNum(months, 0);
    if (!MONTHS.includes(m)) return "Thời hạn chỉ nhận 1/3/6/12 tháng";
    const p = toNum(price, -1);
    if (!Number.isFinite(p) || p < 0) return "Giá không hợp lệ";
    if (!String(name || "").trim()) return "Vui lòng nhập tên gói";
    if (!String(code || "").trim()) return "Mã gói (code) không được trống";
    return "";
  };

  const handleSave = async () => {
    const msg = validate();
    if (msg) {
      setErr(msg);
      return;
    }

    setSaving(true);
    setErr("");
    try {
      const payload = {
        months: toNum(months, 1),
        price: Math.round(toNum(price, 0)),
        currency: String(currency || "VND").trim().toUpperCase(),
        name: String(name || "").trim(),
        code: String(code || "").trim(),
        description: String(description || "").trim(),
        features: normalizeFeatures(featuresText),
        sortOrder: Math.round(toNum(sortOrder, 0)),
        isActive: !!isActive,
      };

      const ok = await onSubmit(payload, initial?._id);
      if (ok) onClose();
    } catch (e) {
      setErr(e?.response?.data?.message || "Không thể lưu gói Premium");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pm-backdrop" onClick={onClose}>
      <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pm-modal-header">
          <div className="pm-modal-title">{isEdit ? "Chỉnh sửa gói Premium" : "Tạo gói Premium"}</div>
          <button className="pm-modal-close" onClick={onClose} type="button">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="pm-modal-body">
          <div className="pm-row">
            <div className="pm-field">
              <label className="pm-label">Thời hạn</label>
              <select className="pm-select" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m} tháng
                  </option>
                ))}
              </select>
            </div>

            <div className="pm-field">
              <label className="pm-label">Giá (VND)</label>
              <input
                className="pm-input"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="numeric"
                placeholder="VD: 99000"
              />
            </div>
          </div>

          <div className="pm-row">
            <div className="pm-field">
              <label className="pm-label">Tên gói</label>
              <input className="pm-input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="pm-field">
              <label className="pm-label">Mã gói (code)</label>
              <input className="pm-input" value={code} onChange={(e) => setCode(e.target.value)} />
              <div className="pm-hint">Gợi ý: {autoCode}</div>
            </div>
          </div>

          <div className="pm-row">
            <div className="pm-field">
              <label className="pm-label">Tiền tệ</label>
              <input className="pm-input" value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>

            <div className="pm-field">
              <label className="pm-label">Sort order</label>
              <input className="pm-input" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
            </div>
          </div>

          <div className="pm-field">
            <label className="pm-label">Mô tả</label>
            <textarea className="pm-textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          <div className="pm-field">
            <label className="pm-label">Tính năng (mỗi dòng 1 mục)</label>
            <textarea
              className="pm-textarea"
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              rows={5}
              placeholder={"VD:\nTăng giới hạn kết nối\nTăng lượt chat AI\nƯu tiên hỗ trợ"}
            />
          </div>

          <div className="pm-field pm-switchline">
            <label className="pm-label">Trạng thái</label>
            <button
              type="button"
              className={"pm-toggle" + (isActive ? " on" : " off")}
              onClick={() => setIsActive((v) => !v)}
              disabled={saving}
            >
              <span className="knob" />
              <span className="label">{isActive ? "Hoạt động" : "Không hoạt động"}</span>
            </button>
          </div>

          {err && <div className="pm-error">{err}</div>}
        </div>

        <div className="pm-modal-footer">
          <button className="pm-btn ghost" type="button" onClick={onClose} disabled={saving}>
            Đóng
          </button>
          <button className="pm-btn primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
