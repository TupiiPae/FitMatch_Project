import axios from "axios";

// Build API base robustly from env to avoid producing /api/api
const raw = import.meta.env.VITE_API_URL || "http://localhost:5000";
const trimmed = raw.replace(/\/+$/, ""); // remove trailing slashes

// If trimmed already ends with /api (e.g. "/api" used for Vite proxy or "http://host/api"),
/// keep it. Otherwise append /api so endpoints become "<base>/api/..."
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
      GET: `${API_BASE}/user/onboarding/me`,
      UPSERT: `${API_BASE}/user/onboarding/upsert`,
      FINALIZE: `${API_BASE}/user/onboarding/finalize`,
    },
  },
};

export const getAuthToken = () => localStorage.getItem("token");

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
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }

  if (!res.ok) {
    const errMsg = (data && (data.message || data.error)) || res.statusText || "API error";
    const err = new Error(errMsg);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
};

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const api = axios.create({
  baseURL: BASE,
  headers: {
    "Content-Type": "application/json",
  },
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
