import React, { useEffect, useMemo, useRef, useState } from "react";
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

import { getConnectStats } from "../../../lib/api";

/* ---------------- Helpers ---------------- */

const safeArr = (v) => (Array.isArray(v) ? v : []);
const num = (v, fallback = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};

const fmtInt = (n) => {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString("vi-VN");
};

const fmtPct = (v) => {
  const x = Number(v);
  if (!Number.isFinite(x)) return "—";
  return `${Math.round(x * 10) / 10}%`;
};

const clampInt = (n, min, max) => Math.max(min, Math.min(max, n | 0));

const toDateSafe = (s) => {
  const d = new Date(String(s || ""));
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizeRange = (from, to) => {
  const a = toDateSafe(from);
  const b = toDateSafe(to);
  if (!a || !b) return { from, to };
  if (a.getTime() <= b.getTime()) return { from, to };
  return { from: to, to: from };
};

const fmtDurationMinutes = (minutes) => {
  const m = clampInt(num(minutes, 0), 0, 10_000_000);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h <= 0) return `${mm} phút`;
  if (h < 24) return `${h} giờ ${mm} phút`;
  const d = Math.floor(h / 24);
  const hh = h % 24;
  return `${d} ngày ${hh} giờ`;
};

const csvEscape = (v) => {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const downloadTextFile = (filename, text, mime = "text/plain;charset=utf-8") => {
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    toast.error("Không thể xuất file trên trình duyệt này");
  }
};

// BE series đã là [{t,v}] rồi, nhưng vẫn normalize để an toàn
const toTVSeries = (input) =>
  safeArr(input)
    .map((d, i) => ({
      t: String(d?.t ?? d?._id ?? d?.date ?? d?.x ?? i),
      v: num(d?.v ?? d?.value ?? d?.count ?? d?.y ?? 0, 0),
    }))
    .filter((x) => Number.isFinite(x.v));

const toPieSeries = (input) =>
  safeArr(input)
    .map((d, i) => ({
      key: String(d?.key ?? d?._id ?? d?.name ?? d?.label ?? `#${i + 1}`),
      value: num(d?.value ?? d?.v ?? d?.count ?? 0, 0),
    }))
    .filter((x) => x.value > 0);

const ROOM_TYPE_LABEL = (k) => {
  const s = String(k || "").toLowerCase();
  if (s === "duo" || s === "one_to_one" || s === "1:1") return "Kết nối đôi (Duo)";
  if (s === "group" || s === "team") return "Kết nối nhóm (Team)";
  if (s === "dm") return "Nhắn tin riêng (DM)";
  return String(k || "—");
};

const STATUS_LABEL = (k) => {
  const s = String(k || "").toLowerCase();
  if (s === "pending") return "Đang chờ";
  if (s === "accepted" || s === "approve" || s === "approved") return "Đã chấp nhận";
  if (s === "rejected" || s === "reject") return "Đã từ chối";
  if (s === "cancelled" || s === "canceled" || s === "cancel") return "Đã huỷ";
  if (s === "expired") return "Hết hạn";
  return String(k || "—");
};

/* ---------------- Component ---------------- */

