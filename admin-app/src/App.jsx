// src/App.jsx
import React, { Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login/Login.jsx";
import Dashboard from "./pages/Dashboard/Dashboard.jsx";

import SidebarLayout from "./components/SidebarLayout/SidebarLayout.jsx";
import { ProtectedRoute, OnlyLevel1 } from "./components/ProtectedRoute.jsx";
import AdminNotFound from "./pages/Error404/AdminNotFound.jsx";

// ===== Foods
import FoodsList from "./pages/pagesFoods/Food_List/Food_List.jsx";
import FoodCreate from "./pages/pagesFoods/Food_Create/Food_Create.jsx";
import FoodsReview from "./pages/pagesFoods/Review/Review.jsx";
import FoodEdit from "./pages/pagesFoods/Food_Edit/Food_Edit.jsx";
import ImportList from "./pages/pagesFoods/Import_List/Import_List.jsx";
import SuggestMenu_List from "./pages/pagesFoods/SuggestMenu_List/SuggestMenu_List";
import SuggestMenu_Form from "./pages/pagesFoods/SuggestMenu_Form/SuggestMenu_Form";

// ===== Exercises
import StrengthList from "./pages/pagesExercises/Strength_List/Strength_List.jsx";
import StrengthCreate from "./pages/pagesExercises/Strength_Create/Strength_Create.jsx";
import CardioList from "./pages/pagesExercises/Cardio_List/Cardio_List.jsx";
import CardioCreate from "./pages/pagesExercises/Cardio_Create/Cardio_Create.jsx";
import SportList from "./pages/pagesExercises/Sport_List/Sport_List.jsx";
import SportCreate from "./pages/pagesExercises/Sport_Create/Sport_Create.jsx";
import ExercisesEdit from "./pages/pagesExercises/Exercises_Edit/Exercises_Edit.jsx";
import SuggestPlanCreate from "./pages/pagesExercises/SuggestPlan_Create/SuggestPlan_Create.jsx";
import SuggestPlanList from "./pages/pagesExercises/SuggestPlan_List/SuggestPlan_List.jsx";

// ===== Statistic / Audit Log
import AuditLog from "./pages/pagesStatistic/Audit_Log/Audit_Log.jsx";

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
          <Route path="/foods/suggest-menu" element={<SuggestMenu_List />} />
          <Route path="/foods/suggest-menu/create" element={<SuggestMenu_Form />} />
          <Route path="/foods/suggest-menu/:id/edit" element={<SuggestMenu_Form />} />

          {/* Bài tập */}
          <Route path="/exercises/strength" element={<StrengthList />} />
          <Route path="/exercises/strength/create" element={<StrengthCreate />} />
          <Route path="/exercises/cardio" element={<CardioList />} />
          <Route path="/exercises/cardio/create" element={<CardioCreate />} />
          <Route path="/exercises/sport" element={<SportList />} />
          <Route path="/exercises/sport/create" element={<SportCreate />} />
          <Route path="/exercises/:id/edit" element={<ExercisesEdit />} />
          <Route path="/exercises/suggest-plan" element={<SuggestPlanList />} />
          <Route path="/exercises/suggest-plan/create" element={<SuggestPlanCreate />} />
          <Route path="/exercises/suggest-plan/:id/edit" element={<SuggestPlanCreate />} />

          {/* Thống kê - Audit Log */}
          <Route path="/statistics/audit-log" element={<AuditLog />} />

          {/* Người dùng */}
          <Route path="/users" element={<UsersList />} />
        </Route>

        {/* Fallback */}
        <Route
          path="*" element={ <ProtectedRoute> <AdminNotFound /> </ProtectedRoute>}/>
      </Routes>
    </Suspense>
  );
}
