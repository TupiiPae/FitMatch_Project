// user-app/src/pages/Account/Profile/GoalsCustomize.jsx
import React, { useMemo, useState } from "react";
import "./GoalsCustomize.css";

export default function GoalsCustomize({ user }) {
  const p = user?.profile || {};

  // Calo mục tiêu: ưu tiên calorieTarget, fallback TDEE
  const calDisplay = useMemo(() => {
    const t = typeof p.calorieTarget === "number" ? p.calorieTarget : p.tdee;
    return typeof t === "number" ? Math.round(t) : "";
  }, [p.calorieTarget, p.tdee]);

  // Macro: ưu tiên lấy từ user.profile nếu có, fallback 20/50/30
  const prot = useMemo(() => (Number.isFinite(p.macroProtein) ? p.macroProtein : 20), [p.macroProtein]);
  const carb = useMemo(() => (Number.isFinite(p.macroCarb) ? p.macroCarb : 50), [p.macroCarb]);
  const fat  = useMemo(() => (Number.isFinite(p.macroFat) ? p.macroFat : 30), [p.macroFat]);

  // Clamp và làm tròn để vẽ vòng tròn mượt
  const clampPct = (x) => Math.max(0, Math.min(100, Math.round(x || 0)));

  // Accordion UI
  const [openKey, setOpenKey] = useState(null);
  const toggle = (k) => setOpenKey((prev) => (prev === k ? null : k));

  return (
    <div className="gc-page">
      {/* ===== Section 1: Thông tin dinh dưỡng + KPI ===== */}
      <section className="gc-section">
        <h1 className="gc-title-main">Tùy chỉnh mục tiêu</h1>
        <h2 className="gc-title-sub">Thông tin dinh dưỡng</h2>

        {/* KPI */}
        <div className="goal-frame">
          <div className="goal-row-center">
            <div className="kpi-cal">
              <div className="cal-val">{calDisplay || "—"}</div>
              <div className="cal-sub">CALO MỤC TIÊU</div>
            </div>

            <MacroRing label="Chất đạm" pct={clampPct(prot)} tone="prot" />
            <MacroRing label="Đường bột" pct={clampPct(carb)} tone="carb" />
            <MacroRing label="Chất béo" pct={clampPct(fat)} tone="fat" />
          </div>
        </div>

        {/* BMR / TDEE */}
        <div className="goal-facts filled">
          <div className="fact-row">
            <span>Tỷ lệ trao đổi chất cơ bản (BMR)</span>
            <strong>
              {Number.isFinite(p.bmr) ? Math.round(p.bmr) : "—"}
            </strong>
          </div>
          <div className="fact-row">
            <span>Tổng năng lượng tiêu thụ mỗi ngày (TDEE)</span>
            <strong>
              {Number.isFinite(p.tdee) ? Math.round(p.tdee) : "—"}
            </strong>
          </div>
        </div>
      </section>

      {/* ===== Section 2: Tùy chỉnh mục tiêu dinh dưỡng ===== */}
      <section className="gc-section">
        <h2 className="gc-title-sub">Tùy chỉnh mục tiêu dinh dưỡng</h2>

        <div className="goal-acc">
          {/* Calorie target (UI only, đọc từ user) */}
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
                    <input
                      type="number"
                      value={calDisplay}
                      readOnly
                      placeholder="vd. 2200"
                    />
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

          {/* Macro (UI only, đọc từ user) */}
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
                    <input type="number" value={prot} readOnly />
                  </div>
                  <div className="pf-form-cell">
                    <label>Đường bột (%)</label>
                    <input type="number" value={carb} readOnly />
                  </div>
                  <div className="pf-form-cell">
                    <label>Chất béo (%)</label>
                    <input type="number" value={fat} readOnly />
                  </div>
                  <div className="pf-form-cell">
                    <label>Tổng</label>
                    <input disabled value={`${clampPct(prot + carb + fat)}%`} />
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
          <AccDisabled
            label="Lượng nước"
            openKey={openKey}
            toggle={toggle}
            k="water"
          />
          <AccDisabled
            label="Bước chân mục tiêu"
            openKey={openKey}
            toggle={toggle}
            k="steps"
          />
        </div>
      </section>
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
  const safePct = Math.max(0, Math.min(100, Math.round(pct || 0)));
  return (
    <div className={`kpi-macro tone-${tone}`}>
      <div
        className={`ring pct-${safePct}`}
        style={{ ["--p"]: safePct }}
        aria-label={`${label} ${safePct}%`}
        title={`${label}: ${safePct}%`}
      >
        <span className="ring-text"><strong>{safePct}%</strong></span>
      </div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}
