// Ưu tiên VITE_API_BASE (origin thuần), nếu không có thì tách từ VITE_API_URL
const RAW = (import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || "http://localhost:5000/api").trim();
const SERVER_ORIGIN = RAW.replace(/\/+$/,"").replace(/\/api$/,""); // bỏ đuôi /api nếu có

export const absUploadUrl = (u) => (u && !/^https?:\/\//i.test(u) ? SERVER_ORIGIN + u : (u || ""));
