// src/api/account.js
import api from "../lib/api";

/**
 * GET /api/user/me
 * - Trả về object user (kèm profile, createdAt, ...)
 * - BE response: { user: {...} }
 */
export async function getMe() {
  const res = await api.get("/api/user/me");
  return res.data?.user ?? null;
}

/**
 * PATCH /api/user/account
 * - Cập nhật các field root/profile theo đúng tên field BE.
 * - Ví dụ payload:
 *   { "email": "new@mail.com" }
 *   { "profile.nickname": "Tupae" }
 *   { "profile.calorieTarget": 2200 }
 *   {
 *     "profile.macroProtein": 20,
 *     "profile.macroCarb": 50,
 *     "profile.macroFat": 30
 *   }
 * - BE response: { success: true, user: {...} }
 */
export async function updateAccount(payload) {
  const res = await api.patch("/api/user/account", payload);
  return res.data?.user ?? null;
}

/**
 * (Tuỳ chọn) Helper truyền gọn object profile
 * rồi tự map thành "profile.xxx" theo BE.
 * Dùng: updateProfile({ nickname: "A", heightCm: 175 })
 */
export async function updateProfile(profileObj = {}) {
  const flat = {};
  Object.entries(profileObj).forEach(([k, v]) => {
    flat[`profile.${k}`] = v;
  });
  const res = await api.patch("/api/user/account", flat);
  return res.data?.user ?? null;
}

/**
 * DELETE /api/user
 * - Xoá toàn bộ dữ liệu & tài khoản
 * - BE response: { success: true, message, deleted? }
 */
export async function deleteAccount() {
  const res = await api.delete("/api/user");
  return res.data ?? { success: true };
}

/* ---------- (tuỳ chọn) các helper hay dùng trong Account ---------- */

/**
 * POST /api/user/change-password
 * payload: { currentPassword, newPassword }
 */
export async function changePassword(payload) {
  const res = await api.post("/api/user/change-password", payload);
  return res.data;
}

/**
 * POST /api/user/avatar (multipart)
 * - field name: "avatar" (multer single("avatar"))
 * - Trả về { success, avatarUrl, user }
 */
export async function uploadAvatar(file) {
  const form = new FormData();
  form.append("avatar", file);
  const res = await api.post("/api/user/avatar", form, {
    headers: { /* để axios tự set multipart boundary */ },
  });
  return res.data;
}

/**
 * PATCH /api/user/onboarding
 * - Map thẳng các key BE (ví dụ "profile.heightCm", "profile.goal", ...)
 */
export async function patchOnboarding(fields) {
  const res = await api.patch("/api/user/onboarding", fields);
  return res.data;
}

/**
 * POST /api/user/onboarding/finalize
 */
export async function finalizeOnboarding() {
  const res = await api.post("/api/user/onboarding/finalize");
  return res.data;
}
