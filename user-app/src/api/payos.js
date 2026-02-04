import api from "../lib/api";

const monthsToPlanCode = (months) => {
  const m = Number(months);
  if (m === 1) return "premium_1m";
  if (m === 3) return "premium_3m";
  if (m === 6) return "premium_6m";
  if (m === 12) return "premium_12m";
  return null;
};

export async function createPayosLinkForMonths(months) {
  const planCode = monthsToPlanCode(months);
  if (!planCode) throw new Error("Gói không hợp lệ");

  const { data } = await api.post("/payos/create-link", { planCode });
  return data; // { ok, orderCode, checkoutUrl, qrCode }
}

export async function getPayosStatus(orderCode) {
  if (!orderCode) throw new Error("Thiếu orderCode");
  const { data } = await api.get(`/payos/status/${orderCode}`);
  return data; // { ok, local, remote }
}
