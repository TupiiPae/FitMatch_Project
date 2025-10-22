import api from "../lib/api";

// Foods
export const searchFoods = (params) => api.get("/foods", { params }); // q, scope, onlyMine, favorites, limit, skip
export const toggleFavoriteFood = (foodId) => api.post(`/foods/${foodId}/favorite`);
export const viewFood = (foodId) => api.post(`/foods/${foodId}/view`);
export const getFood = (foodId) => api.get(`/foods/${foodId}`);
export const createFood = (payload) => api.post("/foods", payload); // status=pending
export const updateFood = (id, payload) => api.patch(`/foods/${id}`, payload);
export const deleteFood = (id) => api.delete(`/foods/${id}`);

// Nutrition log
export const addLog = (payload) => api.post("/nutrition/logs", payload); // { foodId, date, hour, quantity, massG }
