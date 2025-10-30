// src/lib/api.js
import axios from "axios";

/* ---------------------------
 * BASE & AXIOS INSTANCE
 * --------------------------- */
const rawBase = import.meta.env.VITE_API_BASE || "http://localhost:5000";
// Chuẩn hoá bỏ dấu "/" cuối (nếu có) để tránh "//" khi concat
const API_BASE = String(rawBase || "").replace(/\/+$/, "");

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

/* ---------------------------
 * Request: gắn Bearer token
 * --------------------------- */
api.interceptors.request.use((cfg) => {
  // Ưu tiên admin_auth (object JSON {token,...}), fallback token chuỗi
  const getToken = () => {
    const rawAdmin = localStorage.getItem("admin_auth");
    if (rawAdmin) {
      try {
        const parsed = JSON.parse(rawAdmin);
        if (parsed?.token) return parsed.token;
      } catch {
        // nếu lưu chuỗi thuần
        return rawAdmin;
      }
    }
    // Fallback: user token (giữ để không phá chỗ khác dùng chung api)
    const rawUser = localStorage.getItem("token");
    if (rawUser) {
      try {
        const parsedUser = JSON.parse(rawUser);
        if (parsedUser?.token) return parsedUser.token;
      } catch {
        return rawUser;
      }
    }
    return null;
  };

  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

/* ------------------------------------
 * Response: callback khi bị 401 (logout)
 * ------------------------------------ */
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

/* -------------------------------------------------
 * Helper: Chuẩn hoá payload list về {items,total,...}
 * ------------------------------------------------- */
const normalizeListPayload = (data) => {
  let items =
    Array.isArray(data) ? data :
    data?.items ?? data?.docs ?? data?.data ?? data?.results ?? data?.result ??
    data?.rows ?? data?.list ??
    data?.items?.docs ?? data?.items?.items ?? data?.data?.items ?? [];

  if (!Array.isArray(items)) items = [];
  const total = data?.total ?? data?.count ?? data?.totalDocs ?? data?.items?.total ?? items.length;
  const limit = data?.limit ?? data?.pageSize ?? data?.perPage ?? data?.items?.limit ?? undefined;
  const skip  = data?.skip  ?? data?.offset   ?? data?.page     ?? data?.items?.skip  ?? undefined;
  return { items, total, limit, skip };
};

/* =========================
 * AUTH (ADMIN)
 * ========================= */
export const adminLogin = async ({ username, password }) => {
  try {
    const r = await api.post("/api/admin/auth/login", { identifier: username, password });
    return r.data;
  } catch (e) {
    // Fallback sang user login nếu backend không có route admin (tuỳ system)
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
    return r.data; // { id, username, role, level, status }
  } catch (e) {
    if (e?.response?.status === 404) {
      const r2 = await api.get("/api/user/me");
      return r2.data;
    }
    throw e;
  }
};

export const getStats = () =>
  api.get("/api/admin/stats").then((r) => r.data);

/* =========================
 * ADMIN ACCOUNTS (Level 1)
 * ========================= */
export const listAdminAccounts = async (params = {}) => {
  try {
    const r = await api.get("/api/admin/admin-accounts", { params });
    const { items, total, limit, skip } = normalizeListPayload(r.data);
    return { items, total, limit, skip };
  } catch (e) {
    const status = e?.response?.status;
    // Không có quyền (lv2) hoặc route chưa có -> trả rỗng để UI không vỡ
    if (status === 403 || status === 404) {
      return {
        items: [],
        total: 0,
        limit: params.limit ?? 0,
        skip: params.skip ?? 0,
        forbidden: status === 403,
      };
    }
    throw e;
  }
};

export const createAdminAccount = async ({ username, nickname, password }) => {
  const body = {
    username,
    nickname,
    password: password || "fitmatch@admin2", // theo yêu cầu
    level: 2,
  };
  const r = await api.post("/api/admin/admin-accounts", body);
  return r.data;
};

export const updateAdminAccount = async (id, body) => {
  const r = await api.patch(`/api/admin/admin-accounts/${id}`, body);
  return r.data;
};

export const deleteAdminAccount = async (id) => {
  const r = await api.delete(`/api/admin/admin-accounts/${id}`);
  return r.data;
};

export const blockAdminAccount = async (id) => {
  const r = await api.post(`/api/admin/admin-accounts/${id}/block`);
  return r.data;
};

export const unblockAdminAccount = async (id) => {
  const r = await api.post(`/api/admin/admin-accounts/${id}/unblock`);
  return r.data;
};

/* =========================
 * FOODS (ADMIN + PUBLIC)
 * ========================= */
export const listFoods = async (params) => {
  // Gọi cả admin & public, gộp kết quả (giữ logic cũ)
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

// Tạo món (JSON) – dùng khi có imageUrl hoặc không có ảnh
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

export const createFoodFile = async (formData) => {
  try {
    const r = await api.post("/api/admin/foods", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return r.data;
  } catch (e) {
    if (e?.response?.status === 404) {
      const r2 = await api.post("/api/foods", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return r2.data;
    }
    throw e;
  }
};

// ---- THÊM: cập nhật món bằng multipart (file ảnh) ----
export const updateFoodWithImage = async (id, formData) => {
  try {
    const r = await api.patch(`/api/admin/foods/${id}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return r.data;
  } catch (e) {
    if (e?.response?.status === 404) {
      const r2 = await api.patch(`/api/foods/${id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
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

export const listFoodsAdminOnly = async (params = {}) => {
  const r = await api.get("/api/admin/foods", { params });
  // trả về nguyên vẹn (hoặc normalize nếu bạn muốn)
  return r.data; // { items, total, limit, skip }
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

/* =========================
 * USERS (ADMIN)
 * ========================= */
export const listUsers = (params) =>
  api.get("/api/admin/users", { params }).then((r) => r.data);

export const blockUser = (id) =>
  api.post(`/api/admin/users/${id}/block`).then((r) => r.data);

export const unblockUser = (id) =>
  api.post(`/api/admin/users/${id}/unblock`).then((r) => r.data);

export const updateMyAdminProfile = async ({ nickname }) => {
  if (!nickname || typeof nickname !== "string") {
    throw new Error("Vui lòng nhập nickname hợp lệ");
  }
  try {
    // Phương án 1: RESTful cho admin
    const r = await api.patch("/api/admin/auth/me", { nickname });
    return r.data;
  } catch (e1) {
    if (e1?.response?.status === 404) {
      try {
        // Phương án 2: một số BE đặt /profile
        const r2 = await api.patch("/api/admin/auth/profile", { nickname });
        return r2.data;
      } catch (e2) {
        if (e2?.response?.status === 404) {
          // Phương án 3: dùng endpoint user chung (không đổi quyền phía BE)
          const r3 = await api.patch("/api/user/account", { "profile.nickname": nickname });
          return r3.data;
        }
        throw e2;
      }
    }
    throw e1;
  }
};

/**
 * Đổi mật khẩu cho chính admin đang đăng nhập (lv2 mới bật UI).
 * Body: { currentPassword, newPassword }
 */
export const changeMyAdminPassword = async ({ currentPassword, newPassword }) => {
  if (!currentPassword || !newPassword) {
    throw new Error("Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới");
  }
  try {
    // Phương án 1: route admin chuyên biệt
    const r = await api.post("/api/admin/auth/change-password", {
      currentPassword,
      newPassword,
    });
    return r.data; // { success: true } hoặc { message: ... }
  } catch (e1) {
    if (e1?.response?.status === 404) {
      // Phương án 2: fallback qua user chung (đã có sẵn trong server user)
      const r2 = await api.post("/api/user/change-password", {
        currentPassword,
        newPassword,
      });
      return r2.data;
    }
    throw e1;
  }
};