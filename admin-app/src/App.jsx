// src/App.jsx
import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login/Login.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";

import SidebarLayout from "./components/SidebarLayout/SidebarLayout.jsx";
import { ProtectedRoute, OnlyLevel1 } from "./components/ProtectedRoute.jsx";

// ===== Foods
import FoodsList from "./pages/pagesFoods/Food_List/Food_List.jsx";
import FoodCreate from "./pages/pagesFoods/Food_Create/Food_Create.jsx";
import FoodsReview from "./pages/pagesFoods/Review/Review.jsx";
import FoodEdit from "./pages/pagesFoods/Food_Edit/Food_Edit.jsx";
// NEW: Import List
import ImportList from "./pages/pagesFoods/Import_List/Import_List.jsx";

// ===== Exercises
import StrengthList from "./pages/pagesExercises/Strength_List/Strength_List.jsx";
import StrengthCreate from "./pages/pagesExercises/Strength_Create/Strength_Create.jsx";

// ===== Users
import UsersList from "./pages/pagesUsers/User_List/User_List.jsx";

// ===== Admins
import AdminAccountsList from "./pages/pagesAdmins/Admin_List/Admin_List.jsx";
import AdminCreate from "./pages/pagesAdmins/Admin_Create/Admin_Create.jsx";

// ===== Profile
import ProfilePage from "./pages/ProfilePage/ProfilePage.jsx";

export default function App() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Đang tải…</div>}>
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

          {/* Trang profile (Admin cấp 2 dùng được) */}
          <Route path="/profile" element={<ProfilePage />} />

          {/* Quản trị tài khoản admin – chỉ Admin cấp 1 */}
          <Route element={<OnlyLevel1 />}>
            <Route path="/admins" element={<AdminAccountsList />} />
            <Route path="/admins/create" element={<AdminCreate />} />
          </Route>

          {/* Món ăn */}
          <Route path="/foods" element={<FoodsList />} />
          <Route path="/foods/create" element={<FoodCreate />} />
          <Route path="/foods/:id/edit" element={<FoodEdit />} />
          <Route path="/foods/review" element={<FoodsReview />} />
          <Route path="/foods/import-list" element={<ImportList />} />

          {/* Bài tập */}
          <Route path="/exercises/strength" element={<StrengthList />} />
          <Route path="/exercises/strength/create" element={<StrengthCreate />} />

          {/* Người dùng */}
          <Route path="/users" element={<UsersList />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
