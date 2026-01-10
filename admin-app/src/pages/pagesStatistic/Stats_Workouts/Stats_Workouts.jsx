import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { getStatsWorkoutsAdmin } from "../../../lib/api"; // <- sửa path nếu bạn đặt khác

const TYPE_LABEL = {
  Strength: "Strength (Sức mạnh)",
  Cardio: "Cardio",
  Sport: "Sport",
  unknown: "Khác",
};

export default function Stats_Workouts() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const [q, setQ] = useState("");
  const [{ from, to }, setRange] = useState(() => computeRangeLastDays(30));
  const [granularity, setGranularity] = useState("day");

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const clearFilters = () => {
    setQ("");
    setRange(computeRangeLastDays(30));
    setGranularity("day");
  };

  const fetchStats = async ({ showToast = false } = {}) => {
    setLoading(true);
    try {
      const payload = await getStatsWorkoutsAdmin({
        from,
        to,
        granularity,
        q: q?.trim() || "",
        top: 8,
      });

      if (!mountedRef.current) return;
      setData(payload);

      if (showToast) toast.success("Đã tải thống kê tập luyện");
    } catch (e) {
      if (showToast) toast.error("Không tải được thống kê tập luyện");
      // fallback silent
      if (!showToast) console.error("[Stats_Workouts] fetch failed", e);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // Auto reload khi đổi filter (debounce nhẹ cho q)
  useEffect(() => {
    const t = setTimeout(() => fetchStats({ showToast: false }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, granularity, q]);

  // initial load
  useEffect(() => {
    fetchStats({ showToast: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onQuickRange = (days) => setRange(computeRangeLastDays(days));

  const k = data?.kpis || {};
  const dist = data?.distributions || {};
  const series = data?.series || {};

  const kpis = useMemo(() => {
    return [
      {
        label: "Workout plans",
        value: k.totalPlans ?? "—",
        sub: "Số lịch tập tạo trong kỳ",
        icon: "fa-solid fa-dumbbell",
      },
      {
        label: "Users tập luyện",
        value: k.usersWithPlans ?? "—",
        sub: "Unique users",
        icon: "fa-solid fa-users",
      },
      {
        label: "Avg plans/user",
        value: k.avgPlansPerUser ?? "—",
        sub: "Theo kỳ",
        icon: "fa-solid fa-chart-line",
      },
      {
        label: "Total kcal",
        value: k.totalKcal ?? "—",
        sub: "Tổng kcal (ước tính)",
        icon: "fa-solid fa-fire",
      },
      {
        label: "Saved plans",
        value: k.savedPlans ?? "—",
        sub: "Tổng lượt lưu",
        icon: "fa-solid fa-bookmark",
      },
      {
        label: "Strength",
        value: k.strengthCount ?? "—",
        sub: "Số bài trong plans",
        icon: "fa-solid fa-dumbbell",
      },
      {
        label: "Cardio",
        value: k.cardioCount ?? "—",
        sub: "Số bài trong plans",
        icon: "fa-solid fa-heart-pulse",
      },
      {
        label: "Sport",
        value: k.sportCount ?? "—",
        sub: "Số bài trong plans",
        icon: "fa-solid fa-person-running",
      },
    ];
  }, [k]);

  const topExercises = useMemo(() => {
    const rows = Array.isArray(data?.topExercises) ? data.topExercises : [];
    return rows.map((x, idx) => ({
      _key: `${x?.name || "row"}-${idx}`,
      name: x?.name || "(Không tên)",
      value: x?.value ?? 0,
      note: x?.note || "",
    }));
  }, [data]);

  const topExercisesBar = useMemo(() => {
    return topExercises.map((r) => ({ t: r.name, v: Number(r.value || 0) }));
  }, [topExercises]);

  const itemTypesPie = useMemo(() => {
    // BE trả [{key,value}]
    return Array.isArray(dist?.itemTypes) ? dist.itemTypes : [];
  }, [dist]);

  return (
    <div className="st-page">
      <StatsBreadcrumb current="Thống kê tập luyện" groupLabel="Thống kê" />

      <StatsCard
        title="Thống kê về tập luyện"
        subtitle="Workout plans, phân loại bài tập, mức độ hoạt động"
        actions={
          <>
            <SButton variant="ghost" icon="fa-solid fa-eraser" onClick={clearFilters} disabled={loading}>
              Xoá bộ lọc
            </SButton>
            <SButton
              variant="ghost"
              icon="fa-solid fa-rotate-right"
              onClick={() => fetchStats({ showToast: true })}
              disabled={loading}
            >
              Làm mới
            </SButton>
            <SButton
              variant="primary"
              icon="fa-solid fa-file-export"
              onClick={() => toast.info("TODO: Export")}
              disabled={loading}
            >
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
          {kpis.map((x) => (
            <KpiCard key={x.label} label={x.label} value={x.value} sub={x.sub} icon={x.icon} />
          ))}
        </KpiGrid>

        <ChartGrid>
          <ChartCard
            title="Workout plans theo thời gian"
            hint="Số plan được tạo trong kỳ"
            type="line"
            data={series?.plansCreated || []}
          />
          <ChartCard
            title="Kcal đốt theo thời gian"
            hint="Tổng kcal (ước tính) theo kỳ"
            type="bar"
            data={series?.kcalBurned || []}
          />
          <ChartCard
            title="Tỷ trọng loại bài tập"
            hint="Dựa theo items.type trong plans"
            type="pie"
            data={itemTypesPie}
            labelFormatter={(key) => TYPE_LABEL[key] || key}
          />
          <ChartCard
            title="Top exercises phổ biến"
            hint="Dựa theo số lần xuất hiện trong plans"
            type="bar"
            data={topExercisesBar}
          />
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
