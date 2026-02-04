// user-app/src/api/premium.js
import api from "../lib/api";

export async function listPremiumPlans() {
  const r = await api.get("/premium/plans");
  return r.data?.data ?? r.data; // { items: [...] }
}

export async function getMyPremium() {
  const r = await api.get("/premium/me");
  return r.data?.data ?? r.data; // { premium, plan? }
}

// giữ tương thích: hỗ trợ {months} hoặc {planCode}
export async function subscribePremium({ months, planCode } = {}) {
  const body = {};
  if (planCode) body.planCode = planCode;
  else if (months != null) body.months = months;

  const r = await api.post("/premium/subscribe", body);
  return r.data?.data ?? r.data;
}

export async function cancelPremium() {
  const r = await api.post("/premium/cancel");
  return r.data?.data ?? r.data;
}
