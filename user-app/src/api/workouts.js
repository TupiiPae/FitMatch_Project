import api from "../lib/api";

export function listPlans(params = {}) {
  return api.get("/api/workouts", { params });
}
export function getPlan(id) {
  return api.get(`/api/workouts/${id}`);
}
export function createPlan(payload) {
  return api.post("/api/workouts", payload);
}
export function updatePlan(id, payload) {
  return api.patch(`/api/workouts/${id}`, payload);
}
export function deletePlan(id) {
  return api.delete(`/api/workouts/${id}`);
}
export function toggleSavePlan(id) {
  return api.post(`/api/workouts/${id}/save`);
}
