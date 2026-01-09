import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

/* ============ Helpers ============ */
const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export function computeRangeLastDays(days) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (Number(days) - 1));
  return { from: toISODate(from), to: toISODate(to) };
}

/* ============ Breadcrumb ============ */
export function StatsBreadcrumb({ current, groupLabel = "Thống kê" }) {
  return (
    <nav className="st-breadcrumb" aria-label="breadcrumb">
      <Link to="/dashboard">
        <i className="fa-solid fa-house" /> <span>Trang chủ</span>
      </Link>
      <span className="sep">/</span>
      <span className="grp">
        <i className="fa-solid fa-chart-line" /> <span>{groupLabel}</span>
      </span>
      <span className="sep">/</span>
      <span className="cur">{current}</span>
    </nav>
  );
}

/* ============ Shell card ============ */
export function StatsCard({ title, subtitle, count, actions, children }) {
  return (
    <div className="st-card">
      <div className="st-head">
        <div className="st-head-left">
          <h2>
            {title}{" "}
            {typeof count === "number" && (
              <span className="st-count">({count})</span>
            )}
          </h2>
          {subtitle ? <div className="st-subtitle">{subtitle}</div> : null}
        </div>
        <div className="st-actions">{actions}</div>
      </div>

      {children}
    </div>
  );
}

/* ============ Buttons ============ */
export function SButton({ variant = "ghost", disabled, onClick, icon, children, title }) {
  const cls =
    "st-btn" +
    (variant === "primary" ? " primary" : "") +
    (variant === "danger" ? " danger" : "") +
    (variant === "ghost" ? " ghost" : "");
  return (
    <button className={cls} disabled={disabled} onClick={onClick} title={title} type="button">
      {icon ? <i className={icon} /> : null}
      <span>{children}</span>
    </button>
  );
}

/* ============ Filter Bar ============ */
export function StatsFilterBar({
  q,
  setQ,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  granularity,
  setGranularity,
  onQuickRange,
  children,
}) {
  return (
    <div className="st-filters">
      <div className="st-search">
        <i className="fa-solid fa-magnifying-glass" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tìm nhanh theo từ khóa (tuỳ chọn)…"
        />
      </div>

      <div className="st-filter-row">
        <div className="st-filter-group st-date-range">
          <span className="st-filter-label">Thời gian</span>
          <div className="st-date-row">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <span className="st-date-sep">đến</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          <div className="st-quick">
            <button type="button" className="st-quick-btn" onClick={() => onQuickRange?.(7)}>
              7 ngày
            </button>
            <button type="button" className="st-quick-btn" onClick={() => onQuickRange?.(30)}>
              30 ngày
            </button>
            <button type="button" className="st-quick-btn" onClick={() => onQuickRange?.(90)}>
              90 ngày
            </button>
          </div>
        </div>

        <div className="st-filter-group">
          <span className="st-filter-label">Chu kỳ</span>
          <select
            className="st-select"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value)}
          >
            <option value="day">Theo ngày</option>
            <option value="week">Theo tuần</option>
            <option value="month">Theo tháng</option>
          </select>
        </div>

        {/* Page-specific filters */}
        {children}
      </div>
    </div>
  );
}

/* ============ MultiSelect dropdown (giống Audit_Log, đổi prefix st-) ============ */
export function MultiSelectDropdown({
  label,
  placeholder,
  options,
  values,
  onChange,
  renderOptionLabel,
}) {
  const [open, setOpen] = useState(false);

  const toggleOption = (val) => {
    if (!val) return;
    if (values.includes(val)) onChange(values.filter((v) => v !== val));
    else onChange([...values, val]);
  };

  const displayText = useMemo(() => {
    if (!values.length) return placeholder || label;
    if (values.length === 1) {
      const v = values[0];
      return renderOptionLabel ? renderOptionLabel(v) : v;
    }
    return `${label}: ${values.length} mục`;
  }, [values, label, placeholder, renderOptionLabel]);

  return (
    <div className="st-ms">
      <button
        type="button"
        className={"st-ms-trigger" + (values.length ? " st-ms-trigger--selected" : "")}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="st-ms-trigger-text">{displayText}</span>
        <i className="fa-solid fa-caret-down" />
      </button>

      {open && (
        <div className="st-ms-menu">
          <button type="button" className="st-ms-clear" onClick={() => onChange([])}>
            <i className="fa-solid fa-xmark" />
            <span>Bỏ chọn tất cả</span>
          </button>

          <div className="st-ms-options">
            {options.map((opt) => {
              const v = opt;
              const checked = values.includes(v);
              const text = renderOptionLabel ? renderOptionLabel(v) : v || "(trống)";
              return (
                <label key={v || "_empty"} className="st-ms-option">
                  <input type="checkbox" checked={checked} onChange={() => toggleOption(v)} />
                  <span>{text}</span>
                </label>
              );
            })}
            {options.length === 0 && <div className="st-ms-empty">Chưa có dữ liệu bộ lọc</div>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============ KPI / Chart / Table blocks ============ */
export function KpiGrid({ children }) {
  return <div className="st-kpi-grid">{children}</div>;
}

export function KpiCard({ label, value, sub, icon, tone = "default" }) {
  return (
    <div className={"st-kpi st-kpi--" + tone}>
      <div className="st-kpi-top">
        <div className="st-kpi-label">{label}</div>
        {icon ? <i className={"st-kpi-ic " + icon} /> : null}
      </div>
      <div className="st-kpi-value">{value ?? "—"}</div>
      {sub ? <div className="st-kpi-sub">{sub}</div> : null}
    </div>
  );
}

export function ChartGrid({ children }) {
  return <div className="st-chart-grid">{children}</div>;
}

export function ChartCard({ title, hint, type = "line" }) {
  const icon =
    type === "line"
      ? "fa-solid fa-chart-line"
      : type === "bar"
      ? "fa-solid fa-chart-column"
      : "fa-solid fa-chart-pie";

  return (
    <div className="st-chart-card">
      <div className="st-chart-head">
        <div>
          <div className="st-chart-title">{title}</div>
          {hint ? <div className="st-chart-hint">{hint}</div> : null}
        </div>
        <i className={"st-chart-ic " + icon} />
      </div>

      {/* Placeholder (sau này thay bằng Recharts/ChartJS) */}
      <div className="st-chart-body">
        <div className="st-chart-placeholder">
          <i className={icon} />
          <div className="st-chart-placeholder-text">
            {type === "line" ? "Biểu đồ đường (Line)" : type === "bar" ? "Biểu đồ cột (Bar)" : "Biểu đồ tròn (Pie)"}
          </div>
          <div className="st-chart-placeholder-sub">Sẽ hiển thị dữ liệu theo bộ lọc ở trên</div>
        </div>
      </div>
    </div>
  );
}

export function SimpleTopTable({ columns, rows, emptyText = "Chưa có dữ liệu" }) {
  return (
    <div className="st-table">
      <div
        className="st-thead"
        style={{ gridTemplateColumns: columns.map((c) => c.w || "1fr").join(" ") }}
      >
        {columns.map((c) => (
          <div key={c.key} className="cell">
            {c.label}
          </div>
        ))}
      </div>

      {(!rows || rows.length === 0) && <div className="st-empty">{emptyText}</div>}

      {(rows || []).map((r, idx) => (
        <div
          key={r._key || idx}
          className="st-trow"
          style={{ gridTemplateColumns: columns.map((c) => c.w || "1fr").join(" ") }}
        >
          {columns.map((c) => (
            <div key={c.key} className="cell">
              {typeof c.render === "function" ? c.render(r, idx) : r?.[c.key]}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
