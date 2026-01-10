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
    if (!values.length) return placeholder || "Chọn...";
    if (values.length === 1) {
      const v = values[0];
      return renderOptionLabel ? renderOptionLabel(v) : v;
    }
    // tránh phụ thuộc label (vd: Goal/Sex) để không lộ tiếng Anh trên UI
    return `Đã chọn: ${values.length} mục`;
  }, [values, placeholder, renderOptionLabel, label]);

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

/* =========================
 * Chart helpers (SVG)
 * ========================= */
const num = (v, fallback = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const fmtCompact = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  // đổi K/M sang N/Tr (nghìn/triệu) để tránh tiếng Anh trên UI
  if (Math.abs(x) >= 1_000_000) return (x / 1_000_000).toFixed(1).replace(/\.0$/, "") + "Tr";
  if (Math.abs(x) >= 1_000) return (x / 1_000).toFixed(1).replace(/\.0$/, "") + "N";
  return String(Math.round(x));
};

const toLineSeries = (data) => {
  const arr = Array.isArray(data) ? data : [];
  // Expect [{t,v}] but accept common shapes
  return arr
    .map((d, i) => {
      const t = d?.t ?? d?._id ?? d?.x ?? d?.date ?? i;
      const v = d?.v ?? d?.value ?? d?.y ?? d?.count ?? 0;
      return { t: String(t), v: num(v, 0) };
    })
    .filter((x) => Number.isFinite(x.v));
};

const toPieSeries = (data) => {
  const arr = Array.isArray(data) ? data : [];
  return arr
    .map((d, i) => {
      const key = d?.key ?? d?._id ?? d?.name ?? d?.label ?? `#${i + 1}`;
      const value = d?.value ?? d?.v ?? d?.count ?? 0;
      return { key: String(key), value: num(value, 0) };
    })
    .filter((x) => x.value > 0);
};

