import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { useLocation } from "react-router-dom";
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

  const { pathname } = useLocation();
  const isPayReturn = /\/payment\/return\/?$/.test(pathname);
  const isPayCancel = /\/payment\/cancel\/?$/.test(pathname);


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
      if (!rs?.ok || !rs?.checkoutUrl) {
        throw new Error(rs?.message || "Không tạo được link thanh toán");
      }
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

  return (
    <div className="fm-premium-page">
      <div className="fm-premium-wrap">
        <header className="fm-premium-head">
          <div className="fm-premium-badge">{tierLabel}</div>
          <h1 className="fm-premium-title">Fitmatch Premium</h1>

          <p className="fm-premium-desc">
            Nâng cấp Premium để mở khóa nhiều lượt AI Chat mỗi ngày, tăng giới hạn kết nối và trải nghiệm FitMatch mượt hơn.
          </p>

          {/* {loading ? (
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
          )} */}
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

        {/* <section className="fm-premium-block landing-section">
          <h2 className="fm-premium-h2">Premium mang lại gì?</h2>

          <div className="fm-premium-perkgrid">
            <div className="fm-perk">
              <div className="ic">
                <i className="fa-solid fa-robot" />
              </div>
              <div className="tt">AI Chat thoải mái hơn</div>
              <div className="ds">
                Tăng giới hạn lượt chat mỗi ngày để hỏi kế hoạch ăn uống, tập luyện, phân tích ảnh…
              </div>
            </div>

            <div className="fm-perk">
              <div className="ic">
                <i className="fa-solid fa-user-group" />
              </div>
              <div className="tt">Tăng giới hạn kết nối</div>
              <div className="ds">
                Kết nối được nhiều đối tượng hơn để duy trì động lực tập luyện và theo dõi tiến độ.
              </div>
            </div>

            <div className="fm-perk">
              <div className="ic">
                <i className="fa-solid fa-bolt" />
              </div>
              <div className="tt">Trải nghiệm mượt & ưu tiên</div>
              <div className="ds">
                Hạn chế bị gián đoạn do giới hạn và tối ưu trải nghiệm khi dùng tính năng nâng cao.
              </div>
            </div>
          </div>
        </section>

        <section className="fm-premium-block fm-premium-split landing-section">
          <div className="left">
            <h2 className="fm-premium-h2">Tối ưu hành trình tập luyện</h2>
            <div className="fm-premium-h2sub">
              Premium phù hợp nếu bạn dùng AI thường xuyên, theo dõi dinh dưỡng sát sao, hoặc muốn kết nối nhiều bạn tập.
            </div>

            <div className="fm-premium-points">
              <div className="p">
                <i className="fa-solid fa-circle-check" /> Cá nhân hóa gợi ý theo mục tiêu
              </div>
              <div className="p">
                <i className="fa-solid fa-circle-check" /> Hỗ trợ lập thực đơn, lịch tập nhanh
              </div>
              <div className="p">
                <i className="fa-solid fa-circle-check" /> Tối ưu trải nghiệm theo dõi hàng ngày
              </div>
            </div>
          </div>
        </section>

        <section className="fm-premium-block fm-premium-faq-section landing-section">
          <h2 className="fm-premium-h2">Câu hỏi thường gặp</h2>

          <div className="fm-premium-faq">
            <details>
              <summary>Thanh toán xong khi nào Premium kích hoạt?</summary>
              <div className="ans">
                Sau khi PayOS xác nhận thành công, hệ thống cập nhật qua webhook. Nếu chưa thấy, bấm “Làm mới trạng thái”.
              </div>
            </details>

            <details>
              <summary>Premium có cộng dồn thời hạn không?</summary>
              <div className="ans">
                Có. Khi bạn thanh toán gói mới, thời hạn sẽ được cộng thêm vào thời hạn hiện tại.
              </div>
            </details>

            <details>
              <summary>Tôi có thể hủy gia hạn không?</summary>
              <div className="ans">
                Bạn có thể hủy gia hạn, và vẫn dùng Premium đến hết ngày hết hạn.
              </div>
            </details>
          </div>
        </section> */}
      </div>
    </div>
  );
}