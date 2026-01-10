import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { getStatsNutritionAdmin } from "../../../lib/api";

const nf = new Intl.NumberFormat("vi-VN");
const fmtInt = (n) =>
  Number.isFinite(Number(n)) ? nf.format(Math.round(Number(n))) : "—";
const fmtKcal = (n) => (Number.isFinite(Number(n)) ? `${fmtInt(n)} kcal` : "—");
const fmtG = (n) => (Number.isFinite(Number(n)) ? `${fmtInt(n)} g` : "—");

const FOOD_STATUS_LABEL = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

export default function Stats_Nutrition() {
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [{ from, to }, setRange] = useState(() => computeRangeLastDays(30));
  const [granularity, setGranularity] = useState("day");

  const [data, setData] = useState(null); // data object trả về từ BE (đã .data)
  const firstLoadRef = useRef(true);

  const clearFilters = () => {
    setQ("");
    setRange(computeRangeLastDays(30));
    setGranularity("day");
  };

  const fetchStats = async ({ silent = false } = {}) => {
    setLoading(true);
    try {
      const res = await getStatsNutritionAdmin({
        from,
        to,
        granularity,
        q: String(q || "").trim(),
        top: 8,
      });
      setData(res);
      if (!silent) toast.success("Đã tải thống kê dinh dưỡng");
    } catch (e) {
      console.error("[Stats_Nutrition.fetch]", e);
      if (!silent) toast.error("Không tải được thống kê dinh dưỡng");
    } finally {
      setLoading(false);
    }
  };

  // load lần đầu (silent)
  useEffect(() => {
    fetchStats({ silent: true }).finally(() => {
      firstLoadRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto reload khi đổi filter (debounce, silent)
  useEffect(() => {
    if (firstLoadRef.current) return;
    const t = setTimeout(() => fetchStats({ silent: true }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, granularity, q]);

  const onQuickRange = (days) => setRange(computeRangeLastDays(days));

  const k = data?.kpis || {};
  const kcalSeries = Array.isArray(data?.series?.kcalLogged)
    ? data.series.kcalLogged
    : [];
  const macroBars = Array.isArray(data?.macros?.bars) ? data.macros.bars : [];
  const foodStatusPie = Array.isArray(data?.distributions?.foodStatus)
    ? data.distributions.foodStatus
    : [];

  const topFoods = Array.isArray(data?.topFoods) ? data.topFoods : [];
  const topFoodsBar = useMemo(
    () =>
      topFoods.map((x, i) => ({
        t: String(x?.name || `#${i + 1}`),
        v: Number(x?.value || 0),
      })),
    [topFoods]
  );

  const kpis = useMemo(
    () => [
      {
        label: "Nhật ký dinh dưỡng",
        value: fmtInt(k.totalLogs),
        sub: "Tổng lượt ghi nhật ký trong khoảng thời gian",
        icon: "fa-solid fa-utensils",
      },
      {
        label: "Người dùng có nhật ký",
        value: fmtInt(k.usersWithLogs),
        sub: "Số người dùng duy nhất có phát sinh nhật ký",
        icon: "fa-solid fa-users",
      },
      {
        label: "Trung bình calo/ngày",
        value: fmtKcal(k.avgKcalPerUserDay),
        sub: "Trung bình theo người-ngày (chỉ tính ngày có nhật ký)",
        icon: "fa-solid fa-fire",
      },
      {
        label: "Trung bình protein/ngày",
        value: fmtG(k.avgProteinPerUserDay),
        sub: "Trung bình theo người-ngày (chỉ tính ngày có nhật ký)",
        icon: "fa-solid fa-dna",
      },
      {
        label: "Món ăn chờ duyệt",
        value: fmtInt(k.foodsPending),
        sub: "Số món ăn đang ở trạng thái chờ duyệt",
        icon: "fa-solid fa-hourglass-half",
      },
      {
        label: "Món ăn đã duyệt",
        value: fmtInt(k.foodsApproved),
        sub: `Bị từ chối: ${fmtInt(k.foodsRejected)}`,
        icon: "fa-solid fa-circle-check",
      },
      {
        label: "Lượt lưu thực đơn gợi ý",
        value: fmtInt(k.suggestMenuSaves),
        sub: "Tổng lượt lưu thực đơn gợi ý",
        icon: "fa-solid fa-bookmark",
      },
      {
        label: "Lượt quét AI",
        value: fmtInt(k.aiScans),
        sub: "Nếu hệ thống có theo dõi chỉ số này",
        icon: "fa-solid fa-wand-magic-sparkles",
      },
    ],
    [k]
  );

  return (
    <div className="st-page">
      <StatsBreadcrumb current="Thống kê dinh dưỡng" groupLabel="Thống kê" />

      <StatsCard
        title="Thống kê dinh dưỡng"
        subtitle="Nhật ký, calo/macros, món ăn, thực đơn gợi ý"
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
              onClick={() => fetchStats({ silent: false })}
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
            title="Calo được ghi theo thời gian"
            hint="Biểu đồ đường"
            type="line"
            data={kcalSeries}
          />
          <ChartCard
            title="Phân bổ macros (Carb/Protein/Fat)"
            hint="Biểu đồ cột"
            type="bar"
            data={macroBars}
          />
          <ChartCard
            title="Trạng thái món ăn (chờ duyệt/đã duyệt/từ chối)"
            hint="Biểu đồ tròn"
            type="pie"
            data={foodStatusPie}
            labelFormatter={(key) => FOOD_STATUS_LABEL?.[key] || String(key)}
          />
          <ChartCard
            title="Món ăn được ghi nhiều nhất"
            hint="Biểu đồ cột"
            type="bar"
            data={topFoodsBar}
          />
        </ChartGrid>

        <div className="st-block-title">
          <i className="fa-solid fa-list-ol" />{" "}
          <span>Món ăn được ghi nhận nhiều nhất</span>
        </div>

        <SimpleTopTable
          columns={[
            { key: "name", label: "Món ăn", w: "1.2fr" },
            { key: "value", label: "Số lượt", w: "0.6fr" },
            { key: "note", label: "Ghi chú", w: "1.2fr" },
          ]}
          rows={topFoods}
          emptyText="Chưa có dữ liệu món ăn nổi bật"
        />
      </StatsCard>
    </div>
  );
}
