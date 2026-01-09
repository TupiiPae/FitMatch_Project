import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import "../_shared/StatsBase.css";
import "./Stats_Workouts.css";
import {
  ChartCard,
  ChartGrid,
  computeRangeLastDays,
  KpiCard,
  KpiGrid,
  SButton,
  SimpleTopTable,
  StatsBreadcrumb,
  StatsCard,
  StatsFilterBar,
} from "../_shared/StatsShared";

export default function Stats_Workouts() {
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [{ from, to }, setRange] = useState(() => computeRangeLastDays(30));
  const [granularity, setGranularity] = useState("day");

  const clearFilters = () => {
    setQ("");
    setRange(computeRangeLastDays(30));
    setGranularity("day");
  };

  const refresh = async () => {
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
      toast.success("Làm mới thống kê tập luyện");
    } catch {
      toast.error("Không tải được thống kê tập luyện");
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
      { label: "Workout logs", value: "—", sub: "Số buổi tập", icon: "fa-solid fa-dumbbell" },
      { label: "Users tập luyện", value: "—", sub: "Unique users", icon: "fa-solid fa-users" },
      { label: "Avg workouts/user", value: "—", sub: "Theo kỳ", icon: "fa-solid fa-chart-line" },
      { label: "Total minutes", value: "—", sub: "Nếu có duration", icon: "fa-solid fa-stopwatch" },
      { label: "Strength", value: "—", sub: "Số buổi", icon: "fa-solid fa-dumbbell" },
      { label: "Cardio", value: "—", sub: "Số buổi", icon: "fa-solid fa-heart-pulse" },
      { label: "Sport", value: "—", sub: "Số buổi", icon: "fa-solid fa-person-running" },
      { label: "Plan completion", value: "—", sub: "Nếu tracking", icon: "fa-solid fa-clipboard-check" },
    ],
    []
  );

  const topExercises = useMemo(
    () => [
      { name: "Bench press", value: "—", note: "phổ biến" },
      { name: "Squat", value: "—", note: "phổ biến" },
      { name: "Running", value: "—", note: "phổ biến" },
    ],
    []
  );

  return (
    <div className="st-page">
      <StatsBreadcrumb current="Thống kê tập luyện" groupLabel="Thống kê" />

      <StatsCard
        title="Thống kê về tập luyện"
        subtitle="Workouts, loại bài tập, mức độ hoạt động"
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
        />

        <KpiGrid>
          {kpis.map((k) => (
            <KpiCard key={k.label} label={k.label} value={k.value} sub={k.sub} icon={k.icon} />
          ))}
        </KpiGrid>

        <ChartGrid>
          <ChartCard title="Workout logs theo thời gian" hint="Line chart" type="line" />
          <ChartCard title="Phân loại buổi tập (Strength/Cardio/Sport)" hint="Bar chart" type="bar" />
          <ChartCard title="Tỷ trọng loại buổi tập" hint="Pie chart" type="pie" />
          <ChartCard title="Top exercises phổ biến" hint="Bar chart" type="bar" />
        </ChartGrid>

        <div className="st-block-title">
          <i className="fa-solid fa-medal" /> <span>Top exercises</span>
        </div>

        <SimpleTopTable
          columns={[
            { key: "name", label: "Bài tập", w: "1.2fr" },
            { key: "value", label: "Số lượt", w: "0.6fr" },
            { key: "note", label: "Ghi chú", w: "1.2fr" },
          ]}
          rows={topExercises}
          emptyText="Chưa có dữ liệu top exercises"
        />
      </StatsCard>
    </div>
  );
}
