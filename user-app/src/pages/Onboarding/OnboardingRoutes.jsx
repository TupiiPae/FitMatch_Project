import { Routes, Route, Navigate } from "react-router-dom";
import Welcome from "./steps/Welcome";
import Nickname from "./steps/Nickname";
import Goal from "./steps/Goal";
import Motivation from "./steps/Motivation";
import BasicMetrics from "./steps/BasicMetrics";
import TargetWeight from "./steps/TargetWeight";
import WeeklyChange from "./steps/WeeklyChange";
import Intensity from "./steps/Intensity";
import Summary from "./steps/Summary";

export default function OnboardingRoutes() {
  return (
    <Routes>
      <Route path="chao-mung" element={<Welcome />} />
      <Route path="ten-goi" element={<Nickname />} />
      <Route path="muc-tieu" element={<Goal />} />
      <Route path="dong-luc" element={<Motivation />} />
      <Route path="so-lieu-co-ban" element={<BasicMetrics />} />
      <Route path="can-nang-muc-tieu" element={<TargetWeight />} />
      <Route path="muc-tieu-hang-tuan" element={<WeeklyChange />} />
      <Route path="cuong-do" element={<Intensity />} />
      <Route path="tong-hop" element={<Summary />} />
      <Route index element={<Navigate to="chao-mung" replace />} />
    </Routes>
  );
}
