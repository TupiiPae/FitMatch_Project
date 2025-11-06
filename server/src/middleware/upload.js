import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ===== ESM __dirname =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// PROJECT_ROOT = .../server
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

// ===== Gốc uploads =====
export const UPLOAD_ROOT      = path.join(PROJECT_ROOT, "uploads");
export const AVATAR_DIR       = path.join(UPLOAD_ROOT, "avatars");
export const FOOD_DIR         = path.join(UPLOAD_ROOT, "foods");

// ===== NEW: Exercises dirs =====
export const EXERCISE_IMG_DIR   = path.join(UPLOAD_ROOT, "exercises");
export const EXERCISE_VID_DIR   = path.join(UPLOAD_ROOT, "exercises_videos");

// ensure dirs
[UPLOAD_ROOT, AVATAR_DIR, FOOD_DIR, EXERCISE_IMG_DIR, EXERCISE_VID_DIR].forEach((d) =>
  fs.mkdirSync(d, { recursive: true })
);

// ===== Multer storages =====
const memory = multer.memoryStorage();

// Avatar (<=2MB)
export const uploadAvatarSingle = multer({
  storage: memory,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if ((file.mimetype || "").startsWith("image/")) return cb(null, true);
    cb(new Error("Chỉ chấp nhận file ảnh cho avatar"));
  },
}).single("avatar");

// Food image (<=5MB)
export const uploadFoodSingle = multer({
  storage: memory,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if ((file.mimetype || "").startsWith("image/")) return cb(null, true);
    cb(new Error("Chỉ chấp nhận file ảnh cho món ăn"));
  },
}).single("image");

// Import (CSV/XLSX + ZIP) (<=25MB)
export const uploadImportAny = multer({
  storage: memory,
  limits: { fileSize: 25 * 1024 * 1024 },
}).fields([
  { name: "file", maxCount: 1 },
  { name: "archive", maxCount: 1 },
]);

// ===== NEW: Exercise image + video (<=50MB tổng mỗi file)
// client gửi field 'image' (image/*) và/hoặc 'video' (video/*)
export const uploadExerciseAny = multer({
  storage: memory,
  limits: { fileSize: 50 * 1024 * 1024 }, // cho phép video lớn
  fileFilter(_req, file, cb) {
    const mt = file.mimetype || "";
    if (mt.startsWith("image/") || mt.startsWith("video/")) return cb(null, true);
    cb(new Error("Chỉ chấp nhận ảnh hoặc video cho bài tập"));
  },
}).fields([
  { name: "image", maxCount: 1 },
  { name: "video", maxCount: 1 },
]);
