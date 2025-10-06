import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing/Landing";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import OnboardingGuard from "./routes/OnboardingGuard";
import OnboardingRoutes from "./pages/Onboarding/OnboardingRoutes";
import Home from "./pages/Home/Home";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Onboarding flow */}
        <Route path="/onboarding/*" element={<OnboardingRoutes />} />

        {/* Khi đã hoàn tất onboarding thì mới vào app chính */}
        <Route element={<OnboardingGuard />}>
          <Route path="/app" element={<Home />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
