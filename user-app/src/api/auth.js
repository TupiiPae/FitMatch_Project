import { ENDPOINTS, apiCall } from "../lib/api.js";

export const login = async (usernameOrEmail, password) => {
  const response = await fetch(ENDPOINTS.AUTH.LOGIN, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: usernameOrEmail, password }),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    throw new Error((data && data.message) || response.statusText || "Login failed");
  }
  // server should return token in { token: '...' } or similar
  const token = data?.token || data?.accessToken || null;
  if (!token) throw new Error("Token missing in login response");
  localStorage.setItem("token", token);
  return data;
};

export const logout = () => localStorage.removeItem("token");