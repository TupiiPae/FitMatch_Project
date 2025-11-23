import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import Landing from "./pages/Landing/Landing";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import ResetPassword from "./pages/ResetPassword/ResetPassword";
import OnboardingGuard from "./routes/OnboardingGuard";
import HomeGuard from "./routes/HomeGuard";
import OnboardingRoutes from "./pages/Onboarding/OnboardingRoutes";
import Home from "./pages/Home/Home";
//Hehe
// Account pages
import Profile from "./pages/Account/Profile"; 
import AccountSettings from "./pages/Account/AccountSettings";
import PrivacyPolicyPage from "./pages/Account/PrivacyPolicy"; 

// Diary
import RecordMeal from "./pages/Nutrition/RecordMeal";
import FoodForm from "./pages/Nutrition/FoodForm";
import DailyJournal from "./pages/Nutrition/DailyJournal";
import SuggestMenuList from "./pages/Nutrition/SuggestMenuList";
import SuggestMenuDetail from "./pages/Nutrition/SuggestMenuDetail";

// Train
import StrengthList from "./pages/Training/StrengthList";
import CardioList from "./pages/Training/CardioList";
import SportList from "./pages/Training/SportList";
import ExerciseDetail from "./pages/Training/ExerciseDetail";
import WorkoutList from "./pages/Training/WorkoutList";
import WorkoutCreate from "./pages/Training/WorkoutCreate";
import SuggestPlanList from "./pages/Training/SuggestPlanList";   
import SuggestPlanDetail from "./pages/Training/SuggestPlanDetail";

// Layout (Navbar + Footer)
import AppShell from "./components/layout/AppShell";

// PLACEHOLDER (thay bằng component thật sau)
const ThongKe = () => <div>Trang Thống kê</div>;
const KetNoi = () => <div>Trang Kết nối (Teammate)</div>;

// DINH DƯỠNG
// const NhatKy = () => <div>Nhật ký</div>; // Đã import DailyJournal
// const GhiLai = () => <div>Ghi lại bữa ăn</div>; // Đã import RecordMeal
// const TaoMon = () => <div>Tạo món ăn mới</div>; // Đã import FoodForm
const TinhCaloAI = () => <div>Tính toán Calo với AI</div>;
const ThucDonGoiY = () => <div>Thực đơn gợi ý</div>;
const TaoMonAI = () => <div>Tạo món ăn với AI</div>; // Placeholder mới

// TẬP LUYỆN
const LichTap = () => <div>Lịch tập của bạn</div>;
const BaiTap = () => <div>Các bài tập</div>;
const Cardio = () => <div>Cardio</div>;
const Workout = () => <div>Workout (Kháng lực)</div>; // Component này sẽ được dùng cho /khang-luc
const GoiYTap = () => <div>Gợi ý tập luyện</div>;
const TheThao = () => <div>Các môn thể thao</div>; // Placeholder mới

// KHÁC
// const CongDong = () => <div>Cộng đồng (đang phát triển)</div>; // Đã xóa
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
        <Route path="/reset-password" element={<ResetPassword />} />

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

          {/* === DINH DƯỠNG (Đã cập nhật) === */}
          <Route path="/dinh-duong" element={<Navigate to="/dinh-duong/nhat-ky" replace />} />
          <Route path="/dinh-duong/nhat-ky" element={<DailyJournal/>} />
          <Route path="/dinh-duong/ghi-lai" element={<RecordMeal />} />
          {/* Link "Tạo món ăn" từ navbar */}
          <Route path="/dinh-duong/ghi-lai/tao-mon" element={<FoodForm />} /> 
          {/* Giữ lại route Sửa món ăn, đổi path cho gọn */}
          <Route path="/dinh-duong/ghi-lai/sua-mon/:id" element={<FoodForm />} /> 
          {/* Link "Tạo món ăn với AI" từ navbar */}
          <Route path="/dinh-duong/tao-mon-an-ai" element={<TaoMonAI />} />
          {/* Link "Tính Calo AI" từ navbar */}
          <Route path="/dinh-duong/tinh-calo-ai" element={<TinhCaloAI />} />
          <Route  path="/dinh-duong/thuc-don-goi-y" element={<SuggestMenuList  />} />
          <Route path="/dinh-duong/thuc-don-goi-y/chi-tiet/:id" element={<SuggestMenuDetail />} />

          {/* === TẬP LUYỆN (Đã cập nhật) === */}
          <Route path="/tap-luyen" element={<Navigate to="/tap-luyen/lich-cua-ban" replace />} />
          <Route path="/tap-luyen/lich-cua-ban" element={<WorkoutList />} />
          <Route path="/tap-luyen/lich-cua-ban/tao" element={<WorkoutCreate />} />
          <Route path="/tap-luyen/lich-cua-ban/sua/:id" element={<WorkoutCreate />} />
          <Route path="/tap-luyen/bai-tap/khang-luc" element={<StrengthList />} />
          <Route path="/tap-luyen/bai-tap/cardio" element={<CardioList />} />
          <Route path="/tap-luyen/bai-tap/the-thao" element={<SportList />} /> {/* UI riêng */}
          <Route path="/tap-luyen/bai-tap/chi-tiet/:id" element={<ExerciseDetail />} />
          {/* Lịch tập gợi ý */}
          <Route path="/tap-luyen/goi-y" element={<SuggestPlanList />} />
          <Route path="/tap-luyen/goi-y/chi-tiet/:id" element={<SuggestPlanDetail />}/>

          {/* Tài khoản */}
          <Route path="/tai-khoan/ho-so" element={<Profile />} />
          <Route path="/tai-khoan/tai-khoan" element={<AccountSettings />} />
          <Route path="/tai-khoan/quyen-rieng-tu" element={<PrivacyPolicyPage />} />

          {/* Khác */}
          {/* <Route path="/cong-dong" element={<CongDong />} /> */} {/* Đã xóa */}
          <Route path="/ung-dung" element={<UngDung />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
