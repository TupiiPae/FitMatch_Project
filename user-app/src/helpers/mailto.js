// user-app/src/helpers/mailto.js
export function buildMailto({ to, subject = "", body = "" }) {
  const params = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${to}${params.length ? "?" + params.join("&") : ""}`;
}
