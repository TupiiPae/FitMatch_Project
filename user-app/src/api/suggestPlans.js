// user-app/src/api/suggestPlans.js
import api from "../lib/api";

const BASE = "/user/suggest-plans";

function pickPayload(res) {
  const data = res?.data?.data || res?.data || res || {};
  return {
    items: data.items || [],
    total: data.total ?? 0,
    hasMore: !!data.hasMore,
  };
}

/** List tất cả lịch tập gợi ý (cho trang /tap-luyen/goi-y) */
export async function listSuggestPlans(params = {}) {
  const p = {
    q: "",
    category: "",
    level: "",
    goal: "",
    limit: 50,
    skip: 0,
    ...params,
  };
  if (typeof p.q === "string") p.q = p.q.trim();
  const res = await api.get(BASE, { params: p });
  return pickPayload(res);
}

/** List lịch tập gợi ý đã lưu (cho mục 'Lịch tập gợi ý đã lưu') */
export async function listSavedSuggestPlans(params = {}) {
  const p = { ...params, scope: "saved" };
  const res = await api.get(BASE, { params: p });
  return pickPayload(res);
}

export async function getSuggestPlanDetail(id) {
  const res = await api.get(`${BASE}/${id}`);
  return res?.data?.data || res?.data || {};
}

export async function toggleSaveSuggestPlan(id) {
  const res = await api.post(`${BASE}/${id}/save`);
  return res?.data?.data || res?.data || {};
}
