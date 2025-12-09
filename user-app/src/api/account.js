// src/api/account.js
import api from "../lib/api";

// Helper bóc nhiều kiểu response khác nhau
function unwrapUser(res) {
  const data = res?.data;
  if (!data) return null;

  // Trường hợp cũ: { user: {...} }
  if (data.user) return data.user;

  // Trường hợp dùng responseOk: { ok: true, data: { user: {...} } }
  if (data.data?.user) return data.data.user;

  // Nếu BE trả thẳng user luôn: res.data = {...}
  if (!data.ok && !data.data && !data.user) return data;

  return null;
}

/**
 * GET /api/user/me
 * BE có thể trả:
 * - { user: {...} }  HOẶC
 * - { ok: true, data: { user: {...} } }
 */
export async function getMe() {
  // LƯU Ý: KHÔNG thêm /api ở đây vì baseURL đã là .../api rồi
  const res = await api.get("/user/me");
  return unwrapUser(res);
}

export async function updateAccount(payload) {
  const res = await api.patch("/user/account", payload);
  // thường BE trả { user }, nhưng nếu chỉ cần kết quả mới thì:
  return res.data?.user ?? unwrapUser(res) ?? null;
}

export async function updateProfile(profileObj = {}) {
  const flat = {};
  Object.entries(profileObj).forEach(([k, v]) => {
    flat[`profile.${k}`] = v;
  });
  const res = await api.patch("/user/account", flat);
  return res.data?.user ?? unwrapUser(res) ?? null;
}

export async function deleteAccount() {
  const res = await api.delete("/user");
  return res.data ?? { success: true };
}

export async function changePassword(payload) {
  const res = await api.post("/user/change-password", payload);
  return res.data;
}

export async function uploadAvatar(file) {
  const form = new FormData();
  form.append("avatar", file);
  const res = await api.post("/user/avatar", form, {
    headers: {},
  });
  return res.data;
}

export async function patchOnboarding(fields) {
  const res = await api.patch("/user/onboarding", fields);
  return res.data;
}

export async function finalizeOnboarding() {
  const res = await api.post("/user/onboarding/finalize");
  return res.data;
}
