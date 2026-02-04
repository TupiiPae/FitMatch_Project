// server/src/utils/payos.js
import crypto from "crypto";

const PAYOS_API_BASE = (process.env.PAYOS_API_BASE || "https://api-merchant.payos.vn")
  .replace(/\/+$/, "");

export function payosHeaders() {
  const clientId = process.env.PAYOS_CLIENT_ID;
  const apiKey = process.env.PAYOS_API_KEY;
  if (!clientId || !apiKey) {
    throw new Error("Missing PAYOS_CLIENT_ID or PAYOS_API_KEY");
  }
  return {
    "Content-Type": "application/json",
    "x-client-id": clientId,
    "x-api-key": apiKey,
  };
}

// signature tạo link: amount, cancelUrl, description, orderCode, returnUrl
// format cố định theo docs:
// amount=$amount&cancelUrl=$cancelUrl&description=$description&orderCode=$orderCode&returnUrl=$returnUrl
export function signCreatePaymentLink({ amount, cancelUrl, description, orderCode, returnUrl }) {
  const key = process.env.PAYOS_CHECKSUM_KEY;
  if (!key) throw new Error("Missing PAYOS_CHECKSUM_KEY");

  const data =
    `amount=${amount}` +
    `&cancelUrl=${cancelUrl}` +
    `&description=${description}` +
    `&orderCode=${orderCode}` +
    `&returnUrl=${returnUrl}`;

  return crypto.createHmac("sha256", key).update(data).digest("hex");
}

// signature webhook: canonicalize keys theo alphabet
// để chắc tay khi có object/array, normalize bằng JSON stringify theo key đã sort
export function signObjectAlphabetical(obj) {
  const key = process.env.PAYOS_CHECKSUM_KEY;
  if (!key) throw new Error("Missing PAYOS_CHECKSUM_KEY");

  const sortObj = (o) => {
    if (!o || typeof o !== "object" || Array.isArray(o)) return o;
    const out = {};
    Object.keys(o)
      .sort((a, b) => a.localeCompare(b))
      .forEach((k) => {
        const v = o[k];
        if (Array.isArray(v)) out[k] = v.map((x) => (typeof x === "object" && x ? sortObj(x) : x));
        else if (v && typeof v === "object") out[k] = sortObj(v);
        else out[k] = v;
      });
    return out;
  };

  const normalize = (v) => {
    if (v === null || v === undefined) return "";
    if (Array.isArray(v)) return JSON.stringify(v.map((x) => (typeof x === "object" && x ? sortObj(x) : x)));
    if (typeof v === "object") return JSON.stringify(sortObj(v));
    return String(v);
  };

  const keys = Object.keys(obj || {}).sort((a, b) => a.localeCompare(b));
  const data = keys.map((k) => `${k}=${normalize(obj[k])}`).join("&");

  return crypto.createHmac("sha256", key).update(data).digest("hex");
}

export async function payosPost(path, body) {
  const url = `${PAYOS_API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: payosHeaders(),
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = json?.desc || json?.message || `PayOS error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}

export async function payosGet(path) {
  const url = `${PAYOS_API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, { method: "GET", headers: payosHeaders() });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = json?.desc || json?.message || `PayOS error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json;
}
