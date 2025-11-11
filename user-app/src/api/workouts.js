// user-app/src/api/workouts.js
import api from "../lib/api";

const BASE = "/user/workouts";

/** Lịch tập của tôi */
export async function listMyWorkouts(params = {}) {
  const p = { scope: "mine", limit: 50, skip: 0, q: "", ...params };
  if (typeof p.q === "string") p.q = p.q.trim();
  const { data } = await api.get(BASE, { params: p });
  const payload = data?.data || data || {};
  return {
    items: payload.items || [],
    hasMore: !!payload.hasMore,
    total: payload.total ?? 0,
  };
}

/** Lịch tập gợi ý đã lưu */
export async function listSavedWorkouts(params = {}) {
  const p = { scope: "saved", limit: 50, skip: 0, q: "", ...params };
  if (typeof p.q === "string") p.q = p.q.trim();
  const { data } = await api.get(BASE, { params: p });
  const payload = data?.data || data || {};
  return {
    items: payload.items || [],
    hasMore: !!payload.hasMore,
    total: payload.total ?? 0,
  };
}

export const getPlan       = (id)          => api.get(`${BASE}/${id}`);
export const createPlan    = (payload)     => api.post(BASE, payload);
export const updatePlan    = (id, payload) => api.patch(`${BASE}/${id}`, payload);
export const deletePlan    = (id)          => api.delete(`${BASE}/${id}`);
export const toggleSavePlan= (id)          => api.post(`${BASE}/${id}/save`);
