import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login/Login.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";

import SidebarLayout from "./components/SidebarLayout/SidebarLayout.jsx";
import { ProtectedRoute, OnlyLevel1 } from "./components/ProtectedRoute.jsx";

// Pages đã làm
import FoodsList from "./pagesFoods/List/List.jsx";
import FoodCreate from "./pagesFoods/Create/Create.jsx";
import FoodsReview from "./pagesFoods/Review/Review.jsx";
import UsersList from "./pagesUsers/List/List.jsx";

const Placeholder = ({ title }) => <div style={{padding:16}}>📄 {title} (đang phát triển)</div>;

export default function App(){
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Admin cấp 1 */}
        <Route element={<OnlyLevel1 />}>
          <Route path="/admins" element={<Placeholder title="Quản trị: Danh sách tài khoản" />} />
          <Route path="/admins/create" element={<Placeholder title="Quản trị: Tạo tài khoản" />} />
        </Route>

        {/* Foods */}
        <Route path="/foods" element={<FoodsList />} />
        <Route path="/foods/create" element={<FoodCreate />} />
        <Route path="/foods/review" element={<FoodsReview />} />

        {/* Users */}
        <Route path="/users" element={<UsersList />} />

        {/* Others (link được, UI sau) */}
        <Route path="/exercises" element={<Placeholder title="Quản lý bài tập" />} />
        <Route path="/exercises/create" element={<Placeholder title="Tạo bài tập" />} />
        <Route path="/matching" element={<Placeholder title="Danh sách ghép cặp" />} />
        <Route path="/reports" element={<Placeholder title="Report" />} />
        <Route path="/profile" element={<Placeholder title="Thông tin tài khoản" />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
