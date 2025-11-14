import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin, adminMe, setUnauthorizedHandler } from "../lib/api";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const nav = useNavigate();
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(localStorage.getItem("admin_auth")) || null; } catch { return null; }
  });

  // Đăng nhập bằng username + password
  const login = async ({ username, password }) => {
    const data = await adminLogin({ username, password });
    const { token, user } = data || {};
    if (!token) throw new Error("Đăng nhập thất bại");
    const next = { token, profile: user }; // user: { username, role:'admin', level:1|2, ... }
    localStorage.setItem("admin_auth", JSON.stringify(next));
    setAuth(next);
    nav("/dashboard", { replace: true });
  };

  // Đăng xuất
  const logout = React.useCallback(() => {
    localStorage.removeItem("admin_auth");
    setAuth(null);
    nav("/login", { replace: true });
  }, [nav]);

  // Đăng ký handler 401 toàn cục → tự logout
  useEffect(() => {
    setUnauthorizedHandler(() => logout);
  }, [logout]);

  // Verify token khi app khởi động / khi token thay đổi
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!auth?.token) return;
      try {
        const me = await adminMe(); // 200 => token OK
        if (!cancelled && me) {
          // đồng bộ lại profile nếu BE trả thêm/thay đổi
          setAuth(prev => prev ? { ...prev, profile: { ...prev.profile, ...me } } : prev);
        }
      } catch {
        if (!cancelled) logout(); // hết hạn / không hợp lệ
      }
    })();
    return () => { cancelled = true; };
  }, [auth?.token, logout]);

  const value = useMemo(() => ({ auth, login, logout }), [auth, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
