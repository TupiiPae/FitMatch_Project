// admin-app/src/pages/Dashboard/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import dayjs from "dayjs";
import { toast } from "react-toastify";
import {
  getStatsUsersAdmin,
  getStatsNutritionAdmin,
  getStatsWorkoutsAdmin,
  getConnectStats,
} from "../../lib/api";
import "./Dashboard.css";

/* =========================
 * Helpers
 * ========================= */
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

function MiniBars({ data = [], height = 54, emptyText = "Chưa có dữ liệu" }) {
  const arr = safeArr(data);
  const max = Math.max(1, ...arr.map((x) => Number(x?.v || 0)));
  if (!arr.length) return <div className="db-chart-empty">{emptyText}</div>;

  return (
    <div className="db-bars" style={{ height }}>
      {arr.map((x, idx) => {
        const v = Number(x?.v || 0);
        const h = Math.max(2, Math.round((v / max) * height));
        const label = String(x?.t || "");
        return (
          <div
            key={label || idx}
            className="db-bar-wrap"
            title={`${label}: ${fmtNum(v)}`}
          >
            <div className="db-bar" style={{ height: h }} />
          </div>
        );
      })}
    </div>
  );
}

function KpiCard({ title, value, sub, tone = "default" }) {
  return (
    <div className={`db-kpi db-kpi--${tone}`}>
      <div className="db-kpi-title">{title}</div>
      <div className="db-kpi-value">{value}</div>
      {sub ? (
        <div className="db-kpi-sub">{sub}</div>
      ) : (
        <div className="db-kpi-sub"> </div>
      )}
    </div>
  );
}

