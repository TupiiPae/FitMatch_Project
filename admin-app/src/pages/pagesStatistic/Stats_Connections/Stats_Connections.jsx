import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import "../_shared/StatsBase.css";
import "./Stats_Connections.css";
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

export default function Stats_Connections() {
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
      toast.success("Làm mới thống kê kết nối");
    } catch {
      toast.error("Không tải được thống kê kết nối");
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
      { label: "Match requests", value: "—", sub: "Tạo mới", icon: "fa-solid fa-link" },
      { label: "Acceptance rate", value: "—", sub: "Tỷ lệ đồng ý", icon: "fa-solid fa-circle-check" },
      { label: "Reject/Cancel", value: "—", sub: "Từ chối/Huỷ", icon: "fa-solid fa-circle-xmark" },
      { label: "Rooms created", value: "—", sub: "Duo/Team", icon: "fa-solid fa-people-group" },
      { label: "Avg time-to-accept", value: "—", sub: "Nếu tracking", icon: "fa-solid fa-stopwatch" },
      { label: "Conversations", value: "—", sub: "Số cuộc chat", icon: "fa-solid fa-comments" },
      { label: "Messages sent", value: "—", sub: "Nếu tracking", icon: "fa-solid fa-comment-dots" },
      { label: "Reports", value: "—", sub: "Báo cáo người dùng", icon: "fa-solid fa-triangle-exclamation" },
    ],
    []
  );

  const topRooms = useMemo(
    () => [
      { name: "Room #xxxxx", value: "—", note: "Hoạt động nhiều" },
      { name: "Room #yyyyy", value: "—", note: "Tin nhắn cao" },
      { name: "Room #zzzzz", value: "—", note: "Chưa hoạt động" },
    ],
    []
  );

  return (
    <div className="st-page">
      <StatsBreadcrumb current="Thống kê kết nối" groupLabel="Thống kê" />

      <StatsCard
        title="Thống kê về kết nối"
        subtitle="Match requests, rooms, chat, tỷ lệ chấp nhận"
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
          <ChartCard title="Match requests theo thời gian" hint="Line chart" type="line" />
          <ChartCard title="Breakdown trạng thái (pending/accepted/rejected/cancel)" hint="Bar chart" type="bar" />
          <ChartCard title="Tỷ trọng room type (duo/team)" hint="Pie chart" type="pie" />
          <ChartCard title="Messages/day (nếu tracking)" hint="Line chart" type="line" />
        </ChartGrid>

        <div className="st-block-title">
          <i className="fa-solid fa-fire" /> <span>Top rooms hoạt động</span>
        </div>

        <SimpleTopTable
          columns={[
            { key: "name", label: "Room", w: "1.2fr" },
            { key: "value", label: "Chỉ số", w: "0.6fr" },
            { key: "note", label: "Ghi chú", w: "1.2fr" },
          ]}
          rows={topRooms}
          emptyText="Chưa có dữ liệu top rooms"
        />
      </StatsCard>
    </div>
  );
}
