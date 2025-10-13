// src/api/account.js
import api from "../lib/api"; // bạn đã có sẵn axios instance

// Lấy user hiện tại (kèm profile, createdAt)
export const getMe = async () => {
  const { data } = await api.get("/users/me");   // BE: trả { user }
  return data.user;
};

// Cập nhật profile (partial)
export const updateProfile = async (payload) => {
  // payload dạng: { profile: { ...fields } }
  const { data } = await api.patch("/users/me/profile", payload);
  return data.user;
};
