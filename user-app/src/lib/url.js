// Ưu tiên VITE_API_BASE (origin thuần), nếu không có thì tách từ VITE_API_URL
const RAW = (import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_URL || "http://localhost:5000/api").trim();
const SERVER_ORIGIN = RAW.replace(/\/+$/,"").replace(/\/api$/,""); // bỏ đuôi /api nếu có

/**
 * Chuyển đổi URL upload thành absolute URL
 * - Nếu là Cloudinary URL (đã absolute) -> trả về nguyên vẹn
 * - Nếu là local path (/uploads/...) -> thêm SERVER_ORIGIN
 * - Nếu đã là absolute URL -> trả về nguyên vẹn
 */
export const absUploadUrl = (u) => {
  if (!u) return "";
  // Nếu đã là absolute URL (http/https) hoặc Cloudinary URL -> trả về nguyên
  if (/^https?:\/\//i.test(u)) return u;
  // Nếu là local path -> thêm SERVER_ORIGIN
  return SERVER_ORIGIN + u;
};
