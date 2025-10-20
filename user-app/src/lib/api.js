import axios from "axios";

/**
 * Build API base robustly from env to avoid producing /api/api
 * - VITE_API_URL có thể là:
 *   - "http://localhost:5000"  -> API_BASE = ".../api"
 *   - "http://localhost:5000/api" (proxy/reverse) -> giữ nguyên
 *   - "/api" (same-origin) -> giữ nguyên
 */
const raw = import.meta.env.VITE_API_URL || "http://localhost:5000";
const trimmed = raw.replace(/\/+$/, "");
const API_BASE = trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;

/** Endpoints khớp với BE */
export const ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE}/auth/login`,
    REGISTER: `${API_BASE}/auth/register`,
    ME: `${API_BASE}/auth/me`,
  },
  USER: {
    ME: `${API_BASE}/user/me`,
    ONBOARDING: {
      // Dùng getMe để lấy user + profile (thay cho /user/onboarding/me trước đây)
      GET: `${API_BASE}/user/me`,
      // Ghi dữ liệu onboarding (PATCH /api/user/onboarding)
      UPSERT: `${API_BASE}/user/onboarding`,
      // Hoàn tất onboarding (POST /api/user/onboarding/finalize)
      FINALIZE: `${API_BASE}/user/onboarding/finalize`,
    },
  },
};

export const getAuthToken = () => localStorage.getItem("token");

/**
 * apiCall: tiện ích fetch thuần (khi muốn gọi URL đầy đủ từ ENDPOINTS.*)
 */
export const apiCall = async (endpoint, opts = {}) => {
  const token = getAuthToken();
  const headers = {
    "Content-Type": "application/json",
    ...(opts.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(endpoint, { ...opts, headers });
  const text = await res.text().catch(() => "");
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const errMsg = (data && (data.message || data.error)) || res.statusText || "API error";
    const err = new Error(errMsg);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
};

/**
 * axios instance — KHÔNG để trùng /api lần nữa
 * -> FE chỉ cần gọi: api.get("/user/me"), api.patch("/user/onboarding"), ...
 */
export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Gắn token tự động nếu có
api.interceptors.request.use(
  (cfg) => {
    const token = localStorage.getItem("token");
    if (token) {
      cfg.headers = cfg.headers || {};
      cfg.headers.Authorization = `Bearer ${token}`;
    }
    return cfg;
  },
  (err) => Promise.reject(err)
);

export default api;
