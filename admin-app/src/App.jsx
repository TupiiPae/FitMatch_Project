// App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login/Login.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";

import SidebarLayout from "./components/SidebarLayout/SidebarLayout.jsx";
import { ProtectedRoute, OnlyLevel1 } from "./components/ProtectedRoute.jsx";

import FoodsList from "./pages/pagesFoods/List/List.jsx";
import FoodCreate from "./pages/pagesFoods/Create/Create.jsx";
import FoodsReview from "./pages/pagesFoods/Review/Review.jsx";
import UsersList from "./pages/pagesUsers/List/List.jsx";

const Placeholder = ({ title }) => <div style={{ padding:16 }}>{title} (đang phát triển)</div>;

export default function App(){
  return (
    <Routes>
      {/* ✅ Mặc định mở /login khi vào "/" */}
      <Route index element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<Login />} />

      {/* Các route cần đăng nhập */}
      <Route element={<ProtectedRoute><SidebarLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<Dashboard />} />

        <Route element={<OnlyLevel1 />}>
          <Route path="/admins" element={<Placeholder title="Quản trị: Danh sách tài khoản" />} />
          <Route path="/admins/create" element={<Placeholder title="Quản trị: Tạo tài khoản" />} />
        </Route>

        <Route path="/foods" element={<FoodsList />} />
        <Route path="/foods/create" element={<FoodCreate />} />
        <Route path="/foods/review" element={<FoodsReview />} />

        <Route path="/users" element={<UsersList />} />

        <Route path="/exercises" element={<Placeholder title="Quản lý bài tập" />} />
        <Route path="/exercises/create" element={<Placeholder title="Tạo bài tập" />} />
        <Route path="/matching" element={<Placeholder title="Danh sách ghép cặp" />} />
        <Route path="/reports" element={<Placeholder title="Report" />} />
        <Route path="/profile" element={<Placeholder title="Thông tin tài khoản" />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
