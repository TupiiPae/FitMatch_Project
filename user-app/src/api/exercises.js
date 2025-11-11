// user-app/src/api/exercises.js
import api from "../lib/api";

/** Meta: types, muscles, equipments, levels */
export async function getExerciseMeta() {
  const { data } = await api.get("/exercises/meta");
  return data; // { EXERCISE_TYPES, MUSCLE_GROUPS, EQUIPMENTS, LEVELS }
}

/** Danh sách bài tập (public) */
export async function listExercises(params = {}) {
  const p = { ...params };
  // Hỗ trợ truyền mảng -> "A,B"
  if (Array.isArray(p.types)) p.types = p.types.join(",");
  if (Array.isArray(p.type))  p.type  = p.type.join(","); // fallback nếu BE dùng 'type'
  if (typeof p.q === "string") p.q = p.q.trim();
  if (p.limit == null) p.limit = 50;

  const { data } = await api.get("/exercises", { params: p });
  return data; // { items, total, limit, skip, hasMore } hoặc mảng items
}

/** Chi tiết một bài tập */
export async function getExercise(id) {
  const { data } = await api.get(`/exercises/${id}`);
  return data;
}
