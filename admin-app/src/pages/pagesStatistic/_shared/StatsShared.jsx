import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import dayjs from "dayjs";

const pad2 = (n) => String(n).padStart(2, "0");
const toISODate = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export function computeRangeLastDays(days) {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (Number(days) - 1));
  return { from: toISODate(from), to: toISODate(to) };
}

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

        {children}
      </div>
    </div>
  );
}

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

const num = (v, fallback = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};

const fmtCompact = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("vi-VN");
};

const COLORS = ["#008080", "#2A9D8F", "#E9C46A", "#F4A261", "#E76F51", "#264653"];

function SafeResponsive({ height = 250, children }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setReady(true);
    };

    check();

    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(check);
      ro.observe(el);
    } else {
      window.addEventListener("resize", check);
    }

    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <div ref={ref} style={{ width: "100%", minWidth: 0, height, minHeight: height }}>
      {ready ? children : null}
    </div>
  );
}

const sanitizeId = (s) => String(s || "").replace(/[^a-zA-Z0-9_-]/g, "");

function RechartsLine({ data, height = 250 }) {
  const chartData = useMemo(() => {
    return (data || []).map((d) => ({
      t: d?.t ?? d?.date,
      v: num(d?.v ?? d?.value, 0),
    }));
  }, [data]);

  const uidRef = useRef(Math.random().toString(36).slice(2, 10));
  const gradientId = useMemo(() => `st-grad-${uidRef.current}-teal`, []);

  return (
    <SafeResponsive height={height}>
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#008080" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#008080" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />

          <XAxis
            dataKey="t"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6B7280", fontSize: 12 }}
            dy={10}
            tickFormatter={(str) => {
              const s = String(str || "");
              if (s.length > 5) return dayjs(s).format("DD/MM");
              return s;
            }}
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />

          <Tooltip
            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
            formatter={(val) => [fmtCompact(val), "Giá trị"]}
          />

          <Area type="monotone" dataKey="v" stroke="#008080" strokeWidth={2} fillOpacity={1} fill={`url(#${gradientId})`} />
        </AreaChart>
      </ResponsiveContainer>
    </SafeResponsive>
  );
}

function RechartsBar({ data, height = 250 }) {
  const chartData = useMemo(() => {
    return (data || []).map((d) => ({
      t: d?.t ?? d?.date,
      v: num(d?.v ?? d?.value, 0),
    }));
  }, [data]);

  return (
    <SafeResponsive height={height}>
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis
            dataKey="t"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6B7280", fontSize: 12 }}
            dy={10}
            tickFormatter={(str) => {
              const s = String(str || "");
              if (s.length > 5) return dayjs(s).format("DD/MM");
              return s;
            }}
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: "#F3F4F6" }}
            contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
            formatter={(val) => [fmtCompact(val), "Giá trị"]}
          />
          <Bar dataKey="v" fill="#008080" radius={[4, 4, 0, 0]} barSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </SafeResponsive>
  );
}

function RechartsPie({ data, height = 250, labelFormatter }) {
  const chartData = useMemo(() => {
    return (data || [])
      .map((d) => ({
        name: labelFormatter ? labelFormatter(d?.key ?? d?.name) : (d?.key ?? d?.name),
        value: num(d?.value ?? d?.v, 0),
      }))
      .filter((x) => x.value > 0);
  }, [data, labelFormatter]);

  return (
    <SafeResponsive height={height}>
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
          <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: "12px", fontWeight: 500 }} />
        </PieChart>
      </ResponsiveContainer>
    </SafeResponsive>
  );
}

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
          <RechartsPie data={data} labelFormatter={labelFormatter} />
        ) : type === "bar" ? (
          <RechartsBar data={data} />
        ) : (
          <RechartsLine data={data} />
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