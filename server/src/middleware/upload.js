// server/src/middleware/upload.js
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== ĐIỂM QUAN TRỌNG: Thư mục uploads nằm ở server/uploads ======
// __dirname: server/src/middleware
// -> PROJECT_ROOT: server
const PROJECT_ROOT = path.join(__dirname, "..", "..");
export const UPLOAD_ROOT = path.join(PROJECT_ROOT, "uploads");
export const AVATAR_DIR  = path.join(UPLOAD_ROOT, "avatars");

fs.mkdirSync(AVATAR_DIR, { recursive: true });

// Ta upload bằng memoryStorage (để controller xử lý sharp -> webp)
export const uploadAvatarSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter(_req, file, cb) {
    const ok = (file.mimetype || "").startsWith("image/");
    if (!ok) return cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", "avatar"));
    cb(null, true);
  },
}).single("avatar");
