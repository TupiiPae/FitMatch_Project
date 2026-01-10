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
  Strength: "Sức mạnh (Strength)",
  Cardio: "Cardio",
  Sport: "Thể thao (Sport)",
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
    return () => {
      mountedRef.current = false;
    };
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
        label: "Lịch tập (tạo mới)",
        value: k.totalPlans ?? "—",
        sub: "Số lịch tập được tạo trong kỳ",
        icon: "fa-solid fa-dumbbell",
      },
      {
        label: "Người dùng có lịch tập",
        value: k.usersWithPlans ?? "—",
        sub: "Số người dùng phát sinh lịch tập",
        icon: "fa-solid fa-users",
      },
      {
        label: "TB lịch tập/người dùng",
        value: k.avgPlansPerUser ?? "—",
        sub: "Trung bình theo kỳ",
        icon: "fa-solid fa-chart-line",
      },
      {
        label: "Tổng kcal ước tính",
        value: k.totalKcal ?? "—",
        sub: "Tổng kcal tiêu hao (ước tính)",
        icon: "fa-solid fa-fire",
      },
      {
        label: "Lượt lưu lịch tập",
        value: k.savedPlans ?? "—",
        sub: "Tổng lượt lưu",
        icon: "fa-solid fa-bookmark",
      },
      {
        label: "Bài tập sức mạnh",
        value: k.strengthCount ?? "—",
        sub: "Số bài trong các lịch tập",
        icon: "fa-solid fa-dumbbell",
      },
      {
        label: "Bài tập cardio",
        value: k.cardioCount ?? "—",
        sub: "Số bài trong các lịch tập",
        icon: "fa-solid fa-heart-pulse",
      },
      {
        label: "Bài tập thể thao",
        value: k.sportCount ?? "—",
        sub: "Số bài trong các lịch tập",
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
        title="Thống kê tập luyện"
        subtitle="Lịch tập, phân loại bài tập, mức độ hoạt động"
        actions={
          <>
            <SButton
              variant="ghost"
              icon="fa-solid fa-eraser"
              onClick={clearFilters}
              disabled={loading}
            >
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
              onClick={() => toast.info("TODO: Xuất dữ liệu")}
              disabled={loading}
            >
              Xuất dữ liệu
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
            <KpiCard
              key={x.label}
              label={x.label}
              value={x.value}
              sub={x.sub}
              icon={x.icon}
            />
          ))}
        </KpiGrid>

        <ChartGrid>
          <ChartCard
            title="Lịch tập theo thời gian"
            hint="Số lịch tập được tạo trong kỳ"
            type="line"
            data={series?.plansCreated || []}
          />
          <ChartCard
            title="Kcal tiêu hao theo thời gian"
            hint="Tổng kcal (ước tính) theo kỳ"
            type="bar"
            data={series?.kcalBurned || []}
          />
          <ChartCard
            title="Tỷ trọng loại bài tập"
            hint="Dựa theo loại bài tập trong lịch tập"
            type="pie"
            data={itemTypesPie}
            labelFormatter={(key) => TYPE_LABEL[key] || String(key)}
          />
          <ChartCard
            title="Top bài tập phổ biến"
            hint="Dựa theo số lần xuất hiện trong lịch tập"
            type="bar"
            data={topExercisesBar}
          />
        </ChartGrid>

        <div className="st-block-title">
          <i className="fa-solid fa-medal" /> <span>Top bài tập</span>
        </div>

        <SimpleTopTable
          columns={[
            { key: "name", label: "Bài tập", w: "1.2fr" },
            { key: "value", label: "Số lượt", w: "0.6fr" },
            { key: "note", label: "Ghi chú", w: "1.2fr" },
          ]}
          rows={topExercises}
          emptyText="Chưa có dữ liệu top bài tập"
        />
      </StatsCard>
    </div>
  );
}
