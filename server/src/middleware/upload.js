// server/src/middleware/upload.js
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ===== ESM __dirname =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// __dirname = .../server/src/middleware
// PROJECT_ROOT = .../server
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

// ===== Gốc uploads CHUẨN: .../server/uploads =====
export const UPLOAD_ROOT = path.join(PROJECT_ROOT, "uploads");
export const AVATAR_DIR  = path.join(UPLOAD_ROOT, "avatars");
export const FOOD_DIR    = path.join(UPLOAD_ROOT, "foods");

// Tạo thư mục cần thiết (chỉ 2 thư mục con này)
fs.mkdirSync(AVATAR_DIR, { recursive: true });
fs.mkdirSync(FOOD_DIR,   { recursive: true });

// ===== Multer storages =====
// Dùng memoryStorage: controller sẽ nén/cắt & lưu .webp vào đúng thư mục
const memory = multer.memoryStorage();

// Avatar (field "avatar", ảnh <= 2MB)
export const uploadAvatarSingle = multer({
  storage: memory,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if ((file.mimetype || "").startsWith("image/")) return cb(null, true);
    cb(new Error("Chỉ chấp nhận file ảnh cho avatar"));
  },
}).single("avatar");

// Ảnh món ăn (field "image", ảnh <= 5MB)
export const uploadFoodSingle = multer({
  storage: memory,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if ((file.mimetype || "").startsWith("image/")) return cb(null, true);
    cb(new Error("Chỉ chấp nhận file ảnh cho món ăn"));
  },
}).single("image");

// Import (CSV/XLSX và ZIP) – tối đa 25MB
export const uploadImportAny = multer({
  storage: memory,
  limits: { fileSize: 25 * 1024 * 1024 },
}).fields([
  { name: "file", maxCount: 1 },    // CSV/XLSX
  { name: "archive", maxCount: 1 }, // ZIP chứa foods.csv + images/*
]);
