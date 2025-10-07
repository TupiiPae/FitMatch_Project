import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing/Landing";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import OnboardingGuard from "./routes/OnboardingGuard";
import HomeGuard from "./routes/HomeGuard";
import OnboardingRoutes from "./pages/Onboarding/OnboardingRoutes";
import Home from "./pages/Home/Home";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Chưa onboard mới vào được các bước onboarding */}
        <Route
          path="/onboarding/*"
          element={
            <OnboardingGuard>
              <OnboardingRoutes />
            </OnboardingGuard>
          }
        />

        {/* Đã onboard mới vào được Home */}
        <Route
          path="/home"
          element={
            <HomeGuard>
              <Home />
            </HomeGuard>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
