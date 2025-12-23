import { io } from "socket.io-client";

const raw = import.meta.env.VITE_API_URL || "http://localhost:5000";
const trimmed = raw.replace(/\/+$/, "");
const ORIGIN = trimmed.endsWith("/api") ? trimmed.slice(0, -4) : trimmed;

let socket = null;
let lastToken = "";

const cleanToken = (t) => String(t || "").replace(/^Bearer\s+/i, "").trim();

export function getSocket(token) {
  const t = cleanToken(token || localStorage.getItem("token") || "");

  // nếu token không đổi thì reuse
  if (socket && t === lastToken) return socket;

  // đổi token -> disconnect socket cũ
  if (socket) {
    try { socket.disconnect(); } catch {}
    socket = null;
  }

  lastToken = t;

  // token rỗng -> tạo socket nhưng KHÔNG connect
  socket = io(ORIGIN, {
    transports: ["websocket", "polling"],
    auth: { token: t },
    autoConnect: !!t,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 400,
    reconnectionDelayMax: 4000,
  });

  // nếu có token thì connect ngay
  if (t) {
    try { socket.connect(); } catch {}
  }

  return socket;
}
