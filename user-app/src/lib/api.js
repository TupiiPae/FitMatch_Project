import axios from "axios";

const raw = import.meta.env.VITE_API_URL || "http://localhost:5000";
const trimmed = raw.replace(/\/+$/, "");
const API_BASE = trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;

export const ENDPOINTS = {
  AUTH: {
    LOGIN: `${API_BASE}/auth/login`,
    REGISTER: `${API_BASE}/auth/register`,
    ME: `${API_BASE}/auth/me`,
  },
  USER: {
    ME: `${API_BASE}/user/me`,
    ONBOARDING: {
      GET: `${API_BASE}/user/me`,
      UPSERT: `${API_BASE}/user/onboarding`,
      FINALIZE: `${API_BASE}/user/onboarding/finalize`,
    },
  },
};

export const getAuthToken = () => localStorage.getItem("token");

export const apiCall = async (endpoint, opts = {}) => {
  const token = getAuthToken();
  const headers = { ...(opts.headers || {}) };
  if (!("Content-Type" in headers)) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(endpoint, { ...opts, headers });
  const text = await res.text().catch(() => "");
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error((data && (data.message || data.error)) || res.statusText || "API error");
    err.status = res.status; err.body = data; throw err;
  }
  return data;
};

export const api = axios.create({
  baseURL: API_BASE,
  // Chấp nhận 304 là success (dùng chung data từ cache)
  validateStatus: (status) =>
    (status >= 200 && status < 300) || status === 304,
});

// Attach token + xử lý FormData
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) {
    cfg.headers = cfg.headers || {};
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  // Nếu gửi FormData, bỏ Content-Type để trình duyệt tự set boundary
  const isFormData =
    (typeof FormData !== "undefined" && cfg.data instanceof FormData) ||
    (cfg.headers && String(cfg.headers["Content-Type"] || "").includes("multipart/form-data"));
  if (isFormData && cfg.headers) {
    delete cfg.headers["Content-Type"];
  }
  return cfg;
}, (err) => Promise.reject(err));

export default api;
