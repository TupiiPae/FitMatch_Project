// src/lib/api.js
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// ===== Attach token =====
api.interceptors.request.use((cfg) => {
  const raw = localStorage.getItem("admin_auth");
  if (raw) {
    const { token } = JSON.parse(raw);
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

/** Cho phép FE đăng ký hành vi khi gặp 401 (vd: logout + nav /login) */
let _onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { _onUnauthorized = fn; };

// ===== Global 401 handling =====
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    if (status === 401 && typeof _onUnauthorized === "function") {
      try { _onUnauthorized(); } catch {}
    }
    return Promise.reject(err);
  }
);

/* --------------------- Auth (Admin) --------------------- */
/**
 * Đăng nhập Admin CHỈ bằng username/password.
 * Ưu tiên /api/admin/auth/login; nếu 404 thì fallback /api/auth/login (trong trường hợp bạn chưa tách Admin.js).
 */
export const adminLogin = async ({ username, password }) => {
  try {
    const r = await api.post("/api/admin/auth/login", { username, password });
    return r.data; // { token, user:{ username, role:'admin', level:1|2, ... } }
  } catch (e) {
    if (e?.response?.status === 404) {
      // fallback tạm (BE cũ): /api/auth/login có thể dùng identifier/password
      const r2 = await api.post("/api/auth/login", { identifier: username, password });
      return r2.data;
    }
    throw e;
  }
};

/**
 * Lấy thông tin admin hiện tại để verify token.
 * Ưu tiên /api/admin/auth/me, fallback /api/user/me (BE cũ).
 */
export const adminMe = async () => {
  try {
    const r = await api.get("/api/admin/auth/me");
    return r.data;
  } catch (e) {
    if (e?.response?.status === 404) {
      const r2 = await api.get("/api/user/me");
      return r2.data;
    }
    throw e;
  }
};

/* --------------------- Stats --------------------- */
export const getStats = () => api.get("/api/admin/stats").then((r) => r.data);

/* --------------------- Admin Accounts (Cấp 1) --------------------- */
export const listAdminAccounts = (q = "") =>
  api.get("/api/admin/admin-accounts", { params: { q } }).then((r) => r.data);
export const createAdminAccount = (body) =>
  api.post("/api/admin/admin-accounts", body).then((r) => r.data);
export const updateAdminAccount = (id, body) =>
  api.patch(`/api/admin/admin-accounts/${id}`, body).then((r) => r.data);
export const deleteAdminAccount = (id) =>
  api.delete(`/api/admin/admin-accounts/${id}`).then((r) => r.data);
export const blockAdminAccount = (id) =>
  api.post(`/api/admin/admin-accounts/${id}/block`).then((r) => r.data);

/* --------------------- Foods --------------------- */
/**
 * Các API dưới ưu tiên route admin:
 *  - GET/POST/PATCH/DELETE: /api/admin/foods...
 * Fallback:
 *  - list: GET /api/foods (map params)
 *  - create: POST /api/foods (status mặc định 'pending')
 *  - update: PATCH /api/foods/:id
 *  - delete: DELETE /api/foods/:id
 *  - approve/reject: PATCH /api/foods/:id { status:'approved'|'rejected' }
 */
export const listFoods = async (params) => {
  try {
    const r = await api.get("/api/admin/foods", { params });
    return r.data;
  } catch (e) {
    if (e?.response?.status === 404) {
      const r2 = await api.get("/api/foods", { params });
      return r2.data;
    }
    throw e;
  }
};

export const createFood = async (body) => {
  try {
    const r = await api.post("/api/admin/foods", body);
    return r.data;
  } catch (e) {
    if (e?.response?.status === 404) {
      const r2 = await api.post("/api/foods", body);
      return r2.data;
    }
    throw e;
  }
};

export const updateFood = async (id, body) => {
  try {
    const r = await api.patch(`/api/admin/foods/${id}`, body);
    return r.data;
  } catch (e) {
    if (e?.response?.status === 404) {
      const r2 = await api.patch(`/api/foods/${id}`, body);
      return r2.data;
    }
    throw e;
  }
};

export const deleteFood = async (id) => {
  try {
    const r = await api.delete(`/api/admin/foods/${id}`);
    return r.data;
  } catch (e) {
    if (e?.response?.status === 404) {
      const r2 = await api.delete(`/api/foods/${id}`);
      return r2.data;
    }
    throw e;
  }
};

export const approveFood = async (id) => {
  try {
    const r = await api.post(`/api/admin/foods/${id}/approve`);
    return r.data;
  } catch (e) {
    if (e?.response?.status === 404) {
      const r2 = await api.patch(`/api/foods/${id}`, { status: "approved" });
      return r2.data;
    }
    throw e;
  }
};

export const rejectFood = async (id) => {
  try {
    const r = await api.post(`/api/admin/foods/${id}/reject`);
    return r.data;
  } catch (e) {
    if (e?.response?.status === 404) {
      const r2 = await api.patch(`/api/foods/${id}`, { status: "rejected" });
      return r2.data;
    }
    throw e;
  }
};

/* --------------------- Users --------------------- */
export const listUsers = (params) =>
  api.get("/api/admin/users", { params }).then((r) => r.data);
export const blockUser = (id) =>
  api.post(`/api/admin/users/${id}/block`).then((r) => r.data);
export const unblockUser = (id) =>
  api.post(`/api/admin/users/${id}/unblock`).then((r) => r.data);
