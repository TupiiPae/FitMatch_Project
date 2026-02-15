export const PREMIUM_UPGRADE_PATH =
  import.meta.env.VITE_PREMIUM_UPGRADE_PATH || "/premium";

export function isPremiumUser(raw) {
  const u = raw?.user ?? raw ?? {};
  const p = u?.premium ?? u?.premiumStatus ?? u?.subscription ?? {};

  if (typeof u?.isPremium === "boolean") return u.isPremium;
  if (typeof p === "boolean") return p;
  if (typeof p?.isActive === "boolean") return p.isActive;
  if (typeof p?.active === "boolean") return p.active;

  const status = String(p?.status || u?.premiumStatus || "").toLowerCase();
  if (["active", "premium", "paid"].includes(status)) return true;

  const until =
    p?.until ||
    p?.expiresAt ||
    u?.premiumUntil ||
    u?.premiumExpiresAt ||
    u?.premiumExpireAt;

  if (until) {
    const t = new Date(until).getTime();
    if (Number.isFinite(t)) return t > Date.now();
  }

  const tier = String(p?.tier || p?.plan || u?.tier || "").toLowerCase();
  if (tier.includes("premium")) return true;

  return false;
}

export function isPremiumGateError(err) {
  const st = err?.response?.status;
  const data = err?.response?.data || {};
  const code = String(
    data?.code ||
      data?.errorCode ||
      data?.data?.code ||
      data?.data?.errorCode ||
      ""
  ).toUpperCase();

  const msg = String(data?.message || data?.error || "").toLowerCase();

  if (st === 402) return true;
  if (st === 403 && ["PREMIUM_REQUIRED", "PREMIUM_ONLY", "UPGRADE_REQUIRED"].includes(code))
    return true;

  if (["PREMIUM_REQUIRED", "PREMIUM_ONLY", "UPGRADE_REQUIRED"].includes(code))
    return true;

  if (msg.includes("premium") || msg.includes("nâng cấp") || msg.includes("upgrade"))
    return true;

  return false;
}

export function extractGateMessage(err, fallback) {
  const data = err?.response?.data || {};
  const msg =
    data?.message ||
    data?.error ||
    data?.data?.message ||
    data?.data?.error ||
    "";

  const s = String(msg || "").trim();
  if (s) return s;

  return (
    fallback ||
    "Tính năng này yêu cầu nâng cấp Premium để tiếp tục sử dụng."
  );
}

export function extractApiMessage(err, fallback) {
  const data = err?.response?.data || {};
  const msg = data?.message || data?.error || data?.data?.message || "";
  return String(msg || fallback || "Có lỗi xảy ra. Vui lòng thử lại.").trim();
}