function SimpleTopTable({ title, items = [], emptyText = "Chưa có dữ liệu" }) {
  const arr = safeArr(items);
  return (
    <div className="db-panel">
      <div className="db-panel-head">
        <h4>{title}</h4>
      </div>

      {arr.length === 0 ? (
        <div className="db-panel-empty">{emptyText}</div>
      ) : (
        <div className="db-top-table">
          <div className="db-top-thead">
            <div className="cell name">Tên</div>
            <div className="cell value">Giá trị</div>
            <div className="cell note">Ghi chú</div>
          </div>
          {arr.map((x, i) => (
            <div key={`${x?.name || "row"}-${i}`} className="db-top-trow">
              <div className="cell name">{x?.name || "—"}</div>
              <div className="cell value">{x?.value ?? "—"}</div>
              <div className="cell note">{x?.note || "—"}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  /* =========================
   * Defaults
   * ========================= */
  const today = useMemo(() => dayjs().format("YYYY-MM-DD"), []);
  const defaultFrom = useMemo(
    () => dayjs().subtract(29, "day").format("YYYY-MM-DD"),
    []
  );

  /* =========================
   * Filters
   * ========================= */
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(today);
  const [granularity, setGranularity] = useState("day"); // day|week|month
  const [q, setQ] = useState("");
  const [top, setTop] = useState(8);

  const granularityLabel = useMemo(() => {
    if (granularity === "day") return "Ngày";
    if (granularity === "week") return "Tuần";
    if (granularity === "month") return "Tháng";
    return "—";
  }, [granularity]);

  /* =========================
   * Data
   * ========================= */
  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const [usersStats, setUsersStats] = useState(null);
  const [nutritionStats, setNutritionStats] = useState(null);
  const [workoutsStats, setWorkoutsStats] = useState(null);
  const [connectStats, setConnectStats] = useState(null);

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
      const [u, n, w, c] = await Promise.all([
        getStatsUsersAdmin(p),
        getStatsNutritionAdmin(p),
        getStatsWorkoutsAdmin(p),
        getConnectStats(p),
      ]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  /* =========================
   * Derived UI data
   * ========================= */
  const uK = usersStats?.kpis || {};
  const nK = nutritionStats?.kpis || {};
  const wK = workoutsStats?.kpis || {};
  const cK = connectStats?.kpis || {};

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
    note: x?.note || "—",
  }));

  const topFoods = safeArr(nutritionStats?.topFoods).map((x) => ({
    name: x?.name || "—",
    value: x?.value ?? "—",
    note: x?.note || "—",
  }));

  const topExercises = safeArr(workoutsStats?.topExercises).map((x) => ({
    name: x?.name || "—",
    value: x?.value ?? "—",
    note: x?.note || "—",
  }));

  const topGroups = safeArr(connectStats?.top?.groupsByMembers).map((x) => ({
    name: x?.name || "—",
    value: x?.value ?? "—",
    note: x?.note || "—",
  }));

  const topReportReasons = safeArr(connectStats?.top?.reportReasonsTop).map(
    (x) => ({
      name: x?.key || x?.name || "—",
      value: x?.value ?? "—",
      note: "Lý do báo cáo",
    })
  );

  return (
    <div className="al-page db-page">
      {/* breadcrumb (đồng bộ Audit_Log) */}
      <nav className="al-breadcrumb" aria-label="breadcrumb">
        <Link to="/dashboard">
          <i className="fa-solid fa-house" /> <span>Trang chủ</span>
        </Link>
        <span className="sep">/</span>
        <span className="grp">
          <i className="fa-solid fa-chart-line" />{" "}
          <span>Thống kê</span>
        </span>
        <span className="sep">/</span>
        <span className="cur">
          <i className="fa-solid fa-gauge-high" />{" "}
          <span>Tổng quan</span>
        </span>
      </nav>

      <div className="al-card db-card">
        {/* Header (đồng bộ Audit_Log) */}
        <div className="al-head db-head">
          <div className="db-head-left">
            <h2>
              Bảng tổng quan{" "}
              {loading ? <span className="db-muted">(Đang tải...)</span> : null}
            </h2>

            <div className="db-subline">
              {lastUpdatedAt ? (
                <>
                  Cập nhật lúc{" "}
                  <strong>
                    {new Date(lastUpdatedAt).toLocaleString("vi-VN")}
                  </strong>
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

        {/* Filters (đồng bộ Audit_Log) */}
        <div className="al-filters db-filters">
          <div className="al-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm nhanh (tuỳ API): tên người dùng, món ăn, lịch tập, phòng nhóm..."
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

        {/* ========================= USERS ========================= */}
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
              title="Người dùng bị khoá (theo bộ lọc)"
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
              title="Người dùng hoạt động trong ngày"
              value={fmtNum(uK?.active?.dau)}
              sub="Trong 1 ngày gần nhất"
            />
            <KpiCard
              title="Hoạt động 7 ngày / 30 ngày"
              value={`${fmtNum(uK?.active?.wau)} / ${fmtNum(uK?.active?.mau)}`}
              sub="Trong 7 ngày & 30 ngày"
            />
          </div>

          <div className="db-panels-2">
            <div className="db-panel">
              <div className="db-panel-head">
                <h4>Người dùng mới theo thời gian</h4>
                <span className="db-muted">({granularityLabel})</span>
              </div>
              <MiniBars data={uSeriesNew} />
            </div>

            <div className="db-panel">
              <div className="db-panel-head">
                <h4>Người dùng hoạt động theo thời gian</h4>
                <span className="db-muted">({granularityLabel})</span>
              </div>
              <MiniBars data={uSeriesActive} />
            </div>
          </div>

          <div className="db-panels-1">
            <SimpleTopTable
              title="Phân khúc nổi bật (theo bộ lọc)"
              items={topSegments}
            />
          </div>
        </div>

        {/* ========================= NUTRITION ========================= */}
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
              <MiniBars data={nSeriesKcal} />
            </div>

            <SimpleTopTable
              title={`Món ăn được ghi nhận nhiều nhất (${top} mục)`}
              items={topFoods}
            />
          </div>
        </div>

        {/* ========================= WORKOUTS ========================= */}
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

            <KpiCard title="Tổng bài tập (trong lịch tập)" value={fmtNum(wK?.totalExercises)} />
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
              <MiniBars data={wSeriesPlans} />
            </div>

            <div className="db-panel">
              <div className="db-panel-head">
                <h4>Kcal tiêu hao (ước tính) theo thời gian</h4>
                <span className="db-muted">({granularityLabel})</span>
              </div>
              <MiniBars data={wSeriesKcal} />
            </div>
          </div>

          <div className="db-panels-1">
            <SimpleTopTable
              title={`Bài tập được dùng nhiều nhất (${top} mục)`}
              items={topExercises}
            />
          </div>
        </div>

        {/* ========================= CONNECT ========================= */}
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
              title="Phòng đang mở / đủ / đóng"
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
              title="Hội thoại đang hoạt động"
              value={fmtNum(cK?.chat?.activeConversations)}
            />
          </div>

          <div className="db-panels-2">
            <div className="db-panel">
              <div className="db-panel-head">
                <h4>Phòng tạo mới</h4>
                <span className="db-muted">({granularityLabel})</span>
              </div>
              <MiniBars data={cSeriesRooms} />
            </div>

            <div className="db-panel">
              <div className="db-panel-head">
                <h4>Yêu cầu tạo mới</h4>
                <span className="db-muted">({granularityLabel})</span>
              </div>
              <MiniBars data={cSeriesReq} />
            </div>
          </div>

          <div className="db-panels-2">
            <div className="db-panel">
              <div className="db-panel-head">
                <h4>Báo cáo tạo mới</h4>
                <span className="db-muted">({granularityLabel})</span>
              </div>
              <MiniBars data={cSeriesRep} />
            </div>

            <div className="db-panel">
              <div className="db-panel-head">
                <h4>Tin nhắn đã gửi</h4>
                <span className="db-muted">({granularityLabel})</span>
              </div>
              <MiniBars data={cSeriesMsg} />
            </div>
          </div>

          <div className="db-panels-2">
            <SimpleTopTable
              title={`Nhóm có nhiều thành viên nhất (${top} mục)`}
              items={topGroups}
            />
            <SimpleTopTable
              title={`Lý do báo cáo phổ biến (${top} mục)`}
              items={topReportReasons}
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
