import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { cancelPremium, getMyPremium } from "../../api/premium";
import { createPayosLinkForMonths } from "../../api/payos";
import "./Premium.css";

const PLANS = [
  { months: 1, title: "1 tháng", note: "Trải nghiệm Premium" },
  { months: 3, title: "3 tháng", note: "Tiết kiệm hơn" },
  { months: 6, title: "6 tháng", note: "Dùng ổn định" },
  { months: 12, title: "12 tháng", note: "Tối ưu nhất" },
];

const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("vi-VN");
};

export default function Premium() {
  const [loading, setLoading] = useState(true);
  const [premium, setPremium] = useState(null);
  const [busy, setBusy] = useState(false);

  const isPremium = !!premium?.isPremium;
  const tierLabel = isPremium ? "Premium" : "Miễn phí";

  const benefits = useMemo(() => {
    const b = premium?.benefits || {};
    return [
      { k: "AI Chat", v: b.aiDailyLimit ? `${b.aiDailyLimit}/ngày` : "—" },
      { k: "Giới hạn kết nối", v: b.connectLimit ? `${b.connectLimit} đối tượng` : "—" },
    ];
  }, [premium]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getMyPremium();
      setPremium(data?.premium || null);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Không tải được trạng thái Premium");
      setPremium(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSubscribe = async (months) => {
    if (busy) return;
    setBusy(true);
    try {
      const rs = await createPayosLinkForMonths(months);
      if (!rs?.ok || !rs?.checkoutUrl) {
        throw new Error(rs?.message || "Không tạo được link thanh toán");
      }

      toast.info("Đang chuyển đến cổng thanh toán…");
      window.location.assign(rs.checkoutUrl);
    } catch (e) {
      console.error(e);
      toast.error(e?.message || e?.response?.data?.message || "Không mở được thanh toán");
    } finally {
      setBusy(false);
    }
  };

  const onCancel = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const data = await cancelPremium();
      toast.success(data?.message || "Đã hủy gia hạn");
      setPremium(data?.premium || null);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Không hủy được");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fm-premium-page">
      <div className="fm-premium-wrap">
        <div className="fm-premium-hero">
          <div className="fm-premium-hero-left">
            <div className="fm-premium-badge">{tierLabel}</div>
            <h1 className="fm-premium-title">FitMatch Premium</h1>

            {loading ? (
              <p className="fm-premium-sub">Đang tải…</p>
            ) : (
              <p className="fm-premium-sub">
                Trạng thái: <b>{isPremium ? "Đang hoạt động" : "Chưa kích hoạt"}</b>
                <span className="fm-premium-dot">•</span>
                Hết hạn: <b>{fmtDate(premium?.expiresAt)}</b>
                {isPremium ? (
                  <>
                    <span className="fm-premium-dot">•</span>
                    Còn lại: <b>{premium?.daysLeft || 0} ngày</b>
                  </>
                ) : null}
              </p>
            )}
          </div>

          <div className="fm-premium-hero-right">
            <div className="fm-premium-card">
              <div className="fm-premium-card-title">Quyền lợi hiện tại</div>
              <div className="fm-premium-benefits">
                {benefits.map((x) => (
                  <div key={x.k} className="fm-premium-benefit">
                    <span className="k">{x.k}</span>
                    <span className="v">{x.v}</span>
                  </div>
                ))}
              </div>

              <div className="fm-premium-actions">
                <button className="fm-btn fm-btn-outline" onClick={load} disabled={loading || busy}>
                  Làm mới
                </button>

                <button
                  className="fm-btn fm-btn-danger"
                  onClick={onCancel}
                  disabled={loading || busy || !premium}
                  title="Hủy gia hạn (vẫn dùng tới hết hạn)"
                >
                  Hủy gia hạn
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="fm-premium-grid">
          {PLANS.map((p) => (
            <div key={p.months} className="fm-plan">
              <div className="fm-plan-top">
                <div className="fm-plan-title">{p.title}</div>
                <div className="fm-plan-note">{p.note}</div>
              </div>

              <div className="fm-plan-body">
                <div className="fm-plan-line">
                  <span>AI Chat</span>
                  <b>{premium?.benefits?.aiDailyLimit ? `${premium.benefits.aiDailyLimit}/ngày` : "—"}</b>
                </div>
                <div className="fm-plan-line">
                  <span>Giới hạn kết nối</span>
                  <b>{premium?.benefits?.connectLimit ? `${premium.benefits.connectLimit} đối tượng` : "—"}</b>
                </div>
              </div>

              <button
                className="fm-btn fm-btn-primary fm-plan-btn"
                onClick={() => onSubscribe(p.months)}
                disabled={loading || busy}
              >
                {busy ? "Đang mở thanh toán..." : isPremium ? "Gia hạn / Cộng dồn" : "Thanh toán Premium"}
              </button>
            </div>
          ))}
        </div>

        <div className="fm-premium-footnote">
          <div className="fm-premium-footnote-title">Ghi chú</div>
          <ul>
            <li>Nhấn gói bất kỳ để mở trang thanh toán PayOS.</li>
            <li>Sau khi thanh toán xong, trạng thái Premium sẽ cập nhật qua webhook; nếu chưa thấy, bấm <b>Làm mới</b>.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
