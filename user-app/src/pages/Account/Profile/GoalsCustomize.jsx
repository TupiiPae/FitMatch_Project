import React, { useMemo, useState } from "react";
import "./GoalsCustomize.css";

export default function GoalsCustomize({ user }) {
  const p = user?.profile || {};

  // Macro % (chuẩn hóa tổng = 100%)
  const { prot, carb, fat } = useMemo(() => {
    const _prot = Number.isFinite(+p.macroProtein) ? +p.macroProtein : 20;
    const _carb = Number.isFinite(+p.macroCarb) ? +p.macroCarb : 50;
    const _fat  = Number.isFinite(+p.macroFat)  ? +p.macroFat  : 30;
    const total = _prot + _carb + _fat;
    if (!total || total <= 0) return { prot: 20, carb: 50, fat: 30 };
    const nProt = Math.round((_prot / total) * 100);
    const nCarb = Math.round((_carb / total) * 100);
    return { prot: nProt, carb: nCarb, fat: 100 - nProt - nCarb };
  }, [p.macroProtein, p.macroCarb, p.macroFat]);

  const calTarget = useMemo(() => {
    const t = Number(p.tdee);
    return Number.isFinite(t) && t > 0 ? Math.round(t) : "XXXX";
  }, [p.tdee]);

  const items = [
    { key: "cal",   label: "Tùy chỉnh Calo mục tiêu" },
    { key: "macro", label: "Tùy chỉnh tỷ lệ dinh dưỡng đa lượng" },
    { key: "water", label: "Lượng nước" },
    { key: "steps", label: "Bước chân mục tiêu" },
  ];
  const [openKey, setOpenKey] = useState(null);
  const toggle = (k) => setOpenKey((prev) => (prev === k ? null : k));

  return (
    <div className="card">
      <h2 className="pf-title">Tùy chỉnh mục tiêu</h2>

      <h3 className="pf-subtitle">Thông tin dinh dưỡng</h3>

      {/* Box ngoài (thu hẹp & căn giữa), 4 phần tử căn đều bên trong */}
      <div className="goal-frame">
        <div className="goal-row-center">
          {/* Calo mục tiêu (box trắng) */}
          <div className="kpi-cal">
            <div className="cal-val">{calTarget}</div>
            <div className="cal-sub">CALO MỤC TIÊU</div>
          </div>

          {/* 3 macro progress circle */}
          <MacroRing label="Chất đạm" pct={prot} tone="prot" />
          <MacroRing label="Đường bột" pct={carb} tone="carb" />
          <MacroRing label="Chất béo" pct={fat}  tone="fat" />
        </div>
      </div>

      {/* BMR/TDEE: giữ cấu trúc cũ, thêm fill để nổi bật */}
      <div className="goal-facts filled">
        <div className="fact-row">
          <span>Tỷ lệ trao đổi chất cơ bản (BMR)</span>
          <strong>{p.bmr ? Math.round(p.bmr) : "xxxx"}</strong>
        </div>
        <div className="fact-row">
          <span>Tổng năng lượng tiêu thụ mỗi ngày (TDEE)</span>
          <strong>{p.tdee ? Math.round(p.tdee) : "xxxx"}</strong>
        </div>
      </div>

      <div className="pf-line" />

      <h3 className="pf-subtitle">Tùy chỉnh mục tiêu dinh dưỡng</h3>

      <div className="goal-acc">
        <div className="acc-head">Mục tiêu</div>
        {items.map((it) => {
          const isOpen = openKey === it.key;
          return (
            <div key={it.key}>
              <button
                className={`acc-row ${isOpen ? "is-open" : ""}`}
                onClick={() => toggle(it.key)}
                aria-expanded={isOpen}
              >
                <span>{it.label}</span>
                <i className="chev">{">"}</i>
              </button>

              {isOpen && (
                <div className="acc-panel">
                  {/* Placeholder form – sẽ nối API ở bước sau */}
                  <div className="pf-form-5">
                    <div className="pf-form-cell">
                      <label>Giá trị</label>
                      <input placeholder="Nhập giá trị…" />
                    </div>
                    <div className="pf-form-cell">
                      <label>Ghi chú</label>
                      <input placeholder="Tùy chọn" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pf-actions pf-actions-right">
        <button className="btn-success">Cập nhật</button>
      </div>
    </div>
  );
}

function MacroRing({ label, pct, tone = "prot" }) {
  return (
    <div className={`kpi-macro tone-${tone}`}>
      <div className="ring" style={{ ["--p"]: pct }}>
        <span className="ring-text"><strong>{pct}%</strong></span>
      </div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}
