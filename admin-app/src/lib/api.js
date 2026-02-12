// admin-app/src/lib/api.js
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
      const r2 = await api.patch(`/api/foods/${id}`, {
       status: "rejected",
       // BE yêu cầu 'rejectionReason' khi PATCH
       rejectionReason: String(reason || "").trim(),
     });
      return r2.data;
    }
    throw e;
  }
};

export const getFood = async (id) => {
  // ưu tiên route admin, fallback public
  try {
    const r = await api.get(`/api/admin/foods/${id}`);
    return r.data;
  } catch (e) {
    if (e?.response?.status === 404) {
      const r2 = await api.get(`/api/foods/${id}`);
      return r2.data;
    }
    throw e;
  }
};

export const importFoodsBulk = async ({ file, archive, options = {} }) => {
  const fd = new FormData();
  if (file) fd.append("file", file);
  if (archive) fd.append("archive", archive);
  fd.append("options", JSON.stringify(options));

  const r = await api.post("/api/admin/foods/import", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data; // { success, inserted, updated, failed, errors }
};

export const validateFoodsBulk = async ({ file, archive }) => {
  const fd = new FormData();
  if (file) fd.append("file", file);
  if (archive) fd.append("archive", archive);
  const r = await api.post("/api/admin/foods/import/validate", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data; // { success, count, errors? }
};

/* =========================
 * SUGGEST MENUS (ADMIN)
 * ========================= */

export const createSuggestMenuApi = async (formDataOrJson, isMultipart = false) => {
  if (isMultipart) {
    const r = await api.post("/api/admin/suggest-menus", formDataOrJson, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return r.data?.data ?? r.data;
  } else {
    const r = await api.post("/api/admin/suggest-menus", formDataOrJson);
    return r.data?.data ?? r.data;
  }
};

export const listSuggestMenusAdminOnly = async (params = {}) => {
  const r = await api.get("/api/admin/suggest-menus", { params });
  return r.data?.data ?? r.data; // { items, total, limit, skip }
};

export const getSuggestMenu = async (id) => {
  const r = await api.get(`/api/admin/suggest-menus/${id}`);
  return r.data?.data ?? r.data;
};

export const updateSuggestMenuApi = async (id, formDataOrJson, isMultipart = false) => {
  if (isMultipart) {
    const r = await api.patch(`/api/admin/suggest-menus/${id}`, formDataOrJson, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return r.data?.data ?? r.data;
  } else {
    const r = await api.patch(`/api/admin/suggest-menus/${id}`, formDataOrJson);
    return r.data?.data ?? r.data;
  }
};

export const deleteSuggestMenu = async (id) => {
  const r = await api.delete(`/api/admin/suggest-menus/${id}`);
  return r.data?.data ?? r.data;
};


/* =========================
 * EXERCISES (ADMIN)
 * ========================= */

// Meta cho dropdown (type, muscles, equipments, levels)
export const getExerciseMeta = async () => {
  const r = await api.get("/api/admin/exercises/meta");
  // BE dùng responseOk -> { ok:true, data:{...} }
  return r.data?.data ?? r.data;
};

// Danh sách bài tập (server-side filter + paging)
export const listExercisesAdminOnly = async (params = {}) => {
  const r = await api.get("/api/admin/exercises", { params });
  // BE trả { ok:true, data:{ items, total, limit, skip } }
  return r.data?.data ?? r.data;
};

// Lấy chi tiết 1 bài tập
export const getExercise = async (id) => {
  const r = await api.get(`/api/admin/exercises/${id}`);
  return r.data?.data ?? r.data;
};

// Tạo bài tập
// - formDataOrJson: FormData (nếu có file ảnh) hoặc object JSON
// - isMultipart: true nếu là FormData
export const createExercise = async (formDataOrJson, isMultipart = false) => {
  if (isMultipart) {
    const r = await api.post("/api/admin/exercises", formDataOrJson, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return r.data?.data ?? r.data;
  } else {
    const r = await api.post("/api/admin/exercises", formDataOrJson);
    return r.data?.data ?? r.data;
  }
};

// Cập nhật bài tập (CHỈ ảnh + text; KHÔNG gửi video chung request này)
export const updateExercise = async (id, formDataOrJson, isMultipart = false) => {
  if (isMultipart) {
    const r = await api.patch(`/api/admin/exercises/${id}`, formDataOrJson, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return r.data?.data ?? r.data;
  } else {
    const r = await api.patch(`/api/admin/exercises/${id}`, formDataOrJson);
    return r.data?.data ?? r.data;
  }
};

// Xoá bài tập
export const deleteExercise = async (id) => {
  const r = await api.delete(`/api/admin/exercises/${id}`);
  return r.data?.data ?? r.data; // { ok: true }
};

// 1) createExerciseFile: gọi createExercise ở chế độ multipart
export const createExerciseFile = async (formData) => {
  return createExercise(formData, true);
};

// 2) listMuscleGroups: ưu tiên /meta; fallback /options/muscles; cuối cùng trả []
export const listMuscleGroups = async () => {
  try {
    const meta = await getExerciseMeta(); // BE: { EXERCISE_TYPES, MUSCLE_GROUPS, EQUIPMENTS, LEVELS }
    const arr =
      meta?.MUSCLE_GROUPS || meta?.muscles || meta?.muscleOptions || meta?.data?.muscles || [];
    if (Array.isArray(arr) && arr.length) return arr;
  } catch {}
  try {
    const r = await api.get("/api/admin/exercises/options/muscles");
    return r.data?.items || r.data || [];
  } catch {
    try {
      const r2 = await api.get("/api/exercises/options/muscles");
      return r2.data?.items || r2.data || [];
    } catch {
      return [];
    }
  }
};

// 3) listEquipments: tương tự
export const listEquipments = async () => {
  try {
    const meta = await getExerciseMeta(); // BE: { EXERCISE_TYPES, MUSCLE_GROUPS, EQUIPMENTS, LEVELS }
    const arr =
      meta?.EQUIPMENTS || meta?.equipments || meta?.equipmentOptions || meta?.data?.equipments || [];
    if (Array.isArray(arr) && arr.length) return arr;
  } catch {}
  try {
    const r = await api.get("/api/admin/exercises/options/equipments");
    return r.data?.items || r.data || [];
  } catch {
    try {
      const r2 = await api.get("/api/exercises/options/equipments");
      return r2.data?.items || r2.data || [];
    } catch {
      return [];
    }
  }
};

/* 4) UPLOAD VIDEO – CÁCH A (endpoint riêng, KHÔNG gộp chung create/update)
   FE gọi sau khi tạo/cập nhật thành công nếu có videoFile.
   - id: exerciseId
   - file: File (video/*)
*/
export const uploadExerciseVideoApi = async (id, file) => {
  const fd = new FormData();
  fd.append("video", file);
  const r = await api.post(`/api/admin/exercises/${id}/video`, fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data?.videoUrl || r.data;
};
export const removeExerciseVideoApi = async (id) => {
  const r = await api.patch(`/api/admin/exercises/${id}`, { __removeVideo: true });
  return r.data?.data ?? r.data;
};

/* =========================
 * SUGGEST PLANS (ADMIN)
 * ========================= */

export const createSuggestPlanApi = async (formDataOrJson, isMultipart = false) => {
  if (isMultipart) {
    const r = await api.post("/api/admin/suggest-plans", formDataOrJson, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return r.data?.data ?? r.data;
  } else {
    const r = await api.post("/api/admin/suggest-plans", formDataOrJson);
    return r.data?.data ?? r.data;
  }
};

export const listSuggestPlansAdminOnly = async (params = {}) => {
  const r = await api.get("/api/admin/suggest-plans", { params });
  return r.data?.data ?? r.data; // { items, total, limit, skip }
};

export const getSuggestPlan = async (id) => {
  const r = await api.get(`/api/admin/suggest-plans/${id}`);
  return r.data?.data ?? r.data;
};

export const updateSuggestPlanApi = async (id, formDataOrJson, isMultipart = false) => {
  if (isMultipart) {
    const r = await api.patch(`/api/admin/suggest-plans/${id}`, formDataOrJson, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return r.data?.data ?? r.data;
  } else {
    const r = await api.patch(`/api/admin/suggest-plans/${id}`, formDataOrJson);
    return r.data?.data ?? r.data;
  }
};

export const deleteSuggestPlan = async (id) => {
  const r = await api.delete(`/api/admin/suggest-plans/${id}`);
  return r.data?.data ?? r.data;
};

/* =========================
 * USERS (ADMIN)
 * ========================= */
export const listUsers = (params) =>
  api.get("/api/admin/users", { params }).then((r) => r.data);

export async function blockUser(id, reasonOrBody) {
  const body = typeof reasonOrBody === "string" ? { reason: reasonOrBody } : (reasonOrBody || {});
  return api.post(`/api/admin/users/${id}/block`, body);
}

export function unblockUser(id) {
  return api.post(`/api/admin/users/${id}/unblock`);
}

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


// =========================
// AUDIT LOGS (ADMIN)
// =========================
export const listAuditLogs = async (params = {}) => {
  const r = await api.get("/api/admin/audit-logs", { params });
  return r.data?.data ?? r.data;
};

export const deleteAuditLog = async (id) => {
  const r = await api.delete(`/api/admin/audit-logs/${id}`);
  return r.data?.data ?? r.data;
};

export const deleteManyAuditLogs = async (ids = []) => {
  const r = await api.delete("/api/admin/audit-logs", { data: { ids } });
  return r.data?.data ?? r.data;
};

// =========================
// CONTACT MESSAGES (ADMIN)
// =========================

export const listContactMessagesAdmin = async (params = {}) => {
  const r = await api.get("/api/admin/contact-messages", { params });
  return r.data?.data ?? r.data; // { items, total, limit, skip }
};

export const getContactMessageAdmin = async (id) => {
  const r = await api.get(`/api/admin/contact-messages/${id}`);
  return r.data?.data ?? r.data;
};

export const updateContactMessageStatus = async (id, data) => {
  let body;

  if (typeof data === "string") {
    body = { status: data };
  } else if (data && typeof data === "object") {
    body = data;
  } else {
    body = {};
  }

  const r = await api.patch(`/api/admin/contact-messages/${id}`, body);
  return r.data?.data ?? r.data;
};

export const deleteContactMessageAdmin = async (id) => {
  const r = await api.delete(`/api/admin/contact-messages/${id}`);
  return r.data?.data ?? r.data;
};

/* =========================
 * FAQ (ADMIN)
 * ========================= */

// Dùng normalizeListPayload để luôn nhận về { items, total, limit, skip }
export const listFaqCategoriesAdmin = async (params = {}) => {
  const r = await api.get("/api/admin/faq/categories", { params });
  const raw = r.data?.data ?? r.data;
  const { items, total, limit, skip } = normalizeListPayload(raw);
  return { items, total, limit, skip };
};

export const createFaqCategoryAdmin = async (body) => {
  const r = await api.post("/api/admin/faq/categories", body);
  // responseOk -> { ok:true, data: doc } hoặc trả thẳng doc
  return r.data?.data ?? r.data;
};

export const updateFaqCategoryAdmin = async (id, body) => {
  const r = await api.patch(`/api/admin/faq/categories/${id}`, body);
  return r.data?.data ?? r.data;
};

export const deleteFaqCategoryAdmin = async (id) => {
  const r = await api.delete(`/api/admin/faq/categories/${id}`);
  return r.data?.data ?? r.data;
};

export const listFaqQuestionsAdmin = async (params = {}) => {
  const r = await api.get("/api/admin/faq/questions", { params });
  const raw = r.data?.data ?? r.data; // support cả responseOk({ data }) lẫn trả thẳng
  const { items, total, limit, skip } = normalizeListPayload(raw);
  return { items, total, limit, skip };
};


export const createFaqQuestionAdmin = async (body) => {
  const r = await api.post("/api/admin/faq/questions", body);
  return r.data?.data ?? r.data;
};

export const updateFaqQuestionAdmin = async (id, body) => {
  const r = await api.patch(`/api/admin/faq/questions/${id}`, body);
  return r.data?.data ?? r.data;
};

export const deleteFaqQuestionAdmin = async (id) => {
  const r = await api.delete(`/api/admin/faq/questions/${id}`);
  return r.data?.data ?? r.data;
};

// =========================
// REPORTS (ADMIN)
// =========================
export const listConnectReportsAdmin = async (params = {}) => {
  const r = await api.get("/api/match/reports/admin", { params });
  return r.data?.data ?? r.data;
};

export const updateConnectReportAdmin = async (id, body = {}) => {
  const r = await api.patch(`/api/match/reports/${id}/admin`, body);
  return r.data?.data ?? r.data;
};

export const deleteConnectReportAdmin = async (id) => {
  const r = await api.delete(`/api/match/reports/${id}/admin`);
  return r.data?.data ?? r.data;
};

export const deleteManyConnectReportsAdmin = async (ids = []) => {
  const r = await api.delete("/api/match/reports/admin", { data: { ids } });
  return r.data?.data ?? r.data;
};


// =========================
// MATCH ROOMS (ADMIN) - DUO / TEAM
// =========================
export const listMatchRoomsAdmin = async (params = {}) => {
  const r = await api.get("/api/admin/match-rooms", { params });
  return r.data?.data ?? r.data; // { items,total,limit,skip }
};

export const getMatchRoomAdmin = async (id) => {
  const r = await api.get(`/api/admin/match-rooms/${id}`);
  return r.data?.data ?? r.data;
};

export const closeMatchRoomAdmin = async (id, reason = "") => {
  const r = await api.post(`/api/admin/match-rooms/${id}/close`, { reason });
  return r.data?.data ?? r.data;
};

export const deleteMatchRoomAdmin = async (id) => {
  const r = await api.delete(`/api/admin/match-rooms/${id}`);
  return r.data?.data ?? r.data;
};

export const deleteManyMatchRoomsAdmin = async (ids = []) => {
  const r = await api.delete(`/api/admin/match-rooms`, { data: { ids } });
  return r.data?.data ?? r.data;
};

export const kickMatchRoomMemberAdmin = async (roomId, userId, reason = "") => {
  const r = await api.post(`/api/admin/match-rooms/${roomId}/kick`, { userId, reason });
  return r.data?.data ?? r.data;
};

export const transferMatchRoomOwnerAdmin = async (roomId, newOwnerId) => {
  const r = await api.post(`/api/admin/match-rooms/${roomId}/transfer-owner`, { newOwnerId });
  return r.data?.data ?? r.data;
};

/* =========================
 * STATS (ADMIN)
 * ========================= */
export const getStatsUsersAdmin = async (params = {}) => {
  const r = await api.get("/api/admin/stats/users", { params });
  return r.data?.data ?? r.data;
};

export const getStatsNutritionAdmin = async (params = {}) => {
  const r = await api.get("/api/admin/stats/nutrition", { params });
  return r.data?.data ?? r.data;
};

export const getStatsWorkoutsAdmin = async (params = {}) => {
  const r = await api.get("/api/admin/stats/workouts", { params });
  return r.data?.data ?? r.data;
};

export const getConnectStats = async (params = {}) => {
  const r = await api.get("/api/admin/stats/connect", { params });
  return r.data?.data ?? r.data;
};

export const getStatsPremiumAdmin = async (params = {}) => {
  const r = await api.get("/api/admin/stats/premium", { params });
  return r.data?.data ?? r.data;
};

/* =========================
 * PREMIUM (ADMIN)
 * ========================= */
export const listPremiumUsersAdmin = async (params = {}) => {
  const r = await api.get("/api/admin/premium/users", { params });
  // BE responseOk => { success:true, items,total,limit,skip,... }
  return r.data?.data ?? r.data;
};

export const listPremiumTransactionsAdmin = async (userId, params = {}) => {
  const r = await api.get(`/api/admin/premium/users/${userId}/transactions`, { params });
  return r.data?.data ?? r.data;
};

export const revokePremiumAdmin = async (userId, reason = "") => {
  const r = await api.post(`/api/admin/premium/users/${userId}/revoke`, { reason });
  return r.data?.data ?? r.data;
};

// =========================
// PREMIUM PLANS (ADMIN)
// =========================
const unwrap = (res) => res?.data?.data ?? res?.data ?? res;

export async function listPremiumPlansAdmin(params = {}) {
  const res = await api.get("/api/admin/premium/plans", { params });
  return unwrap(res);
}

export async function createPremiumPlanAdmin(payload) {
  const res = await api.post("/api/admin/premium/plans", payload);
  return unwrap(res);
}

export async function updatePremiumPlanAdmin(id, payload) {
  const res = await api.patch(`/api/admin/premium/plans/${id}`, payload);
  return unwrap(res);
}

export async function deletePremiumPlanAdmin(id) {
  const res = await api.delete(`/api/admin/premium/plans/${id}`);
  return unwrap(res);
}