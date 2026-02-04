import { useSearchParams, Link } from "react-router-dom";

export default function PaymentCancel() {
  const [sp] = useSearchParams();
  const orderCode = sp.get("orderCode");

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h2>Bạn đã huỷ thanh toán</h2>
      <p>Mã đơn: {orderCode || "—"}</p>
      <Link to="/premium">Thử lại</Link>
    </div>
  );
}
