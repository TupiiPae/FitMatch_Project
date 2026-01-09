import React, { useEffect, useMemo, useState } from "react";
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

const GOAL_OPTIONS = ["giam_can", "duy_tri", "tang_can", "giam_mo", "tang_co"];
const SEX_OPTIONS = ["male", "female"];

export default function Stats_Users() {
  const [loading, setLoading] = useState(false);

  // filters
  const [q, setQ] = useState("");
  const [{ from, to }, setRange] = useState(() => computeRangeLastDays(30));
  const [granularity, setGranularity] = useState("day");
  const [filterGoals, setFilterGoals] = useState([]);
  const [filterSex, setFilterSex] = useState([]);

  const clearFilters = () => {
    setQ("");
    setRange(computeRangeLastDays(30));
    setGranularity("day");
    setFilterGoals([]);
    setFilterSex([]);
  };

  const refresh = async () => {
    setLoading(true);
    try {
      // TODO: call API stats users
      await new Promise((r) => setTimeout(r, 300));
      toast.success("Làm mới dữ liệu người dùng");
    } catch {
      toast.error("Không tải được thống kê người dùng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onQuickRange = (days) => setRange(computeRangeLastDays(days));

  const kpis = useMemo(
    () => [
      { label: "Users mới", value: "—", sub: "Theo khoảng thời gian", icon: "fa-solid fa-user-plus" },
      { label: "Tổng Users", value: "—", sub: "Toàn hệ thống", icon: "fa-solid fa-users" },
      { label: "Onboarding hoàn tất", value: "—", sub: "Tỷ lệ hoàn tất", icon: "fa-solid fa-clipboard-check" },
      { label: "Active users", value: "—", sub: "DAU/WAU/MAU", icon: "fa-solid fa-bolt" },
      { label: "Blocked", value: "—", sub: "Tài khoản bị khoá", icon: "fa-solid fa-user-slash" },
      { label: "Profile đầy đủ", value: "—", sub: "Completeness", icon: "fa-solid fa-id-card" },
      { label: "Độ tuổi phổ biến", value: "—", sub: "Age segment", icon: "fa-solid fa-chart-simple" },
      { label: "Khu vực top", value: "—", sub: "Location", icon: "fa-solid fa-location-dot" },
    ],
    []
  );

  const topSegments = useMemo(
    () => [
      { name: "Goal: tăng cơ", value: "—", note: "Tăng nhanh nhất" },
      { name: "Sex: nữ", value: "—", note: "Hoạt động cao" },
      { name: "Age: 22-27", value: "—", note: "Tỷ lệ onboarding tốt" },
    ],
    []
  );

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
            <SButton variant="ghost" icon="fa-solid fa-rotate-right" onClick={refresh} disabled={loading}>
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
            />
          </div>
        </StatsFilterBar>

        <KpiGrid>
          {kpis.map((k) => (
            <KpiCard key={k.label} label={k.label} value={k.value} sub={k.sub} icon={k.icon} />
          ))}
        </KpiGrid>

        <ChartGrid>
          <ChartCard title="Users mới theo thời gian" hint="Line chart" type="line" />
          <ChartCard title="Active users theo chu kỳ" hint="Line/Bar chart" type="line" />
          <ChartCard title="Phân bố mục tiêu (Goal)" hint="Pie chart" type="pie" />
          <ChartCard title="Phân bố giới tính" hint="Pie chart" type="pie" />
        </ChartGrid>

        <div className="st-users-note">
          <i className="fa-solid fa-circle-info" />
          <span>
            Gợi ý: sau này có thể thêm Cohort retention (D7/D30) và Funnel onboarding.
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
