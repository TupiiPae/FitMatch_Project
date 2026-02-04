// user-app/src/api/premium.js
import api from "../lib/api";

export async function getMyPremium() {
  const r = await api.get("/premium/me");
  return r.data?.data ?? r.data;
}

export async function subscribePremium(months) {
  const r = await api.post("/premium/subscribe", { months });
  return r.data?.data ?? r.data;
}

export async function cancelPremium() {
  const r = await api.post("/premium/cancel");
  return r.data?.data ?? r.data;
}
