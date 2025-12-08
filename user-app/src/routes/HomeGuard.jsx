import { Navigate } from "react-router-dom";

export default function HomeGuard({ children }) {
  const token = localStorage.getItem("token");
  if (!token) return <Navigate to="/login" replace />;
  return children;
}
