import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Landing from "./pages/Landing/Landing";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import OnboardingGuard from "./routes/OnboardingGuard";
import HomeGuard from "./routes/HomeGuard";
import OnboardingRoutes from "./pages/Onboarding/OnboardingRoutes";
import Home from "./pages/Home/Home";

// Layout có Navbar + Footer
import AppShell from "./components/layout/AppShell";

// TODO: thay các placeholder này bằng component thật của bạn
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

/** 
 * Layout được bảo vệ (đã có dữ liệu đầu vào) + bọc AppShell
 * Dùng <Outlet/> để render các route con bên trong AppShell
 */
function ProtectedLayout() {
  const nickname = "Tupi"; // TODO: lấy từ store/context (vd: auth.user.nickname)
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

        {/* Chưa onboard → vào flow Onboarding */}
        <Route
          path="/onboarding/*"
          element={
            <OnboardingGuard>
              <OnboardingRoutes />
            </OnboardingGuard>
          }
        />

        {/* Đã onboard → vào khu vực có Navbar/Footer */}
        <Route element={<ProtectedLayout />}>
          {/* Home có thể là dashboard / trang chào khi đã onboard */}
          <Route path="/home" element={<Home />} />

          {/* Thống kê */}
          <Route path="/thong-ke" element={<ThongKe />} />

          {/* Kết nối (Teammate) */}
          <Route path="/ket-noi" element={<KetNoi />} />

          {/* Dinh dưỡng (mặc định: /dinh-duong/nhat-ky) */}
          <Route path="/dinh-duong/nhat-ky" element={<NhatKy />} />
          <Route path="/dinh-duong/ghi-lai" element={<GhiLai />} />
          <Route path="/dinh-duong/ghi-lai/tao-mon" element={<TaoMon />} />
          <Route path="/dinh-duong/ghi-lai/tinh-calo-ai" element={<TinhCaloAI />} />
          <Route path="/dinh-duong/thuc-don-goi-y" element={<ThucDonGoiY />} />

          {/* Tập luyện (mặc định: /tap-luyen/lich-cua-ban) */}
          <Route path="/tap-luyen/lich-cua-ban" element={<LichTap />} />
          <Route path="/tap-luyen/bai-tap" element={<BaiTap />} />
          <Route path="/tap-luyen/bai-tap/cardio" element={<Cardio />} />
          <Route path="/tap-luyen/bai-tap/workout" element={<Workout />} />
          <Route path="/tap-luyen/goi-y" element={<GoiYTap />} />

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
