import { io } from "socket.io-client";

const raw = import.meta.env.VITE_API_URL || "http://localhost:5000";
const trimmed = raw.replace(/\/+$/, "");
const ORIGIN = trimmed.endsWith("/api") ? trimmed.slice(0, -4) : trimmed;

let socket = null;
let lastToken = "";

// lưu token dạng "jwt" (không Bearer)
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

  socket = io(ORIGIN, {
    transports: ["websocket", "polling"],
    auth: { token: t ? `Bearer ${t}` : "" },
    withCredentials: true,
    autoConnect: !!t,

    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 400,
    reconnectionDelayMax: 4000,
  });

  // ===== DEBUG bắt lỗi thật sự =====
  socket.on("connect", () => {
    console.log("[socket] connected:", socket.id, "origin=", ORIGIN);
  });

  socket.on("connect_error", (err) => {
    console.log("[socket] connect_error:", err?.message, err);
  });

  socket.on("disconnect", (reason) => {
    console.log("[socket] disconnected:", reason);
  });

  return socket;
}
