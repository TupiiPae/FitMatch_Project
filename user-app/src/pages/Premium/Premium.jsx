import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useLocation, Link } from "react-router-dom";
import { cancelPremium, getMyPremium, listPremiumPlans } from "../../api/premium";
import { createPayosLinkForPlanCode } from "../../api/payos";
import PaymentReturn from "./PaymentReturn";
import PaymentCancel from "./PaymentCancel";
import "./Premium.css";

const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("vi-VN");
};

const fmtMoney = (v, currency = "VND") => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (String(currency).toUpperCase() === "VND") return `${n.toLocaleString("vi-VN")} ₫`;
  return `${n.toLocaleString("vi-VN")} ${currency}`;
};

export default function Premium() {
  const [loading, setLoading] = useState(true);
  const [premium, setPremium] = useState(null);
  const [plans, setPlans] = useState([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("upgrade");

  const { pathname } = useLocation();
  const isPayReturn = /\/payment\/return\/?$/.test(pathname);
  const isPayCancel = /\/payment\/cancel\/?$/.test(pathname);

  const isPremium = !!premium?.isPremium;
  const tierLabel = isPremium ? "Premium" : "Miễn phí";

  const benefits = useMemo(() => {
    const b = premium?.benefits || {};
    return [
      {
        key: "ai",
        k: "AI Chat",
        v: b.aiDailyLimit ? `${b.aiDailyLimit}/ngày` : "—",
        icon: "fa-solid fa-robot",
        to: "/tin-nhan?ai=1",
        btn: "Đi tới trang",
      },
      {
        key: "connect",
        k: "Giới hạn kết nối",
        v: b.connectLimit ? `${b.connectLimit} đối tượng` : "—",
        icon: "fa-solid fa-user-group",
        to: "/ket-noi",
        btn: "Đi tới trang",
      },
    ];
  }, [premium]);

  const myPlanLabel = useMemo(() => {
    return (
      premium?.planName ||
      premium?.name ||
      premium?.planCode ||
      premium?.code ||
      (isPremium ? "Premium" : "Miễn phí")
    );
  }, [premium, isPremium]);

  const load = async () => {
    setLoading(true);
    try {
      const [me, pl] = await Promise.all([getMyPremium(), listPremiumPlans()]);
      setPremium(me?.premium || null);
      setPlans(Array.isArray(pl?.items) ? pl.items : []);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Không tải được dữ liệu Premium");
      setPremium(null);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSubscribe = async (planCode) => {
    if (busy) return;
    setBusy(true);
    try {
      const rs = await createPayosLinkForPlanCode(planCode);
      if (!rs?.ok || !rs?.checkoutUrl) throw new Error(rs?.message || "Không tạo được link thanh toán");
      toast.info("Đang chuyển đến cổng thanh toán…");
      window.location.assign(rs.checkoutUrl);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || e?.message || "Không mở được thanh toán");
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

  const onRefresh = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fm-premium-page">
      <div className="fm-premium-wrap">
        <header className="fm-premium-head">
          <div className="fm-premium-badge">{tierLabel}</div>
          <h1 className="fm-premium-title">Fitmatch Premium</h1>
          <p className="fm-premium-desc">
            Nâng cấp Premium để mở khóa nhiều lượt AI Chat mỗi ngày, tăng giới hạn kết nối và trải nghiệm Fitmatch mượt hơn.
          </p>
        </header>

        {isPayReturn ? (
          <section className="fm-premium-block fm-premium-payresult">
            <PaymentReturn />
          </section>
        ) : isPayCancel ? (
          <section className="fm-premium-block fm-premium-payresult">
            <PaymentCancel />
          </section>
        ) : null}

        <div className="fm-premium-tabs" role="tablist" aria-label="Premium tabs">
          <div className="fm-premium-tabwrap">
            <button
              type="button"
              className={`fm-premium-tab ${tab === "upgrade" ? "is-active" : ""}`}
              onClick={() => setTab("upgrade")}
              aria-selected={tab === "upgrade"}
              role="tab"
            >
              Nâng cấp Premium
            </button>

            <button
              type="button"
              className={`fm-premium-tab ${tab === "mine" ? "is-active" : ""}`}
              onClick={() => setTab("mine")}
              aria-selected={tab === "mine"}
              role="tab"
            >
              Premium của tôi
            </button>
          </div>
        </div>

        {tab === "upgrade" ? (
          <section className="fm-premium-block fm-premium-pricing">
            {loading && <div className="fm-premium-sub">Đang tải gói…</div>}
            {!loading && plans.length === 0 && (
              <div className="fm-premium-sub">Hiện chưa có gói Premium nào đang hoạt động.</div>
            )}

            {!loading && plans.length > 0 ? (
              <div className="fm-premium-pricing-grid">
                {plans.map((p) => {
                  const name = p.name || `${p.months} tháng`;
                  const desc = String(p?.description || "").trim();
                  const feats =
                    Array.isArray(p.features) && p.features.length
                      ? p.features
                      : ["Tăng giới hạn AI Chat mỗi ngày", "Tăng giới hạn kết nối", "Mở khóa nhiều tính năng nâng cao"];

                  return (
                    <div key={p._id || p.code} className="fm-price-card">
                      <div className="fm-price-name">{name}</div>

                      <div className="fm-price-desc">
                        {desc ? desc : "Mô tả gói sẽ được cập nhật bởi quản trị viên."}
                      </div>

                      <div className="fm-price-price">
                        <span className="money">{fmtMoney(p.price, p.currency)}</span>
                        <span className="per">/ {Number(p.months || 0)} tháng</span>
                      </div>

                      <div className="fm-price-features">
                        {feats.slice(0, 6).map((x, idx) => (
                          <div key={idx} className="fm-price-feature">
                            <i className="fa-solid fa-check" />
                            <span>{x}</span>
                          </div>
                        ))}
                      </div>

                      <button
                        className="fm-btn fm-btn-primary fm-price-btn"
                        onClick={() => onSubscribe(p.code)}
                        disabled={loading || busy}
                      >
                        {busy ? "Đang mở thanh toán..." : isPremium ? "Gia hạn / Cộng dồn" : "Đăng ký gói"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        ) : (
          <section className="fm-premium-block fm-premium-my">
            <div className="fm-premium-mygrid">
              <div className="fm-premium-mycard">
                <div className="fm-premium-myhead">
                  <div className="fm-premium-mytier">
                    <i className="fa-solid fa-crown" />
                    <span>{myPlanLabel}</span>
                  </div>

                  <div className="fm-premium-myactions">
                    <button
                      type="button"
                      className="fm-btn fm-btn-outline fm-mybtn"
                      onClick={onRefresh}
                      disabled={loading || busy}
                    >
                      <i className="fa-solid fa-arrow-rotate-right"></i>
                    </button>

                    {isPremium ? (
                      <button
                        type="button"
                        className="fm-btn fm-btn-primary fm-mybtn"
                        onClick={onCancel}
                        disabled={busy}
                      >
                        {busy ? "Đang xử lý..." : "Hủy gia hạn"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="fm-btn fm-btn-primary fm-mybtn"
                        onClick={() => setTab("upgrade")}
                        disabled={loading}
                      >
                        Xem các gói
                      </button>
                    )}
                  </div>
                </div>

                <div className="fm-premium-mykv">
                  <div className="row">
                    <span className="k">Trạng thái</span>
                    <span className={`v ${isPremium ? "is-ok" : "is-off"}`}>
                      {loading ? "Đang tải..." : isPremium ? "Đang hoạt động" : "Chưa kích hoạt"}
                    </span>
                  </div>

                  <div className="row">
                    <span className="k">Hết hạn</span>
                    <span className="v">{fmtDate(premium?.expiresAt)}</span>
                  </div>

                  <div className="row">
                    <span className="k">Còn lại</span>
                    <span className="v">{isPremium ? `${premium?.daysLeft || 0} ngày` : "—"}</span>
                  </div>
                </div>

                <div className="fm-premium-mynote">
                  {isPremium
                    ? "Gia hạn gói Premium để không bị gián đoạn trải nghiệm của bạn tại Fitmatch."
                    : "Bạn đang dùng gói miễn phí. Nâng cấp Premium để mở khóa nhiều quyền lợi hơn."}
                </div>
              </div>

              <div className="fm-premium-mycard">
                <div className="fm-premium-mytitle">Quyền lợi hiện tại</div>

                <div className="fm-premium-mybenefits">
                  {benefits.map((x) => (
                    <div key={x.key} className="fm-premium-mybenefit">
                      <div className="ic" aria-hidden="true">
                        <i className={x.icon} />
                      </div>

                      <div className="t">
                        <div className="k">{x.k}</div>
                        <div className="v">{x.v}</div>
                      </div>

                      <Link to={x.to} className="fm-premium-mygo" aria-label={`Đi tới ${x.k}`}>
                        <span>{x.btn}</span>
                        <i className="fa-solid fa-arrow-right" />
                      </Link>
                    </div>
                  ))}
                </div>

                <div className="fm-premium-mytip">
                  Nếu bạn vừa thanh toán xong mà chưa thấy thay đổi, hãy nhấp icon <b>Làm mới</b> hoặc chờ vài giây rồi thử lại.
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
