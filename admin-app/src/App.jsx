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
import AdminAccountsList from "./pages/pagesAdmins/List/List.jsx";
import AdminCreate from "./pages/pagesAdmins/Create/Create.jsx";

export default function App() {
  return (
    <Routes>
      {/* Mặc định điều hướng về /login */}
      <Route index element={<Navigate to="/login" replace />} />

      {/* Đăng nhập admin */}
      <Route path="/login" element={<Login />} />

      {/* Các route cần đăng nhập */}
      <Route
        element={
          <ProtectedRoute>
            <SidebarLayout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Quản trị tài khoản admin – chỉ Admin cấp 1 */}
        <Route element={<OnlyLevel1 />}>
          <Route path="/admins" element={<AdminAccountsList />} />
          <Route path="/admins/create" element={<AdminCreate />} />
        </Route>

        {/* Món ăn */}
        <Route path="/foods" element={<FoodsList />} />
        <Route path="/foods/create" element={<FoodCreate />} />
        <Route path="/foods/review" element={<FoodsReview />} />

        {/* Người dùng */}
        <Route path="/users" element={<UsersList />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
