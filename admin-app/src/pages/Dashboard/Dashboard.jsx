import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { getStats } from "../../lib/api.js";

// dùng style/layout giống Audit_Log
import "../pagesStatistic/_shared/StatsBase.css";
import {
  StatsBreadcrumb,
  StatsCard,
  KpiGrid,
  KpiCard,
  SButton,
} from "../pagesStatistic/_shared/StatsShared";

export default function Dashboard() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [s, setS] = useState({
    users: 0,
    scansToday: 0,
    mergesToday: 0,
    nutritionLogUsers: 0,
  });

  const load = async () => {
    setLoading(true);
    try {
      const d = await getStats();
      setS(d || {});
    } catch (e) {
      console.error(e);
      toast.error("Không tải được dữ liệu tổng quan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="st-page">
      <StatsBreadcrumb current="Tổng quan" groupLabel="Thống kê" />

      <StatsCard
        title="Tổng quan hệ thống"
        subtitle="Tổng hợp nhanh các chỉ số quan trọng"
        actions={
          <>
            <SButton
              variant="ghost"
              icon="fa-solid fa-rotate-right"
              onClick={load}
              disabled={loading}
            >
              Làm mới
            </SButton>

            <SButton
              variant="ghost"
              icon="fa-solid fa-file-lines"
              onClick={() => nav("/statistics/audit-log")}
            >
              Audit Log
            </SButton>

            <SButton
              variant="primary"
              icon="fa-solid fa-users"
              onClick={() => nav("/users")}
            >
              Danh sách người dùng
            </SButton>
          </>
        }
      >
        <KpiGrid>
          <KpiCard
            label="Số lượng người dùng"
            value={s.users ?? "—"}
            sub="Tổng users"
            icon="fa-solid fa-users"
          />
          <KpiCard
            label="Thời gian hoạt động"
            value="—"
            sub="(sau này nối tracking/analytics)"
            icon="fa-solid fa-bolt"
          />
          <KpiCard
            label="Số lần quét AI"
            value={s.scansToday ?? "—"}
            sub="Hôm nay"
            icon="fa-solid fa-wand-magic-sparkles"
          />
          <KpiCard
            label="User log nhật ký dinh dưỡng"
            value={s.nutritionLogUsers ?? "—"}
            sub="Unique users"
            icon="fa-solid fa-utensils"
          />
          <KpiCard
            label="Số lần ghép cặp thành công"
            value={s.mergesToday ?? "—"}
            sub="Hôm nay"
            icon="fa-solid fa-link"
          />
        </KpiGrid>
      </StatsCard>
    </div>
  );
}
