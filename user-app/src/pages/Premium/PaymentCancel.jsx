import { useSearchParams, Link } from "react-router-dom";
import "./PaymentCancel.css";

export default function PaymentCancel() {
  const [sp] = useSearchParams();
  const orderCode = sp.get("orderCode");

  return (
    <div className="fm-payresult">
      <div className="fm-payresult-card is-cancel">

        <h2 className="fm-payresult-title">Bạn đã huỷ thanh toán</h2>

        <p className="fm-payresult-sub">
          Không sao cả — bạn có thể quay lại Premium để chọn gói và thanh toán lại bất cứ lúc nào.
        </p>

        <div className="fm-payresult-meta">
          <span className="k">Mã đơn</span>
          <span className="v">{orderCode || "—"}</span>
        </div>

        <div className="fm-payresult-actions">

          <Link to="/premium" className="fm-paybtn fm-paybtn-ghost">
            Về trang Premium
          </Link>
        </div>
      </div>
    </div>
  );
}
