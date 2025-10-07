import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../lib/api"; // dùng đúng axios instance của bạn

export default function OnboardingGuard({ children }) {
  const token = localStorage.getItem("token");
  const [dangTai, setDangTai] = useState(true);
  const [daOnboard, setDaOnboard] = useState(false);

  useEffect(() => {
    let huy = false;

    (async () => {
      if (!token) {               // không có token => chưa login
        if (!huy) { setDaOnboard(false); setDangTai(false); }
        return;
      }
      try {
        // endpoint đúng theo server
        const { data } = await api.get("/api/user/onboarding/me");
        if (!huy) setDaOnboard(!!data?.data); // có doc onboarding = đã onboarding
      } catch {
        if (!huy) setDaOnboard(false);
      } finally {
        if (!huy) setDangTai(false);
      }
    })();

    return () => { huy = true; };
  }, [token]);

  if (!token) return <Navigate to="/login" replace />;
  if (dangTai) return <div>Đang kiểm tra trạng thái onboarding…</div>;

  // Nếu đã onboarding rồi thì chặn vào flow onboarding và đẩy về Home
  if (daOnboard) return <Navigate to="/home" replace />;

  // Chưa onboarding => cho vào các bước onboarding
  return children;
}
