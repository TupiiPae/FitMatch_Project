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
 * (Tuỳ chọn) Helper nếu bạn muốn truyền gọn dạng object profile
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
