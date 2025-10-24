// src/api/foods.js
import api from "../lib/api";

// ===== Foods =====
// q, scope ("recent"|"all"), onlyMine, favorites, limit, skip
export const searchFoods = (params) => api.get("/foods", { params });

export const getFood = (foodId) => api.get(`/foods/${foodId}`);
export const viewFood = (foodId) => api.post(`/foods/${foodId}/view`);
export const toggleFavoriteFood = (foodId) => api.post(`/foods/${foodId}/favorite`);

// Tạo món (JSON) – dùng khi không có ảnh
export const createFood = (payload) => api.post("/foods", payload);

// Tạo món (multipart + 1 ảnh) – dùng khi có thumbnail
// formData gồm: image (File) + các field (name, massG, unit, kcal, ...)
export const createFoodWithImage = (formData) => api.post("/foods", formData);

// Cập nhật (JSON)
export const updateFood = (id, payload) => api.patch(`/foods/${id}`, payload);

// Cập nhật kèm ảnh (multipart) – tuỳ nhu cầu khi chỉnh sửa
export const updateFoodWithImage = (id, formData) =>
  api.patch(`/foods/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const deleteFood = (id) => api.delete(`/foods/${id}`);

// ===== Nutrition Log =====
// { foodId, date(YYYY-MM-DD), hour(6..23), quantity, massG? }
export const addLog = (payload) => api.post("/nutrition/logs", payload);