function MiniLineChart({ data, height = 190 }) {
  const series = useMemo(() => toLineSeries(data), [data]);
  const n = series.length;

  const { minY, maxY, points } = useMemo(() => {
    if (!n) return { minY: 0, maxY: 1, points: [] };
    let min = Infinity;
    let max = -Infinity;
    for (const p of series) {
      if (p.v < min) min = p.v;
      if (p.v > max) max = p.v;
    }
    if (min === max) {
      // tạo khoảng để nhìn thấy line
      min = min - 1;
      max = max + 1;
    }
    // viewBox
    const VBW = 100;
    const VBH = 50;
    const padL = 6;
    const padR = 4;
    const padT = 6;
    const padB = 8;

    const innerW = VBW - padL - padR;
    const innerH = VBH - padT - padB;

    const pts = series.map((p, i) => {
      const x = padL + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
      const y = padT + (1 - (p.v - min) / (max - min)) * innerH;
      return { x, y, t: p.t, v: p.v };
    });

    return { minY: min, maxY: max, points: pts };
  }, [series, n]);

  const poly = points.map((p) => `${p.x},${p.y}`).join(" ");

  const last = points[points.length - 1];
  const first = points[0];

  if (!n) {
    return (
      <div className="st-chart-placeholder">
        <i className="fa-solid fa-chart-line" />
        <div className="st-chart-placeholder-text">Chưa có dữ liệu</div>
        <div className="st-chart-placeholder-sub">Hãy thay đổi bộ lọc hoặc chọn khoảng thời gian khác</div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <svg viewBox="0 0 100 50" width="100%" height={height} role="img" aria-label="Biểu đồ đường">
        {/* grid */}
        <line x1="6" y1="42" x2="96" y2="42" stroke="#E5E7EB" strokeWidth="0.6" />
        <line x1="6" y1="26" x2="96" y2="26" stroke="#F3F4F6" strokeWidth="0.6" />
        <line x1="6" y1="10" x2="96" y2="10" stroke="#F3F4F6" strokeWidth="0.6" />

        {/* polyline */}
        <polyline fill="none" stroke="#008080" strokeWidth="1.4" points={poly} />

        {/* points */}
        {points.map((p, idx) => (
          <circle key={idx} cx={p.x} cy={p.y} r="1.2" fill="#008080">
            <title>{`${p.t}: ${p.v}`}</title>
          </circle>
        ))}

        {/* value badges (min/max label at top) */}
        <text x="6" y="7" fontSize="3.2" fill="#6B7280">
          {fmtCompact(maxY)}
        </text>
        <text x="6" y="47.5" fontSize="3.2" fill="#6B7280">
          {fmtCompact(minY)}
        </text>

        {/* x labels (first/last) */}
        {first ? (
          <text x={clamp(first.x, 6, 96)} y="49" fontSize="3.2" fill="#6B7280" textAnchor="start">
            {first.t}
          </text>
        ) : null}
        {last && last !== first ? (
          <text x={clamp(last.x, 6, 96)} y="49" fontSize="3.2" fill="#6B7280" textAnchor="end">
            {last.t}
          </text>
        ) : null}
      </svg>
    </div>
  );
}

function MiniBarChart({ data, height = 190 }) {
  const series = useMemo(() => toLineSeries(data), [data]); // reuse
  const n = series.length;

  const bars = useMemo(() => {
    if (!n) return [];
    const max = Math.max(...series.map((p) => p.v), 1);
    // viewBox
    const VBW = 100;
    const VBH = 50;
    const padL = 6;
    const padR = 4;
    const padT = 6;
    const padB = 10;

    const innerW = VBW - padL - padR;
    const innerH = VBH - padT - padB;

    const gap = n > 18 ? 0.2 : 0.6;
    const barW = innerW / n - gap;

    return series.map((p, i) => {
      const h = (p.v / max) * innerH;
      const x = padL + i * (innerW / n) + gap / 2;
      const y = padT + (innerH - h);
      return { x, y, w: Math.max(0.8, barW), h, t: p.t, v: p.v };
    });
  }, [series, n]);

  if (!n) {
    return (
      <div className="st-chart-placeholder">
        <i className="fa-solid fa-chart-column" />
        <div className="st-chart-placeholder-text">Chưa có dữ liệu</div>
        <div className="st-chart-placeholder-sub">Hãy thay đổi bộ lọc hoặc chọn khoảng thời gian khác</div>
      </div>
    );
  }

  const maxV = Math.max(...series.map((x) => x.v), 0);

  return (
    <div style={{ width: "100%" }}>
      <svg viewBox="0 0 100 50" width="100%" height={height} role="img" aria-label="Biểu đồ cột">
        <line x1="6" y1="40" x2="96" y2="40" stroke="#E5E7EB" strokeWidth="0.6" />
        <text x="6" y="7" fontSize="3.2" fill="#6B7280">
          {fmtCompact(maxV)}
        </text>

        {bars.map((b, idx) => (
          <rect
            key={idx}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx="0.8"
            fill="#008080"
            opacity="0.9"
          >
            <title>{`${b.t}: ${b.v}`}</title>
          </rect>
        ))}

        {/* show first/last label */}
        {bars[0] ? (
          <text x={clamp(bars[0].x, 6, 96)} y="49" fontSize="3.2" fill="#6B7280" textAnchor="start">
            {bars[0].t}
          </text>
        ) : null}
        {bars[bars.length - 1] ? (
          <text
            x={clamp(bars[bars.length - 1].x + 6, 6, 96)}
            y="49"
            fontSize="3.2"
            fill="#6B7280"
            textAnchor="end"
          >
            {bars[bars.length - 1].t}
          </text>
        ) : null}
      </svg>
    </div>
  );
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} L ${cx} ${cy} Z`;
}

function MiniPieChart({ data, height = 190, labelFormatter }) {
  const series = useMemo(() => toPieSeries(data), [data]);
  const total = useMemo(() => series.reduce((s, x) => s + x.value, 0), [series]);

  const slices = useMemo(() => {
    if (!series.length || total <= 0) return [];
    let acc = 0;
    return series.map((s, i) => {
      const pct = s.value / total;
      const start = acc * 360;
      acc += pct;
      const end = acc * 360;

      // màu theo HSL để tự động đa dạng
      const hue = (i * 67) % 360;
      const fill = `hsl(${hue} 70% 52%)`;

      return {
        ...s,
        start,
        end,
        fill,
        pct,
        label: typeof labelFormatter === "function" ? labelFormatter(s.key) : s.key,
      };
    });
  }, [series, total, labelFormatter]);

  if (!series.length) {
    return (
      <div className="st-chart-placeholder">
        <i className="fa-solid fa-chart-pie" />
        <div className="st-chart-placeholder-text">Chưa có dữ liệu</div>
        <div className="st-chart-placeholder-sub">Hãy thay đổi bộ lọc hoặc chọn khoảng thời gian khác</div>
      </div>
    );
  }

  const topLegend = slices.slice(0, 6);

  return (
    <div style={{ width: "100%", display: "grid", gridTemplateColumns: "180px 1fr", gap: 12, alignItems: "center" }}>
      <svg
        viewBox="0 0 60 60"
        width="100%"
        height={height}
        role="img"
        aria-label="Biểu đồ tròn"
        style={{ maxWidth: 210 }}
      >
        {/* background ring */}
        <circle cx="30" cy="30" r="22" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="0.8" />
        {slices.map((s, idx) => (
          <path key={idx} d={describeArc(30, 30, 22, s.start, s.end)} fill={s.fill} opacity="0.95">
            <title>{`${s.label}: ${s.value} (${Math.round(s.pct * 100)}%)`}</title>
          </path>
        ))}
        {/* donut hole */}
        <circle cx="30" cy="30" r="12" fill="#fff" />
        <text x="30" y="29.5" fontSize="4" textAnchor="middle" fill="#111827" fontWeight="800">
          {fmtCompact(total)}
        </text>
        <text x="30" y="35" fontSize="2.6" textAnchor="middle" fill="#6B7280">
          tổng
        </text>
      </svg>

      <div style={{ width: "100%" }}>
        <div style={{ display: "grid", gap: 6 }}>
          {topLegend.map((s, idx) => (
            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: s.fill, flex: "0 0 10px" }} />
              <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#111827",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {s.label}
                </div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>
                  {fmtCompact(s.value)} • {Math.round(s.pct * 100)}%
                </div>
              </div>
            </div>
          ))}
          {slices.length > topLegend.length ? (
            <div style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
              +{slices.length - topLegend.length} phân khúc khác
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * ChartCard:
 *  - type: line | bar | pie
 *  - data: line/bar: [{t, v}] ; pie: [{key,value}] (BE trả vậy)
 *  - labelFormatter: dùng cho pie (map key -> label)
 */
export function ChartCard({ title, hint, type = "line", data, labelFormatter }) {
  const icon =
    type === "line"
      ? "fa-solid fa-chart-line"
      : type === "bar"
      ? "fa-solid fa-chart-column"
      : "fa-solid fa-chart-pie";

  const hasData = Array.isArray(data) && data.length > 0;

  return (
    <div className="st-chart-card">
      <div className="st-chart-head">
        <div>
          <div className="st-chart-title">{title}</div>
          {hint ? <div className="st-chart-hint">{hint}</div> : null}
        </div>
        <i className={"st-chart-ic " + icon} />
      </div>

      <div className="st-chart-body">
        {!hasData ? (
          <div className="st-chart-placeholder">
            <i className={icon} />
            <div className="st-chart-placeholder-text">
              {type === "line" ? "Biểu đồ đường" : type === "bar" ? "Biểu đồ cột" : "Biểu đồ tròn"}
            </div>
            <div className="st-chart-placeholder-sub">Chưa có dữ liệu theo bộ lọc hiện tại</div>
          </div>
        ) : type === "pie" ? (
          <MiniPieChart data={data} labelFormatter={labelFormatter} />
        ) : type === "bar" ? (
          <MiniBarChart data={data} />
        ) : (
          <MiniLineChart data={data} />
        )}
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
