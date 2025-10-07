import { Navigate, Outlet } from "react-router-dom";

// Chặn truy cập khi chưa đăng nhập (ví dụ)
export default function HomeGuard() {
  const token = localStorage.getItem("token");
  return token ? <Outlet /> : <Navigate to="/dang-nhap" replace />;
}
