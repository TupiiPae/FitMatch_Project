import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import "../_shared/StatsBase.css";
import "./Stats_Users.css";
import {
  ChartCard,
  ChartGrid,
  computeRangeLastDays,
  KpiCard,
  KpiGrid,
  MultiSelectDropdown,
  SButton,
  SimpleTopTable,
  StatsBreadcrumb,
  StatsCard,
  StatsFilterBar,
} from "../_shared/StatsShared";
import { getStatsUsersAdmin } from "../../../lib/api";

const GOAL_OPTIONS = ["giam_can", "duy_tri", "tang_can", "giam_mo", "tang_co"];
const SEX_OPTIONS = ["male", "female"];

const GOAL_LABEL = {
  giam_can: "giảm cân",
  duy_tri: "duy trì",
  tang_can: "tăng cân",
  giam_mo: "giảm mỡ",
  tang_co: "tăng cơ",
};

const SEX_LABEL = { male: "nam", female: "nữ" };

const fmtNum = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("vi-VN");
};

export default function Stats_Users() {
  const [loading, setLoading] = useState(false);

  // filters
  const [q, setQ] = useState("");
  const [{ from, to }, setRange] = useState(() => computeRangeLastDays(30));
  const [granularity, setGranularity] = useState("day");
  const [filterGoals, setFilterGoals] = useState([]);
  const [filterSex, setFilterSex] = useState([]);

  // data
  const [data, setData] = useState(null);

  const clearFilters = () => {
    setQ("");
    setRange(computeRangeLastDays(30));
    setGranularity("day");
    setFilterGoals([]);
    setFilterSex([]);
  };

  const buildParams = () => ({
    q: q || undefined,
    from,
    to,
    granularity,
    goals: filterGoals.length ? filterGoals.join(",") : undefined,
    sex: filterSex.length ? filterSex.join(",") : undefined,
  });

  const refresh = async (silent = false) => {
    setLoading(true);
    try {
      const payload = await getStatsUsersAdmin(buildParams());
      setData(payload);
      if (!silent) toast.success("Đã tải thống kê người dùng");
    } catch (e) {
      console.error(e);
      toast.error("Không tải được thống kê người dùng");
    } finally {
      setLoading(false);
    }
  };

  // load lần đầu
  useEffect(() => {
    refresh(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // debounce khi gõ search + đổi filter
  const debounceRef = useRef(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      refresh(true);
    }, 350);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, from, to, granularity, filterGoals, filterSex]);

  const onQuickRange = (days) => setRange(computeRangeLastDays(days));

  // ===== MAPPING KPIs từ BE =====
  const kpis = useMemo(() => {
    const k = data?.kpis;
    const dist = data?.distributions;

    const topAge =
      (dist?.ageAll || []).find((x) => x.key && x.key !== "unknown")?.key || "—";
    const topCity = (dist?.cityAll || [])[0]?.key || "—";

    const active = k?.active || {};
    const activeLabel =
      active?.dau != null || active?.wau != null || active?.mau != null
        ? `DAU ${fmtNum(active.dau)} / WAU ${fmtNum(active.wau)} / MAU ${fmtNum(active.mau)}`
        : "—";

    return [
      { label: "Users mới", value: fmtNum(k?.newUsersInRange), sub: "Theo khoảng thời gian", icon: "fa-solid fa-user-plus" },
      { label: "Tổng Users", value: fmtNum(k?.totalAll), sub: "Toàn hệ thống", icon: "fa-solid fa-users" },
      { label: "Onboarding hoàn tất", value: `${fmtNum(k?.onboardedFiltered)} (${k?.onboardedRate ?? 0}%)`, sub: "Theo bộ lọc", icon: "fa-solid fa-clipboard-check" },
      { label: "Active users", value: activeLabel, sub: k?.active?.basis || "—", icon: "fa-solid fa-bolt" },
      { label: "Blocked", value: fmtNum(k?.blockedFiltered), sub: "Theo bộ lọc", icon: "fa-solid fa-user-slash" },
      { label: "Profile đầy đủ", value: `${fmtNum(k?.profileCompleteFiltered)} (${k?.profileCompleteRate ?? 0}%)`, sub: "Completeness", icon: "fa-solid fa-id-card" },
      { label: "Độ tuổi phổ biến", value: topAge, sub: "Age segment", icon: "fa-solid fa-chart-simple" },
      { label: "Khu vực top", value: topCity, sub: "Location", icon: "fa-solid fa-location-dot" },
    ];
  }, [data]);

  // ===== Top segments table =====
  const topSegments = useMemo(() => {
    // BE đã trả topSegments dạng {name,value,note}
    const rows = data?.topSegments;
    if (Array.isArray(rows) && rows.length) {
      return rows.map((r) => ({
        name: r.name,
        value: r.value == null ? "—" : String(r.value),
        note: r.note || "",
      }));
    }
    return [
      { name: "Goal: —", value: "—", note: "Phân khúc phổ biến" },
      { name: "Sex: —", value: "—", note: "Tỷ lệ theo giới tính" },
      { name: "Age: —", value: "—", note: "Nhóm tuổi nổi bật" },
    ];
  }, [data]);

  // (Tuỳ bạn nối chart lib sau)
  // series/pie data đã có:
  // data?.series.newUsers, data?.series.activeUsers
  // data?.distributions.goalNew, data?.distributions.sexNew

  return (
    <div className="st-page">
      <StatsBreadcrumb current="Thống kê người dùng" groupLabel="Thống kê" />

      <StatsCard
        title="Thống kê về người dùng"
        subtitle="Tăng trưởng, phân khúc, mức độ hoạt động (engagement)"
        actions={
          <>
            <SButton variant="ghost" icon="fa-solid fa-eraser" onClick={clearFilters}>
              Xoá bộ lọc
            </SButton>
            <SButton variant="ghost" icon="fa-solid fa-rotate-right" onClick={() => refresh()} disabled={loading}>
              Làm mới
            </SButton>
            <SButton variant="primary" icon="fa-solid fa-file-export" onClick={() => toast.info("TODO: Export")}>
              Export
            </SButton>
          </>
        }
      >
        <StatsFilterBar
          q={q}
          setQ={setQ}
          dateFrom={from}
          setDateFrom={(v) => setRange((p) => ({ ...p, from: v }))}
          dateTo={to}
          setDateTo={(v) => setRange((p) => ({ ...p, to: v }))}
          granularity={granularity}
          setGranularity={setGranularity}
          onQuickRange={onQuickRange}
        >
          <div className="st-filter-group">
            <span className="st-filter-label">Mục tiêu</span>
            <MultiSelectDropdown
              label="Goal"
              placeholder="Tất cả mục tiêu"
              options={GOAL_OPTIONS}
              values={filterGoals}
              onChange={setFilterGoals}
              renderOptionLabel={(v) => GOAL_LABEL[v] || v}
            />
          </div>

          <div className="st-filter-group">
            <span className="st-filter-label">Giới tính</span>
            <MultiSelectDropdown
              label="Sex"
              placeholder="Tất cả"
              options={SEX_OPTIONS}
              values={filterSex}
              onChange={setFilterSex}
              renderOptionLabel={(v) => SEX_LABEL[v] || v}
            />
          </div>
        </StatsFilterBar>

        <KpiGrid>
          {kpis.map((k) => (
            <KpiCard key={k.label} label={k.label} value={k.value} sub={k.sub} icon={k.icon} />
          ))}
        </KpiGrid>

        <ChartGrid>
          <ChartCard
            title="Users mới theo thời gian"
            hint={`Points: ${data?.series?.newUsers?.length || 0}`}
            type="line"
            data={data?.series?.newUsers || []}          // [{t,v}]
          />
          <ChartCard
            title="Active users theo chu kỳ"
            hint={`Points: ${data?.series?.activeUsers?.length || 0}`}
            type="bar"
            data={data?.series?.activeUsers || []}       // [{t,v}]
          />
          <ChartCard
            title="Phân bố mục tiêu (Goal)"
            hint={`Segments: ${data?.distributions?.goalNew?.length || 0}`}
            type="pie"
            data={data?.distributions?.goalNew || []}    // [{key,value}]
            labelFormatter={(k) => GOAL_LABEL?.[k] ? `Goal: ${GOAL_LABEL[k]}` : `Goal: ${k}`}
          />
          <ChartCard
            title="Phân bố giới tính"
            hint={`Segments: ${data?.distributions?.sexNew?.length || 0}`}
            type="pie"
            data={data?.distributions?.sexNew || []}     // [{key,value}]
            labelFormatter={(k) => SEX_LABEL?.[k] ? `Sex: ${SEX_LABEL[k]}` : `Sex: ${k}`}
          />
        </ChartGrid>

        <div className="st-users-note">
          <i className="fa-solid fa-circle-info" />
          <span>
            Dữ liệu chart đã sẵn (series + distributions). Bạn chỉ cần nối vào chart library (Recharts/Chart.js) là hiển thị ngay.
          </span>
        </div>

        <SimpleTopTable
          columns={[
            { key: "name", label: "Phân khúc", w: "1.2fr" },
            { key: "value", label: "Giá trị", w: "0.6fr" },
            { key: "note", label: "Ghi chú", w: "1.2fr" },
          ]}
          rows={topSegments}
          emptyText="Chưa có dữ liệu phân khúc"
        />
      </StatsCard>
    </div>
  );
}
