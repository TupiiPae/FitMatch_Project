import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { getPayosStatus } from "../../api/payos";

export default function PaymentReturn() {
  const [sp] = useSearchParams();
  const orderCode = sp.get("orderCode");
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
      const rs = await getPayosStatus(orderCode);
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

  const isPending =
    s === "PENDING" || s === "PROCESSING" || s === "WAITING" || s === "INIT";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h2>
        {loading
          ? "Đang kiểm tra trạng thái thanh toán…"
          : err
          ? "Không kiểm tra được thanh toán"
          : isPaid
          ? "Thanh toán thành công"
          : isPending
          ? "Thanh toán đang xử lý"
          : "Thanh toán chưa thành công"}
      </h2>

      <p>Mã đơn: {orderCode || "—"}</p>

      {err ? (
        <p style={{ color: "#ff6b6b" }}>{err}</p>
      ) : (
        <p>Trạng thái: <b>{local?.status || "—"}</b></p>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button onClick={fetchStatus} disabled={loading} style={{ padding: "10px 12px", borderRadius: 10 }}>
          {loading ? "Đang kiểm tra..." : "Kiểm tra lại"}
        </button>

        <Link to="/premium" style={{ padding: "10px 12px", borderRadius: 10 }}>
          Về Premium
        </Link>

        {!loading && !err && !isPaid ? (
          <Link to="/premium" onClick={() => toast.info("Bạn có thể chọn gói và thanh toán lại")} style={{ padding: "10px 12px", borderRadius: 10 }}>
            Thanh toán lại
          </Link>
        ) : null}
      </div>

      <p style={{ opacity: 0.8, marginTop: 12 }}>
        Nếu vừa thanh toán xong mà Premium chưa cập nhật, hãy chờ vài giây rồi vào <b>Premium</b> bấm <b>Làm mới</b>.
      </p>
    </div>
  );
}
