import React, { useMemo, useState } from "react";
import "./GoalsCustomize.css";

export default function GoalsCustomize({ user }) {
  const p = user?.profile || {};

  // Calo mục tiêu: ưu tiên calorieTarget, fallback TDEE (nếu là number)
  const calDisplay = useMemo(() => {
    const t = typeof p.calorieTarget === "number" ? p.calorieTarget : p.tdee;
    return typeof t === "number" ? Math.round(t) : "";
  }, [p.calorieTarget, p.tdee]);

  // Macro mặc định (chỉ hiển thị – không sửa)
  const prot = 20;
  const carb = 50;
  const fat  = 30;

  // Accordion UI (chỉ mở/đóng, không thực thi lưu)
  const [openKey, setOpenKey] = useState(null);
  const toggle = (k) => setOpenKey((prev) => (prev === k ? null : k));

  return (
    <div className="card">
      <h2 className="pf-title">Tùy chỉnh mục tiêu</h2>

      <h3 className="pf-subtitle">Thông tin dinh dưỡng</h3>

      {/* KPI: chỉ hiển thị */}
      <div className="goal-frame">
        <div className="goal-row-center">
          {/* Calo mục tiêu (từ DB) */}
          <div className="kpi-cal">
            <div className="cal-val">{calDisplay || "—"}</div>
            <div className="cal-sub">CALO MỤC TIÊU</div>
          </div>

          {/* 3 vòng macro – số % ở TRUNG TÂM */}
          <MacroRing label="Chất đạm" pct={prot} tone="prot" />
          <MacroRing label="Đường bột" pct={carb} tone="carb" />
          <MacroRing label="Chất béo" pct={fat}  tone="fat" />
        </div>
      </div>

      {/* BMR/TDEE (tính sẵn từ server) */}
      <div className="goal-facts filled">
        <div className="fact-row">
          <span>Tỷ lệ trao đổi chất cơ bản (BMR)</span>
          <strong>{typeof p.bmr === "number" ? Math.round(p.bmr) : "—"}</strong>
        </div>
        <div className="fact-row">
          <span>Tổng năng lượng tiêu thụ mỗi ngày (TDEE)</span>
          <strong>{typeof p.tdee === "number" ? Math.round(p.tdee) : "—"}</strong>
        </div>
      </div>

      <div className="pf-line" />

      <h3 className="pf-subtitle">Tùy chỉnh mục tiêu dinh dưỡng</h3>

      {/* BOX "Mục tiêu" – UI only */}
      <div className="goal-acc">
        <div className="acc-head">Mục tiêu</div>

        {/* Calorie Target (UI) */}
        <div>
          <button
            className={`acc-row ${openKey === "cal" ? "is-open" : ""}`}
            onClick={() => toggle("cal")}
            aria-expanded={openKey === "cal"}
          >
            <span>Tùy chỉnh Calo mục tiêu</span>
            <i className="chev">{">"}</i>
          </button>

          {openKey === "cal" && (
            <div className="acc-panel">
              <div className="pf-form-5">
                <div className="pf-form-cell">
                  <label>Calo mục tiêu (kcal)</label>
                  <input type="number" placeholder={calDisplay || "vd. 2200"} disabled />
                </div>
                <div className="pf-form-cell">
                  <label>&nbsp;</label>
                  <button className="btn-success" disabled>
                    Lưu calo
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Macro Ratios (UI) */}
        <div>
          <button
            className={`acc-row ${openKey === "macro" ? "is-open" : ""}`}
            onClick={() => toggle("macro")}
            aria-expanded={openKey === "macro"}
          >
            <span>Tùy chỉnh tỷ lệ dinh dưỡng đa lượng</span>
            <i className="chev">{">"}</i>
          </button>

          {openKey === "macro" && (
            <div className="acc-panel">
              <div className="pf-form-5">
                <div className="pf-form-cell">
                  <label>Đạm (%)</label>
                  <input type="number" placeholder={`${prot}`} disabled />
                </div>
                <div className="pf-form-cell">
                  <label>Đường bột (%)</label>
                  <input type="number" placeholder={`${carb}`} disabled />
                </div>
                <div className="pf-form-cell">
                  <label>Chất béo (%)</label>
                  <input type="number" placeholder={`${fat}`} disabled />
                </div>
                <div className="pf-form-cell">
                  <label>Tổng</label>
                  <input disabled value={`${prot + carb + fat}%`} />
                </div>
                <div className="pf-form-cell">
                  <label>&nbsp;</label>
                  <button className="btn-success" disabled>
                    Lưu Macro
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Placeholders */}
        <AccDisabled label="Lượng nước" openKey={openKey} toggle={toggle} k="water" />
        <AccDisabled label="Bước chân mục tiêu" openKey={openKey} toggle={toggle} k="steps" />
      </div>
    </div>
  );
}

function AccDisabled({ label, openKey, toggle, k }) {
  return (
    <div>
      <button
        className={`acc-row ${openKey === k ? "is-open" : ""}`}
        onClick={() => toggle(k)}
        aria-expanded={openKey === k}
      >
        <span>{label}</span>
        <i className="chev">{">"}</i>
      </button>
      {openKey === k && (
        <div className="acc-panel">
          <div className="pf-form-5">
            <div className="pf-form-cell">
              <label>Giá trị</label>
              <input placeholder="Đang phát triển…" disabled />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MacroRing({ label, pct, tone = "prot" }) {
  return (
    <div className={`kpi-macro tone-${tone}`}>
      <div
        className={`ring pct-${pct}`}            
        style={{ ["--p"]: pct }}               
        aria-label={`${label} ${pct}%`}
        title={`${label}: ${pct}%`}
      >
        <span className="ring-text"><strong>{pct}%</strong></span>
      </div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

