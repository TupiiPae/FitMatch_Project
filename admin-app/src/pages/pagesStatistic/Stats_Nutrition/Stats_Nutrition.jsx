import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import "../_shared/StatsBase.css";
import "./Stats_Nutrition.css";
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

export default function Stats_Nutrition() {
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
      toast.success("Làm mới thống kê dinh dưỡng");
    } catch {
      toast.error("Không tải được thống kê dinh dưỡng");
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
      { label: "Nutrition logs", value: "—", sub: "Số lượt ghi nhật ký", icon: "fa-solid fa-utensils" },
      { label: "Users có log", value: "—", sub: "Unique users", icon: "fa-solid fa-users" },
      { label: "Avg calories/day", value: "—", sub: "Trung bình", icon: "fa-solid fa-fire" },
      { label: "Avg protein/day", value: "—", sub: "Trung bình", icon: "fa-solid fa-dna" },
      { label: "Food pending", value: "—", sub: "Chờ duyệt", icon: "fa-solid fa-hourglass-half" },
      { label: "Food approved", value: "—", sub: "Đã duyệt", icon: "fa-solid fa-circle-check" },
      { label: "Suggest menu saved", value: "—", sub: "Lượt lưu", icon: "fa-solid fa-bookmark" },
      { label: "AI scans", value: "—", sub: "Nếu có tracking", icon: "fa-solid fa-wand-magic-sparkles" },
    ],
    []
  );

  const topFoods = useMemo(
    () => [
      { name: "Ức gà", value: "—", note: "log nhiều nhất" },
      { name: "Cơm trắng", value: "—", note: "log nhiều" },
      { name: "Trứng", value: "—", note: "log nhiều" },
    ],
    []
  );

  return (
    <div className="st-page">
      <StatsBreadcrumb current="Thống kê dinh dưỡng" groupLabel="Thống kê" />

      <StatsCard
        title="Thống kê về dinh dưỡng"
        subtitle="Logs, calories/macros, foods, thực đơn gợi ý"
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
          <ChartCard title="Calories logged theo thời gian" hint="Line chart" type="line" />
          <ChartCard title="Macro distribution (Carb/Protein/Fat)" hint="Bar chart" type="bar" />
          <ChartCard title="Food status (pending/approved/rejected)" hint="Pie chart" type="pie" />
          <ChartCard title="Top foods được log nhiều nhất" hint="Bar chart" type="bar" />
        </ChartGrid>

        <div className="st-block-title">
          <i className="fa-solid fa-list-ol" /> <span>Top foods</span>
        </div>

        <SimpleTopTable
          columns={[
            { key: "name", label: "Món ăn", w: "1.2fr" },
            { key: "value", label: "Số lượt", w: "0.6fr" },
            { key: "note", label: "Ghi chú", w: "1.2fr" },
          ]}
          rows={topFoods}
          emptyText="Chưa có dữ liệu top foods"
        />
      </StatsCard>
    </div>
  );
}
