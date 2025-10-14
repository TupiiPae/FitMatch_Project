import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Landing from "./pages/Landing/Landing";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import OnboardingGuard from "./routes/OnboardingGuard";
import HomeGuard from "./routes/HomeGuard";
import OnboardingRoutes from "./pages/Onboarding/OnboardingRoutes";
import Home from "./pages/Home/Home";

// Account pages
import Profile from "./pages/Account/Profile"; // index.jsx => chỉ cần tới thư mục
import AccountSettings from "./pages/Account/AccountSettings";
import PrivacyPolicyPage from "./pages/Account/PrivacyPolicy"; // index.jsx => chỉ cần tới thư mục

// Layout (Navbar + Footer)
import AppShell from "./components/layout/AppShell";

// PLACEHOLDER (thay bằng component thật sau)
const ThongKe = () => <div>Trang Thống kê</div>;
const KetNoi = () => <div>Trang Kết nối (Teammate)</div>;

// DINH DƯỠNG
const NhatKy = () => <div>Nhật ký</div>;
const GhiLai = () => <div>Ghi lại bữa ăn</div>;
const TaoMon = () => <div>Tạo món ăn mới</div>;
const TinhCaloAI = () => <div>Tính toán Calo với AI</div>;
const ThucDonGoiY = () => <div>Thực đơn gợi ý</div>;

// TẬP LUYỆN
const LichTap = () => <div>Lịch tập của bạn</div>;
const BaiTap = () => <div>Các bài tập</div>;
const Cardio = () => <div>Cardio</div>;
const Workout = () => <div>Workout</div>;
const GoiYTap = () => <div>Gợi ý tập luyện</div>;

// KHÁC
const CongDong = () => <div>Cộng đồng (đang phát triển)</div>;
const UngDung = () => <div>Ứng dụng di động</div>;

/** Layout bảo vệ + bọc AppShell */
function ProtectedLayout() {
  const nickname = "Tupi"; // TODO: lấy từ store/context
  return (
    <HomeGuard>
      <AppShell nickname={nickname}>
        <Outlet />
      </AppShell>
    </HomeGuard>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Onboarding (chỉ vào khi chưa onboard) */}
        <Route
          path="/onboarding/*"
          element={
            <OnboardingGuard>
              <OnboardingRoutes />
            </OnboardingGuard>
          }
        />

        {/* Khu vực app có Navbar/Footer */}
        <Route element={<ProtectedLayout />}>
          <Route path="/home" element={<Home />} />

          {/* Thống kê */}
          <Route path="/thong-ke" element={<ThongKe />} />

          {/* Kết nối */}
          <Route path="/ket-noi" element={<KetNoi />} />

          {/* Dinh dưỡng */}
          <Route path="/dinh-duong" element={<Navigate to="/dinh-duong/nhat-ky" replace />} />
          <Route path="/dinh-duong/nhat-ky" element={<NhatKy />} />
          <Route path="/dinh-duong/ghi-lai" element={<GhiLai />} />
          <Route path="/dinh-duong/ghi-lai/tao-mon" element={<TaoMon />} />
          <Route path="/dinh-duong/ghi-lai/tinh-calo-ai" element={<TinhCaloAI />} />
          <Route path="/dinh-duong/thuc-don-goi-y" element={<ThucDonGoiY />} />

          {/* Tập luyện */}
          <Route path="/tap-luyen" element={<Navigate to="/tap-luyen/lich-cua-ban" replace />} />
          <Route path="/tap-luyen/lich-cua-ban" element={<LichTap />} />
          <Route path="/tap-luyen/bai-tap" element={<BaiTap />} />
          <Route path="/tap-luyen/bai-tap/cardio" element={<Cardio />} />
          <Route path="/tap-luyen/bai-tap/workout" element={<Workout />} />
          <Route path="/tap-luyen/goi-y" element={<GoiYTap />} />

          {/* Tài khoản */}
          <Route path="/tai-khoan/ho-so" element={<Profile />} />
          <Route path="/tai-khoan/tai-khoan" element={<AccountSettings />} />
          <Route path="/tai-khoan/quyen-rieng-tu" element={<PrivacyPolicyPage />} />

          {/* Khác */}
          <Route path="/cong-dong" element={<CongDong />} />
          <Route path="/ung-dung" element={<UngDung />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
