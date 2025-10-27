// src/lib/api.js
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

// ==== Request interceptor: gắn Bearer token từ localStorage (admin_auth) ====
api.interceptors.request.use((cfg) => {
  const raw = localStorage.getItem("admin_auth");
  if (raw) {
    try {
      const { token } = JSON.parse(raw);
      if (token) cfg.headers.Authorization = `Bearer ${token}`;
    } catch {}
  }
  return cfg;
});

// ==== Response interceptor: callback khi 401 để logout/redirect nếu cần ====
let _onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { _onUnauthorized = fn; };

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && typeof _onUnauthorized === "function") {
      try { _onUnauthorized(); } catch {}
    }
    return Promise.reject(err);
  }
);

// =================== AUTH (ADMIN) ===================
export const adminLogin = async ({ username, password }) => {
  try {
    const r = await api.post("/api/admin/auth/login", { username, password });
    return r.data;
  } catch (e) {
    // Fallback sang user login (tuỳ hệ thống của bạn)
    if (e?.response?.status === 404) {
      const r2 = await api.post("/api/auth/login", { identifier: username, password });
      return r2.data;
    }
    throw e;
  }
};

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

export const getStats = () => api.get("/api/admin/stats").then((r) => r.data);

// =================== ADMIN ACCOUNTS (Level 1) ===================
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

// =================== FOODS (ADMIN) ===================
// Luôn chuẩn hoá payload về { items, total, limit, skip }
const normalizeListPayload = (data) => {
  let items =
    Array.isArray(data) ? data :
    data?.items ?? data?.docs ?? data?.data ?? data?.results ?? data?.result ??
    data?.foods ?? data?.rows ?? data?.list ??
    data?.items?.docs ?? data?.items?.items ?? data?.data?.items ?? [];

  if (!Array.isArray(items)) items = [];
  const total = data?.total ?? data?.count ?? data?.totalDocs ?? data?.items?.total ?? items.length;
  const limit = data?.limit ?? data?.pageSize ?? data?.perPage ?? data?.items?.limit;
  const skip  = data?.skip  ?? data?.offset   ?? data?.page     ?? data?.items?.skip;
  return { items, total, limit, skip };
};

export const listFoods = async (params) => {
  // gọi cả admin & public, gộp kết quả
  const tryFetch = async (path) => {
    try {
      const r = await api.get(path, { params });
      return normalizeListPayload(r.data);
    } catch (e) {
      if (e?.response?.status === 404) return { items: [], total: 0 };
      throw e;
    }
  };

  const a = await tryFetch("/api/admin/foods");
  const b = await tryFetch("/api/foods");

  // gộp & loại trùng theo _id
  const map = new Map();
  [...a.items, ...b.items].forEach((x) => {
    if (x && (x._id || x.id)) map.set(String(x._id || x.id), x);
  });
  const items = Array.from(map.values());

  return {
    items,
    total: a.total || b.total || items.length,
    limit: a.limit ?? b.limit,
    skip: a.skip ?? b.skip,
  };
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

export const rejectFood = async (id, reason = "") => {
  try {
    const r = await api.post(`/api/admin/foods/${id}/reject`, { reason });
    return r.data;
  } catch (e) {
    if (e?.response?.status === 404) {
      const r2 = await api.patch(`/api/foods/${id}`, { status: "rejected" });
      return r2.data;
    }
    throw e;
  }
};

// =================== USERS (ADMIN) ===================
export const listUsers = (params) =>
  api.get("/api/admin/users", { params }).then((r) => r.data);

export const blockUser = (id) =>
  api.post(`/api/admin/users/${id}/block`).then((r) => r.data);

export const unblockUser = (id) =>
  api.post(`/api/admin/users/${id}/unblock`).then((r) => r.data);
