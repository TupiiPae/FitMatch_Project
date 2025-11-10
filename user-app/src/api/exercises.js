import api from "../lib/api";

export async function getExerciseMeta() {
  const { data } = await api.get("/api/exercises/meta");
  return data; // { EXERCISE_TYPES, MUSCLE_GROUPS, EQUIPMENTS, LEVELS }
}

export async function listExercises(params) {
  const { data } = await api.get("/api/exercises", { params });
  return data; // { items, total, limit, skip, hasMore }
}

export async function getExercise(id) {
  const { data } = await api.get(`/api/exercises/${id}`);
  return data;
}
