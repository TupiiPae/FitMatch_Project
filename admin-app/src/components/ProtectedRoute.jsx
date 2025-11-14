// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export function ProtectedRoute({ children }) {
  const { auth } = useAuth();
  if (!auth?.token) return <Navigate to="/login" replace />;
  return children ?? <Outlet />;
}

export function OnlyLevel1() {
  const { auth } = useAuth();
  const level = Number(auth?.profile?.level);
  if (level !== 1) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
