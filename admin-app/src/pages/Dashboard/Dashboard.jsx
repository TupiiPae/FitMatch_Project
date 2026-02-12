import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { toast } from "react-toastify";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  getStatsUsersAdmin,
  getStatsNutritionAdmin,
  getStatsWorkoutsAdmin,
  getConnectStats,
  getStatsPremiumAdmin,
} from "../../lib/api";

import "./Dashboard.css";

const safeArr = (v) => (Array.isArray(v) ? v : []);
const fmtNum = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("vi-VN");
};
const fmtPct = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n}%`;
};

const num = (v, fallback = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};

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


function ModernChart({ data = [], color = "#008080", height = 250, emptyText = "Chưa có dữ liệu" }) {
  const arr = safeArr(data);

  // id gradient: tránh trùng + tránh ký tự # gây lỗi url(#...)
  const uidRef = useRef(Math.random().toString(36).slice(2, 10));
  const gradientId = useMemo(
    () => `db-grad-${uidRef.current}-${sanitizeId(color)}`,
    [color]
  );

  if (!arr.length) {
    return (
      <div className="db-chart-empty" style={{ height }}>
        {emptyText}
      </div>
    );
  }

  return (
    <SafeResponsive height={height}>
      <ResponsiveContainer width="100%" height={height} minWidth={0}>
        <AreaChart data={arr} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
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
            contentStyle={{
              backgroundColor: "#fff",
              borderRadius: "8px",
              border: "1px solid #E5E7EB",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              fontSize: "13px",
            }}
            formatter={(value) => [fmtNum(value), "Giá trị"]}
            labelStyle={{ color: "#374151", fontWeight: 600, marginBottom: "4px" }}
          />

          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </SafeResponsive>
  );
}

function ModernRankingList({ title, items = [], emptyText = "Chưa có dữ liệu", color = "#008080" }) {
  const arr = safeArr(items);
  const maxValue = Math.max(...arr.map((i) => Number(i.value) || 0), 1);

  return (
    <div className="db-panel">
      <div className="db-panel-head">
        <h4>{title}</h4>
      </div>
      {arr.length === 0 ? (
        <div className="db-panel-empty">{emptyText}</div>
      ) : (
        <div className="db-ranking-list">
          {arr.map((item, idx) => {
            const val = Number(item.value) || 0;
            const percent = (val / maxValue) * 100;
            return (
              <div key={idx} className="db-ranking-item">
                <div className="db-ranking-info">
                  <span className="db-ranking-name">{item.name}</span>
                  <span className="db-ranking-val">{fmtNum(val)}</span>
                </div>
                <div className="db-progress-bg">
                  <div
                    className="db-progress-fill"
                    style={{ width: `${percent}%`, backgroundColor: color }}
                  />
                </div>
                {item.note && <div className="db-ranking-note">{item.note}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function KpiCard({ title, value, sub, tone = "default" }) {
  return (
    <div className={`db-kpi db-kpi--${tone}`}>
      <div className="db-kpi-title">{title}</div>
      <div className="db-kpi-value">{value}</div>
      {sub ? <div className="db-kpi-sub">{sub}</div> : <div className="db-kpi-sub"> </div>}
    </div>
  );
}

export default function Dashboard() {
  const today = useMemo(() => dayjs().format("YYYY-MM-DD"), []);
  const defaultFrom = useMemo(() => dayjs().subtract(29, "day").format("YYYY-MM-DD"), []);

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(today);
  const [granularity, setGranularity] = useState("day");
  const [q, setQ] = useState("");
  const [top, setTop] = useState(8);

  const granularityLabel = useMemo(() => {
    if (granularity === "day") return "Ngày";
    if (granularity === "week") return "Tuần";
    if (granularity === "month") return "Tháng";
    return "—";
  }, [granularity]);

  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const [usersStats, setUsersStats] = useState(null);
  const [nutritionStats, setNutritionStats] = useState(null);
  const [workoutsStats, setWorkoutsStats] = useState(null);
  const [connectStats, setConnectStats] = useState(null);
  const [premiumStats, setPremiumStats] = useState(null);

  const params = useMemo(() => {
    const p = { granularity, top };
    if (dateFrom) p.from = dateFrom;
    if (dateTo) p.to = dateTo;
    if (q && q.trim()) p.q = q.trim();
    return p;
  }, [granularity, top, dateFrom, dateTo, q]);

  const load = async (overrideParams) => {
    setLoading(true);
    try {
      const p = overrideParams || params;
      const [pm, u, n, w, c] = await Promise.all([
        getStatsPremiumAdmin(p),
        getStatsUsersAdmin(p),
        getStatsNutritionAdmin(p),
        getStatsWorkoutsAdmin(p),
        getConnectStats(p),
      ]);
      setPremiumStats(pm || null);
      setUsersStats(u || null);
      setNutritionStats(n || null);
      setWorkoutsStats(w || null);
      setConnectStats(c || null);
      setLastUpdatedAt(new Date());
    } catch (e) {
      console.error(e);
      toast.error("Không tải được dữ liệu bảng tổng quan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const clearFilters = () => {
    const next = {
      q: "",
      granularity: "day",
      top: 8,
      from: defaultFrom,
      to: today,
    };
    setQ(next.q);
    setGranularity(next.granularity);
    setTop(next.top);
    setDateFrom(next.from);
    setDateTo(next.to);

    load({
      q: "",
      granularity: next.granularity,
      top: next.top,
      from: next.from,
      to: next.to,
    });
  };

  const uK = usersStats?.kpis || {};
  const nK = nutritionStats?.kpis || {};
  const wK = workoutsStats?.kpis || {};
  const cK = connectStats?.kpis || {};
  const pK = premiumStats?.kpis || {};
  const pSeriesRevenue = safeArr(premiumStats?.series?.revenue);
  const pSeriesPaidOrders = safeArr(premiumStats?.series?.paidOrders);

  const topPlansByRevenue = safeArr(premiumStats?.top?.plansByRevenue).map((x) => ({
    name: x?.name || x?.code || "—",
    value: Number(x?.revenue || 0),
    note: x?.orders ? `${x.orders} giao dịch` : "",
  }));

  const topUsersByRevenue = safeArr(premiumStats?.top?.usersByRevenue).map((x) => ({
    name: x?.name || "—",
    value: Number(x?.revenue || 0),
    note: x?.orders ? `${x.orders} giao dịch` : "",
  }));

  const uSeriesNew = safeArr(usersStats?.series?.newUsers);
  const uSeriesActive = safeArr(usersStats?.series?.activeUsers);

  const nSeriesKcal = safeArr(nutritionStats?.series?.kcalLogged);

  const wSeriesPlans = safeArr(workoutsStats?.series?.plansCreated);
  const wSeriesKcal = safeArr(workoutsStats?.series?.kcalBurned);

  const cSeriesRooms = safeArr(connectStats?.series?.roomsCreated);
  const cSeriesReq = safeArr(connectStats?.series?.requestsCreated);
  const cSeriesRep = safeArr(connectStats?.series?.reportsCreated);
  const cSeriesMsg = safeArr(connectStats?.series?.messagesSent);

  const topSegments = safeArr(usersStats?.topSegments).map((x) => ({
    name: x?.name || "—",
    value: x?.value ?? "—",
    note: x?.note || "",
  }));

  const topFoods = safeArr(nutritionStats?.topFoods).map((x) => ({
    name: x?.name || "—",
    value: x?.value ?? "—",
    note: x?.note || "",
  }));

  const topExercises = safeArr(workoutsStats?.topExercises).map((x) => ({
    name: x?.name || "—",
    value: x?.value ?? "—",
    note: x?.note || "",
  }));

  const topGroups = safeArr(connectStats?.top?.groupsByMembers)
    .map((x, idx) => {
      const members = num(
        x?.members ?? x?.memberCount ?? x?.count ?? x?.value ?? 0,
        0
      );
      return {
        name: x?.name || `Nhóm #${idx + 1}`,
        value: members, // luôn là số
        note: x?.note || "",
      };
    })
    .filter((x) => num(x.value, 0) >= 1)          // loại nhóm đã đóng (0 thành viên)
    .sort((a, b) => num(b.value, 0) - num(a.value, 0)); // đảm bảo top đúng theo thành viên

  const topReportReasons = safeArr(connectStats?.top?.reportReasonsTop).map((x) => ({
    name: x?.key || x?.name || "—",
    value: x?.value ?? "—",
    note: "Lý do báo cáo",
  }));

  return (
    <div className="al-page db-page">
      <nav className="al-breadcrumb" aria-label="breadcrumb">
        <Link to="/dashboard">
          <i className="fa-solid fa-house" /> <span>Trang chủ</span>
        </Link>
        <span className="sep">/</span>
        <span className="grp">
          <i className="fa-solid fa-chart-line" /> <span>Thống kê</span>
        </span>
        <span className="sep">/</span>
        <span className="cur">
          <i className="fa-solid fa-gauge-high" /> <span>Tổng quan</span>
        </span>
      </nav>

      <div className="al-card db-card">
        <div className="al-head db-head">
          <div className="db-head-left">
            <h2>
              Bảng tổng quan {loading ? <span className="db-muted">(Đang tải...)</span> : null}
            </h2>
            <div className="db-subline">
              {lastUpdatedAt ? (
                <>
                  Cập nhật lúc{" "}
                  <strong>{new Date(lastUpdatedAt).toLocaleString("vi-VN")}</strong>
                </>
              ) : (
                <span className="db-muted">Chưa có dữ liệu</span>
              )}
            </div>
          </div>

          <div className="al-actions">
            <button type="button" className="btn ghost" onClick={clearFilters}>
              <i className="fa-solid fa-eraser" />
              <span>Xoá bộ lọc</span>
            </button>
            <button type="button" className="btn ghost" onClick={() => load()}>
              <i className="fa-solid fa-rotate-right" />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        <div className="al-filters db-filters">
          <div className="al-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm nhanh: người dùng, món ăn, lịch tập, phòng nhóm..."
            />
          </div>

          <div className="al-filter-row">
            <div className="al-filter-group">
              <span className="al-filter-label">Nhóm theo thời gian</span>
              <select
                value={granularity}
                onChange={(e) => setGranularity(e.target.value)}
              >
                <option value="day">Ngày</option>
                <option value="week">Tuần</option>
                <option value="month">Tháng</option>
              </select>
            </div>

            <div className="al-filter-group">
              <span className="al-filter-label">Số mục xếp hạng</span>
              <select
                value={top}
                onChange={(e) => setTop(Number(e.target.value) || 8)}
              >
                <option value="5">5 mục</option>
                <option value="8">8 mục</option>
                <option value="10">10 mục</option>
                <option value="15">15 mục</option>
                <option value="20">20 mục</option>
              </select>
            </div>

            <div className="al-filter-group al-date-range">
              <span className="al-filter-label">Thời gian</span>
              <div className="al-date-row">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <span className="al-date-sep">đến</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            <button
              type="button"
              className="btn primary"
              onClick={() => load()}
              disabled={loading}
              title="Áp dụng bộ lọc"
            >
              <i className="fa-solid fa-filter" />
              <span>Áp dụng</span>
            </button>
          </div>
        </div>

        <div className="db-section db-section--revenue">
          <div className="db-section-head">
            <h3>
              <i className="fa-solid fa-sack-dollar" /> Doanh thu Premium
            </h3>
            <div className="db-section-meta">
              {premiumStats?.query?.from && premiumStats?.query?.to ? (
                <span>
                  Khoảng: <strong>{premiumStats.query.from}</strong> →{" "}
                  <strong>{premiumStats.query.to}</strong>
                </span>
              ) : (
                <span className="db-muted">—</span>
              )}
            </div>
          </div>

          <div className="db-kpi-grid">
            <KpiCard title="Doanh thu đã nhận (PAID)" value={fmtNum(pK?.revenuePaid)} tone="good" />
            <KpiCard title="Giao dịch đã thanh toán" value={fmtNum(pK?.ordersPaid)} />
            <KpiCard title="Chờ thanh toán" value={fmtNum(pK?.ordersPending)} tone="warn" />
            <KpiCard title="Hủy" value={fmtNum(pK?.ordersCancelled)} tone="bad" />
            <KpiCard title="Người mua (unique)" value={fmtNum(pK?.uniquePayers)} />
            <KpiCard title="Người mua mới trong khoảng" value={fmtNum(pK?.newPremiumUsersInRange)} />
            <KpiCard title="Premium đang hoạt động" value={fmtNum(pK?.activePremiumUsers)} tone="good" />
            <KpiCard title="Tổng tài khoản Premium" value={fmtNum(pK?.totalPremiumUsers)} />
          </div>

          <div className="db-panels-2">
            <div className="db-panel">
              <div className="db-panel-head">
                <h4>Doanh thu theo thời gian</h4>
                <span className="db-muted">({granularityLabel})</span>
              </div>
              <ModernChart data={pSeriesRevenue} color="#7C3AED" emptyText="Chưa có giao dịch PAID" />
            </div>

            <div className="db-panel">
              <div className="db-panel-head">
                <h4>Số giao dịch PAID theo thời gian</h4>
                <span className="db-muted">({granularityLabel})</span>
              </div>
              <ModernChart data={pSeriesPaidOrders} color="#4F46E5" emptyText="Chưa có giao dịch PAID" />
            </div>
          </div>

          <div className="db-panels-2">
            <ModernRankingList
              title={`Gói Premium doanh thu cao nhất (${top} mục)`}
              items={topPlansByRevenue}
              color="#7C3AED"
              emptyText="Chưa có dữ liệu doanh thu"
            />
            <ModernRankingList
              title={`Người dùng chi tiêu nhiều nhất (${top} mục)`}
              items={topUsersByRevenue}
              color="#4F46E5"
              emptyText="Chưa có dữ liệu doanh thu"
            />
          </div>
        </div>

        <div className="db-section">
          <div className="db-section-head">
            <h3>
              <i className="fa-solid fa-users" /> Người dùng
            </h3>
            <div className="db-section-meta">
              {usersStats?.query?.from && usersStats?.query?.to ? (
                <span>
                  Khoảng: <strong>{usersStats.query.from}</strong> →{" "}
                  <strong>{usersStats.query.to}</strong>
                </span>
              ) : (
                <span className="db-muted">—</span>
              )}
            </div>
          </div>

          <div className="db-kpi-grid">
            <KpiCard
              title="Tổng người dùng (toàn hệ thống)"
              value={fmtNum(uK?.totalAll)}
            />
            <KpiCard
              title="Tổng người dùng (theo bộ lọc)"
              value={fmtNum(uK?.totalFiltered)}
            />
            <KpiCard
              title="Người dùng mới trong khoảng"
              value={fmtNum(uK?.newUsersInRange)}
              tone="good"
            />
            <KpiCard
              title="Người dùng bị khoá"
              value={fmtNum(uK?.blockedFiltered)}
              tone="warn"
            />
            <KpiCard
              title="Hoàn tất onboarding"
              value={fmtNum(uK?.onboardedFiltered)}
              sub={`Tỉ lệ: ${fmtPct(uK?.onboardedRate)}`}
            />
            <KpiCard
              title="Hồ sơ đầy đủ"
              value={fmtNum(uK?.profileCompleteFiltered)}
              sub={`Tỉ lệ: ${fmtPct(uK?.profileCompleteRate)}`}
            />
            <KpiCard
              title="Người dùng hoạt động (hôm nay)"
              value={fmtNum(uK?.active?.dau)}
            />
            <KpiCard
              title="Hoạt động 7 ngày / 30 ngày"
              value={`${fmtNum(uK?.active?.wau)} / ${fmtNum(uK?.active?.mau)}`}
            />
          </div>

          <div className="db-panels-2">
            <div className="db-panel">
              <div className="db-panel-head">
                <h4>Người dùng mới theo thời gian</h4>
                <span className="db-muted">({granularityLabel})</span>
              </div>
              <ModernChart data={uSeriesNew} color="#008080" />
            </div>

            <div className="db-panel">
              <div className="db-panel-head">
                <h4>Người dùng hoạt động theo thời gian</h4>
                <span className="db-muted">({granularityLabel})</span>
              </div>
              <ModernChart data={uSeriesActive} color="#2A9D8F" />
            </div>
          </div>

          <div className="db-panels-1">
            <ModernRankingList
              title="Phân khúc nổi bật (theo bộ lọc)"
              items={topSegments}
              color="#008080"
            />
          </div>
        </div>

        <div className="db-section">
          <div className="db-section-head">
            <h3>
              <i className="fa-solid fa-bowl-food" /> Dinh dưỡng
            </h3>
            <div className="db-section-meta">
              {nutritionStats?.query?.from && nutritionStats?.query?.to ? (
                <span>
                  Khoảng: <strong>{nutritionStats.query.from}</strong> →{" "}
                  <strong>{nutritionStats.query.to}</strong>
                </span>
              ) : (
                <span className="db-muted">—</span>
              )}
            </div>
          </div>

          <div className="db-kpi-grid">
            <KpiCard title="Tổng nhật ký dinh dưỡng" value={fmtNum(nK?.totalLogs)} />
            <KpiCard title="Người dùng có nhật ký" value={fmtNum(nK?.usersWithLogs)} />
            <KpiCard
              title="TB kcal / người / ngày"
              value={fmtNum(nK?.avgKcalPerUserDay)}
              tone="good"
            />
            <KpiCard
              title="TB đạm / người / ngày"
              value={fmtNum(nK?.avgProteinPerUserDay)}
            />
            <KpiCard title="Món ăn chờ duyệt" value={fmtNum(nK?.foodsPending)} tone="warn" />
            <KpiCard title="Món ăn đã duyệt" value={fmtNum(nK?.foodsApproved)} tone="good" />
            <KpiCard title="Món ăn bị từ chối" value={fmtNum(nK?.foodsRejected)} tone="bad" />
            <KpiCard title="Lượt lưu thực đơn gợi ý" value={fmtNum(nK?.suggestMenuSaves)} />
          </div>

          <div className="db-panels-2">
            <div className="db-panel">
              <div className="db-panel-head">
                <h4>Kcal được ghi theo thời gian</h4>
                <span className="db-muted">({granularityLabel})</span>
              </div>
              <ModernChart data={nSeriesKcal} color="#E76F51" />
            </div>

            <ModernRankingList
              title={`Món ăn được ghi nhận nhiều nhất (${top} mục)`}
              items={topFoods}
              color="#E76F51"
            />
          </div>
        </div>

        <div className="db-section">
          <div className="db-section-head">
            <h3>
              <i className="fa-solid fa-dumbbell" /> Luyện tập
            </h3>
            <div className="db-section-meta">
              {workoutsStats?.query?.from && workoutsStats?.query?.to ? (
                <span>
                  Khoảng: <strong>{workoutsStats.query.from}</strong> →{" "}
                  <strong>{workoutsStats.query.to}</strong>
                </span>
              ) : (
                <span className="db-muted">—</span>
              )}
            </div>
          </div>

          <div className="db-kpi-grid">
            <KpiCard title="Lịch tập tạo mới" value={fmtNum(wK?.totalPlans)} />
            <KpiCard title="Người dùng có lịch tập" value={fmtNum(wK?.usersWithPlans)} />
            <KpiCard title="TB lịch tập / người dùng" value={fmtNum(wK?.avgPlansPerUser)} />
            <KpiCard title="Lượt lưu lịch tập" value={fmtNum(wK?.savedPlans)} tone="good" />
            <KpiCard title="Tổng bài tập (trong lịch)" value={fmtNum(wK?.totalExercises)} />
            <KpiCard title="Tổng hiệp" value={fmtNum(wK?.totalSets)} />
            <KpiCard title="Tổng lần lặp" value={fmtNum(wK?.totalReps)} />
            <KpiCard title="TB kcal / lịch tập" value={fmtNum(wK?.avgKcalPerPlan)} />
          </div>

          <div className="db-panels-2">
            <div className="db-panel">
              <div className="db-panel-head">
                <h4>Lịch tập tạo mới theo thời gian</h4>
                <span className="db-muted">({granularityLabel})</span>
              </div>
              <ModernChart data={wSeriesPlans} color="#264653" />
            </div>

            <div className="db-panel">
              <div className="db-panel-head">
                <h4>Kcal tiêu hao (ước tính)</h4>
                <span className="db-muted">({granularityLabel})</span>
              </div>
              <ModernChart data={wSeriesKcal} color="#264653" />
            </div>
          </div>

          <div className="db-panels-1">
            <ModernRankingList
              title={`Bài tập được dùng nhiều nhất (${top} mục)`}
              items={topExercises}
              color="#264653"
            />
          </div>
        </div>

        <div className="db-section">
          <div className="db-section-head">
            <h3>
              <i className="fa-solid fa-people-arrows" /> Kết nối &amp; Tin nhắn
            </h3>
            <div className="db-section-meta">
              {connectStats?.query?.from && connectStats?.query?.to ? (
                <span>
                  Khoảng: <strong>{connectStats.query.from}</strong> →{" "}
                  <strong>{connectStats.query.to}</strong>
                </span>
              ) : (
                <span className="db-muted">—</span>
              )}
            </div>
          </div>

          <div className="db-kpi-grid">
            <KpiCard title="Phòng tạo mới" value={fmtNum(cK?.rooms?.total)} />
            <KpiCard title="Yêu cầu" value={fmtNum(cK?.requests?.total)} />
            <KpiCard title="Báo cáo" value={fmtNum(cK?.reports?.total)} tone="warn" />
            <KpiCard title="Tin nhắn" value={fmtNum(cK?.chat?.totalMessages)} />
            <KpiCard
              title="Phòng mở / đủ / đóng"
              value={`${fmtNum(cK?.rooms?.active)} / ${fmtNum(cK?.rooms?.full)} / ${fmtNum(
                cK?.rooms?.closed
              )}`}
            />
            <KpiCard
              title="Tỉ lệ chấp nhận"
              value={fmtPct(cK?.requests?.acceptanceRate)}
              tone="good"
            />
            <KpiCard
              title="Thời gian xử lý TB (giờ)"
              value={fmtNum(cK?.requests?.avgResolveHours)}
            />
            <KpiCard
              title="Hội thoại hoạt động"
              value={fmtNum(cK?.chat?.activeConversations)}
            />
          </div>

          <div className="db-panels-2">
            <div className="db-panel">
              <div className="db-panel-head">
                <h4>Phòng tạo mới</h4>
                <span className="db-muted">({granularityLabel})</span>
              </div>
              <ModernChart data={cSeriesRooms} color="#E9C46A" />
            </div>

            <div className="db-panel">
              <div className="db-panel-head">
                <h4>Yêu cầu tạo mới</h4>
                <span className="db-muted">({granularityLabel})</span>
              </div>
              <ModernChart data={cSeriesReq} color="#E9C46A" />
            </div>
          </div>

          <div className="db-panels-2">
            <div className="db-panel">
              <div className="db-panel-head">
                <h4>Báo cáo tạo mới</h4>
                <span className="db-muted">({granularityLabel})</span>
              </div>
              <ModernChart data={cSeriesRep} color="#F4A261" />
            </div>

            <div className="db-panel">
              <div className="db-panel-head">
                <h4>Tin nhắn đã gửi</h4>
                <span className="db-muted">({granularityLabel})</span>
              </div>
              <ModernChart data={cSeriesMsg} color="#F4A261" />
            </div>
          </div>

          <div className="db-panels-2">
            <ModernRankingList
              title={`Nhóm có nhiều thành viên nhất (${top} mục)`}
              items={topGroups}
              color="#E9C46A"
            />
            <ModernRankingList
              title={`Lý do báo cáo phổ biến (${top} mục)`}
              items={topReportReasons}
              color="#F4A261"
            />
          </div>
        </div>

        <div className="db-foot">
          <span className="db-muted">
            * Bảng tổng quan dùng chung bộ lọc cho tất cả dữ liệu thống kê.
          </span>
        </div>
      </div>
    </div>
  );
}