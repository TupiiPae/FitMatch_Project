// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing/Landing";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        {/* các route tiếp theo */}
        {/* <Route path="/onboarding" element={<Onboarding />} /> */}
        {/* <Route path="/app" element={<Home />} /> */}
      </Routes>
    </BrowserRouter>
  );
}
