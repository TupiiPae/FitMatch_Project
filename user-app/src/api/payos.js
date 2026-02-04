// user-app/src/api/payos.js
import api from "../lib/api";

export async function createPayosLinkForPlanCode(planCode) {
  const c = String(planCode || "").trim();
  if (!c) throw new Error("Thiếu planCode");

  const { data } = await api.post("/payos/create-link", { planCode: c });
  return data; // { ok, orderCode, checkoutUrl, qrCode, plan? }
}

export async function getPayosStatus(orderCode) {
  if (!orderCode) throw new Error("Thiếu orderCode");
  const { data } = await api.get(`/payos/status/${orderCode}`);
  return data;
}