export default function Stats_Connections() {
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [{ from, to }, setRange] = useState(() => computeRangeLastDays(30));
  const [granularity, setGranularity] = useState("day");

  // API data
  const [kpi, setKpi] = useState(null);
  const [seriesRequests, setSeriesRequests] = useState([]);
  const [seriesMessages, setSeriesMessages] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [roomTypePie, setRoomTypePie] = useState([]);
  const [topRooms, setTopRooms] = useState([]);

  const [lastUpdated, setLastUpdated] = useState(null);

  const refreshSeq = useRef(0);
  const debounceRef = useRef(null);

  const clearFilters = () => {
    setQ("");
    setRange(computeRangeLastDays(30));
    setGranularity("day");
  };

  const refresh = async ({ silent = false } = {}) => {
    const seq = ++refreshSeq.current;
    setLoading(true);

    try {
      const r = normalizeRange(from, to);

      // BE dùng from/to + granularity + q + top
      const root = await getConnectStats({
        q,
        from: r.from,
        to: r.to,
        granularity,
        top: 8,
        // giữ thêm để tương thích nếu sau này bạn đổi param
        dateFrom: r.from,
        dateTo: r.to,
      });

      if (seq !== refreshSeq.current) return;

      const roomsK = root?.kpis?.rooms || {};
      const reqK = root?.kpis?.requests || {};
      const repK = root?.kpis?.reports || {};
      const chatK = root?.kpis?.chat || {};

      const totalRequests = num(reqK.total, 0);
      const accepted = num(reqK.accepted, 0);
      const rejected = num(reqK.rejected, 0);
      const cancelled = num(reqK.cancelled, 0);
      const pending = num(reqK.pending, 0);
      const expired = num(reqK.expired, 0);

      const acceptanceRatePct = Number.isFinite(Number(reqK.acceptanceRate))
        ? num(reqK.acceptanceRate, 0) // BE đã trả %
        : totalRequests > 0
        ? (accepted / totalRequests) * 100
        : 0;

      const avgResolveMinutes = num(reqK.avgResolveHours, 0) * 60;

      const roomsCreated = num(roomsK.total, 0);
      const roomsDuo = num(roomsK.duo, 0);
      const roomsTeam = num(roomsK.group, 0);
      const roomsDm = num(roomsK.dm, 0);

      const reports = num(repK.total, 0);

      // Chat: BE trả số conversation active qua chat aggregate
      const conversations = num(chatK.activeConversations, 0);
      const messages = num(chatK.totalMessages, 0);

      setKpi({
        totalRequests,
        acceptanceRate: acceptanceRatePct,
        rejectCancel: rejected + cancelled,
        roomsCreated,
        roomsDuo,
        roomsTeam,
        roomsDm,
        avgMinutes: avgResolveMinutes,
        conversations,
        messages,
        reports,
        accepted,
        rejected,
        cancelled,
        pending,
        expired,
      });

      // Series (đúng key BE)
      setSeriesRequests(toTVSeries(root?.series?.requestsCreated));
      setSeriesMessages(toTVSeries(root?.series?.messagesSent));

      // Status breakdown (từ distributions.requestStatus)
      const statusRaw = toPieSeries(root?.distributions?.requestStatus);
      const statusAsBar =
        statusRaw.length > 0
          ? statusRaw.map((x) => ({ t: STATUS_LABEL(x.key), v: x.value }))
          : [
              { t: "Đang chờ", v: pending },
              { t: "Đã chấp nhận", v: accepted },
              { t: "Đã từ chối", v: rejected },
              { t: "Đã huỷ", v: cancelled },
              { t: "Hết hạn", v: expired },
            ].filter((x) => x.v > 0);

      setStatusBreakdown(statusAsBar);

      // Room type pie (from distributions.roomType)
      const roomPie = toPieSeries(root?.distributions?.roomType);
      const fallbackRoomPie =
        roomPie.length > 0
          ? roomPie
          : [
              { key: "duo", value: roomsDuo },
              { key: "group", value: roomsTeam },
              { key: "dm", value: roomsDm },
            ].filter((x) => x.value > 0);

      setRoomTypePie(fallbackRoomPie);

      // Top rooms: BE trả top.groupsByMembers
      const top = safeArr(root?.top?.groupsByMembers);
      setTopRooms(
        top.map((r, idx) => ({
          _key: r?._key || r?.id || r?._id || idx,
          name: r?.name ?? `Nhóm #${idx + 1}`,
          value: r?.value ?? "—",
          note: r?.note ?? "",
        }))
      );

      setLastUpdated(new Date());

      if (!silent) toast.success("Đã làm mới thống kê kết nối");
    } catch (e) {
      if (!silent) toast.error("Không tải được thống kê kết nối");
    } finally {
      if (seq === refreshSeq.current) setLoading(false);
    }
  };

  useEffect(() => {
    refresh({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => refresh({ silent: true }), 400);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, from, to, granularity]);

  const onQuickRange = (days) => setRange(computeRangeLastDays(days));

  const kpis = useMemo(() => {
    const s = kpi || {};
    return [
      { label: "Yêu cầu kết nối", value: fmtInt(s.totalRequests), sub: "Tạo mới", icon: "fa-solid fa-link" },
      { label: "Tỷ lệ chấp nhận", value: fmtPct(s.acceptanceRate), sub: "Tỷ lệ đồng ý", icon: "fa-solid fa-circle-check" },
      { label: "Từ chối / Huỷ", value: fmtInt(s.rejectCancel), sub: "Tổng số từ chối + huỷ", icon: "fa-solid fa-circle-xmark" },
      { label: "Phòng/nhóm được tạo", value: fmtInt(s.roomsCreated), sub: "Duo / Team / DM", icon: "fa-solid fa-people-group" },
      { label: "Thời gian xử lý TB", value: s.avgMinutes ? fmtDurationMinutes(s.avgMinutes) : "—", sub: "Trung bình", icon: "fa-solid fa-stopwatch" },
      { label: "Cuộc trò chuyện đang hoạt động", value: fmtInt(s.conversations), sub: "Duo/Team chat", icon: "fa-solid fa-comments" },
      { label: "Tin nhắn đã gửi", value: fmtInt(s.messages), sub: "Tổng tin nhắn", icon: "fa-solid fa-comment-dots" },
      { label: "Báo cáo", value: fmtInt(s.reports), sub: "Tổng lượt báo cáo", icon: "fa-solid fa-triangle-exclamation" },
    ];
  }, [kpi]);

  const onExport = () => {
    const r = normalizeRange(from, to);

    const lines = [];
    lines.push(
      ["Từ ngày", r.from, "Đến ngày", r.to, "Chu kỳ", granularity, "Từ khóa", q]
        .map(csvEscape)
        .join(",")
    );
    lines.push("");

    lines.push(["Chỉ số", "Giá trị", "Ghi chú"].map(csvEscape).join(","));
    kpis.forEach((x) => lines.push([x.label, x.value, x.sub].map(csvEscape).join(",")));

    lines.push("");
    lines.push(["Phân bố trạng thái", "Giá trị"].map(csvEscape).join(","));
    (statusBreakdown || []).forEach((x) => lines.push([x.t, x.v].map(csvEscape).join(",")));

    lines.push("");
    lines.push(["Loại phòng", "Giá trị"].map(csvEscape).join(","));
    (roomTypePie || []).forEach((x) => lines.push([ROOM_TYPE_LABEL(x.key), x.value].map(csvEscape).join(",")));

    lines.push("");
    lines.push(["Top nhóm/phòng", "Chỉ số", "Ghi chú"].map(csvEscape).join(","));
    (topRooms || []).forEach((x) => lines.push([x.name, x.value, x.note].map(csvEscape).join(",")));

    lines.push("");
    lines.push(["Chuỗi thời gian: Yêu cầu kết nối"].map(csvEscape).join(","));
    lines.push(["t", "v"].map(csvEscape).join(","));
    (seriesRequests || []).forEach((x) => lines.push([x.t, x.v].map(csvEscape).join(",")));

    lines.push("");
    lines.push(["Chuỗi thời gian: Tin nhắn"].map(csvEscape).join(","));
    lines.push(["t", "v"].map(csvEscape).join(","));
    (seriesMessages || []).forEach((x) => lines.push([x.t, x.v].map(csvEscape).join(",")));

    const filename = `stats_connections_${r.from}_${r.to}.csv`;
    downloadTextFile(filename, lines.join("\n"), "text/csv;charset=utf-8");
    toast.success("Đã xuất CSV");
  };

  return (
    <div className="st-page">
      <StatsBreadcrumb current="Thống kê kết nối" groupLabel="Thống kê" />

      <StatsCard
        title="Thống kê kết nối"
        subtitle={
          lastUpdated
            ? `Yêu cầu kết nối, phòng/nhóm, chat, báo cáo • Cập nhật: ${lastUpdated.toLocaleString("vi-VN")}`
            : "Yêu cầu kết nối, phòng/nhóm, chat, báo cáo"
        }
        actions={
          <>
            <SButton variant="ghost" icon="fa-solid fa-eraser" onClick={clearFilters} disabled={loading}>
              Xoá bộ lọc
            </SButton>
            <SButton
              variant="ghost"
              icon="fa-solid fa-rotate-right"
              onClick={() => refresh({ silent: false })}
              disabled={loading}
            >
              Làm mới
            </SButton>
            <SButton variant="primary" icon="fa-solid fa-file-export" onClick={onExport} disabled={loading}>
              Xuất CSV
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
          <ChartCard title="Yêu cầu kết nối theo thời gian" hint="Biểu đồ đường" type="line" data={seriesRequests} />
          <ChartCard title="Phân bố trạng thái yêu cầu" hint="Biểu đồ cột" type="bar" data={statusBreakdown} />
          <ChartCard
            title="Tỷ trọng loại phòng (Duo/Team/DM)"
            hint="Biểu đồ tròn"
            type="pie"
            data={roomTypePie}
            labelFormatter={ROOM_TYPE_LABEL}
          />
          <ChartCard title="Tin nhắn theo thời gian" hint="Biểu đồ đường" type="line" data={seriesMessages} />
        </ChartGrid>

        <div className="st-block-title">
          <i className="fa-solid fa-fire" /> <span>Top nhóm theo số thành viên</span>
        </div>

        <SimpleTopTable
          columns={[
            { key: "name", label: "Nhóm/Phòng", w: "1.2fr" },
            { key: "value", label: "Chỉ số", w: "0.6fr" },
            { key: "note", label: "Ghi chú", w: "1.2fr" },
          ]}
          rows={topRooms}
          emptyText={loading ? "Đang tải..." : "Chưa có dữ liệu top nhóm/phòng"}
        />
      </StatsCard>
    </div>
  );
}
