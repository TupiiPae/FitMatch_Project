// user-app/src/api/suggestMenus.js
import api from "../lib/api";

export async function listSuggestMenus(params = {}) {
  const res = await api.get("/suggest-menus", { params });
  return res.data;
}

export async function toggleSaveSuggestMenu(id) {
  const res = await api.post(`/suggest-menus/${id}/save`);
  return res.data;
}
