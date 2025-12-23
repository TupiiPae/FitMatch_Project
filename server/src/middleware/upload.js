// server/src/middleware/upload.js
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
export const UPLOAD_ROOT    = path.join(PROJECT_ROOT, "uploads");
export const AVATAR_DIR     = path.join(UPLOAD_ROOT, "avatars");
export const FOOD_DIR       = path.join(UPLOAD_ROOT, "foods");

// ===== Exercises dirs (ảnh & video tách riêng) =====
export const EXERCISE_IMG_DIR = path.join(UPLOAD_ROOT, "exercises");
export const EXERCISE_VID_DIR = path.join(UPLOAD_ROOT, "exercises_videos");

export const CHAT_DIR = path.join(UPLOAD_ROOT, "chat_images");

// ensure dirs
[UPLOAD_ROOT, AVATAR_DIR, FOOD_DIR, EXERCISE_IMG_DIR, EXERCISE_VID_DIR, CHAT_DIR].forEach((d) => {
  try { fs.mkdirSync(d, { recursive: true }); } catch {}
});

const memory = multer.memoryStorage();

/* ---------- Avatar (<=2MB) ---------- */
export const uploadAvatarSingle = multer({
  storage: memory,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if ((file.mimetype || "").startsWith("image/")) return cb(null, true);
    cb(new Error("Chỉ chấp nhận file ảnh cho avatar"));
  },
}).single("avatar");

/* ---------- Food image (<=5MB) ---------- */
export const uploadFoodSingle = multer({
  storage: memory,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if ((file.mimetype || "").startsWith("image/")) return cb(null, true);
    cb(new Error("Chỉ chấp nhận file ảnh cho món ăn"));
  },
}).single("image");

/* ---------- Team/Connect cover (<=5MB) ---------- */
export const uploadTeamCoverSingle = multer({
  storage: memory,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if ((file.mimetype || "").startsWith("image/")) return cb(null, true);
    cb(new Error("Chỉ chấp nhận file ảnh (jpg/png/webp/...)"));
  },
}).single("cover");

/* ---------- Import (CSV/XLSX + ZIP) (<=25MB) ---------- */
export const uploadImportAny = multer({
  storage: memory,
  limits: { fileSize: 25 * 1024 * 1024 },
}).fields([
  { name: "file", maxCount: 1 },
  { name: "archive", maxCount: 1 },
]);

/* ---------- Exercise image (<=8MB) ---------- */
export const uploadExerciseImageSingle = multer({
  storage: memory,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const mt = file.mimetype || "";
    if (mt.startsWith("image/")) return cb(null, true);
    cb(new Error("Chỉ chấp nhận file ảnh cho bài tập"));
  },
}).single("image");

/* ---------- Exercise video (<=50MB) ---------- */
export const uploadExerciseVideoSingle = multer({
  storage: memory,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const mt = file.mimetype || "";
    if (mt.startsWith("video/")) return cb(null, true);
    cb(new Error("Chỉ chấp nhận file video cho bài tập"));
  },
}).single("video");

export const uploadChatImageSingle = multer({
  storage: memory,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if ((file.mimetype || "").startsWith("image/")) return cb(null, true);
    cb(new Error("Chỉ chấp nhận file ảnh cho chat"));
  },
}).single("image");