// src/App.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login/Login.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";

import SidebarLayout from "./components/SidebarLayout/SidebarLayout.jsx";
import { ProtectedRoute, OnlyLevel1 } from "./components/ProtectedRoute.jsx";

// ===== Foods
import FoodsList from "./pages/pagesFoods/Food_List/Food_List.jsx";
import FoodCreate from "./pages/pagesFoods/Food_Create/Food_Create.jsx";
import FoodsReview from "./pages/pagesFoods/Review/Review.jsx";

// ===== Users
import UsersList from "./pages/pagesUsers/User_List/User_List.jsx";

// ===== Admins
import AdminAccountsList from "./pages/pagesAdmins/Admin_List/Admin_List.jsx";
import AdminCreate from "./pages/pagesAdmins/Admin_Create/Admin_Create.jsx";

// ===== THÊM IMPORT MỚI =====
import ProfilePage from "./pages/ProfilePage/ProfilePage.jsx";


export default function App() {
  return (
    <Routes>
      {/* Điều hướng mặc định */}
      <Route index element={<Navigate to="/login" replace />} />

      {/* Đăng nhập admin */}
      <Route path="/login" element={<Login />} />

      {/* Khu vực cần đăng nhập */}
      <Route
        element={
          <ProtectedRoute>
            <SidebarLayout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* ===== THÊM ROUTE MỚI ===== */}
        {/* Trang profile (dành cho Admin cấp 2) */}
        <Route path="/profile" element={<ProfilePage />} />

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