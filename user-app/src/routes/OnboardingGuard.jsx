// src/routes/OnboardingGuard.jsx
import { Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function OnboardingGuard() {
  const [checking, setChecking] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(null);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data } = await api.get("/user/me");
        setIsOnboarded(data?.user?.onboarded);
      } catch {
        setIsOnboarded(false);
      } finally {
        setChecking(false);
      }
    };
    checkUser();
  }, []);

  if (checking) return <div>Đang kiểm tra tài khoản...</div>;

  // Nếu user chưa onboarded → đi tới trang onboarding
  if (isOnboarded === false) return <Navigate to="/onboarding" replace />;

  // Nếu user đã hoàn thành → cho phép vào ứng dụng chính
  return <Outlet />;
}
