// user-app/src/pages/Premium/PaymentReturn.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { getPayosStatus } from "../../api/payos";
import { getMyPremium } from "../../api/premium";
import "./PaymentReturn.css";

export default function PaymentReturn() {
  const [sp] = useSearchParams();
  const orderCode = sp.get("orderCode");
  const toastedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [err, setErr] = useState("");

  const fetchStatus = async () => {
    if (!orderCode) {
      setErr("Thiếu mã đơn (orderCode).");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr("");
    try {
      const rs = await getPayosStatus(Number(orderCode) || orderCode);
      setStatus(rs || null);
    } catch (e) {
      console.error(e);
      setErr(e?.response?.data?.message || e?.message || "Không kiểm tra được trạng thái thanh toán");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderCode]);

  const local = status?.local;
  const s = String(local?.status || "").toUpperCase();

  const isPaid =
    s === "PAID" || s === "SUCCESS" || s === "COMPLETED" || s === "PAYMENT_SUCCESS";

  useEffect(() => {
    if (!isPaid || toastedRef.current) return;
    toastedRef.current = true;
    getMyPremium().catch(() => {});
    toast.success("Premium đã được kích hoạt!");
  }, [isPaid]);

  const isPending =
    s === "PENDING" || s === "PROCESSING" || s === "WAITING" || s === "INIT";

  const view = useMemo(() => {
    if (loading) {
      return {
        variant: "pending",
        icon: "fa-solid fa-spinner fa-spin",
        title: "Đang kiểm tra trạng thái thanh toán…",
        sub: "Vui lòng chờ vài giây. Hệ thống đang đối soát trạng thái đơn hàng.",
      };
    }

    if (err) {
      return {
        variant: "error",
        icon: "fa-solid fa-circle-exclamation",
        title: "Không kiểm tra được thanh toán",
        sub: "Có lỗi xảy ra khi kiểm tra trạng thái. Bạn có thể thử kiểm tra lại.",
      };
    }

    if (isPaid) {
      return {
        variant: "success",
        icon: "fa-solid fa-circle-check",
        title: "Thanh toán thành công",
        sub: "Cảm ơn bạn! Tài khoản của bạn đã được cập nhật Premium.",
      };
    }

    if (isPending) {
      return {
        variant: "pending",
        icon: "fa-solid fa-clock",
        title: "Thanh toán đang xử lý",
        sub: "Đơn hàng đang trong quá trình xử lý. Bạn có thể kiểm tra lại sau vài giây.",
      };
    }

    return {
      variant: "fail",
      icon: "fa-solid fa-circle-xmark",
      title: "Thanh toán chưa thành công",
      sub: "Nếu bạn muốn, hãy quay lại Premium để chọn gói và thanh toán lại.",
    };
  }, [loading, err, isPaid, isPending]);

  const showRetryPay = !loading && !err && !isPaid;

  return (
    <div className="fm-payresult">
      <div className={`fm-payresult-card is-${view.variant}`}>
        <div className="fm-payresult-icon" aria-hidden="true">
          <i className={view.icon} />
        </div>

        <h2 className="fm-payresult-title">{view.title}</h2>

        <p className="fm-payresult-sub">{view.sub}</p>

        <div className="fm-payresult-meta">
          <span className="k">Mã đơn</span>
          <span className="v">{orderCode || "—"}</span>
        </div>

        {!loading && !err ? (
          <div className="fm-payresult-meta">
            <span className="k">Trạng thái</span>
            <span className="v">{local?.status || "—"}</span>
          </div>
        ) : null}

        {err ? <div className="fm-payresult-error">{err}</div> : null}

        <div className="fm-payresult-actions">
          <button
            type="button"
            className="fm-paybtn fm-paybtn-ghost"
            onClick={fetchStatus}
            disabled={loading}
          >
            {loading ? "Đang kiểm tra..." : "Kiểm tra lại"}
          </button>

          <Link to="/premium" className="fm-paybtn fm-paybtn-primary">
            Về trang Premium
          </Link>

          {showRetryPay ? (
            <Link
              to="/premium"
              onClick={() => toast.info("Bạn có thể chọn gói và thanh toán lại")}
              className="fm-paybtn fm-paybtn-ghost"
            >
              Thanh toán lại
            </Link>
          ) : null}
        </div>

        {!loading && !err ? (
          <p className="fm-payresult-tip">
            Nếu bạn vừa thanh toán xong mà Premium chưa cập nhật, hãy chờ vài giây rồi vào <b>Premium</b> và bấm <b>Làm mới</b>.
          </p>
        ) : null}
      </div>
    </div>
  );
}
