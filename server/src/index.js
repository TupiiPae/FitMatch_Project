// server/src/index.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import path from "path";

import { connectDB } from "./config/db.js";

// ===== Routes =====
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import adminAuthRoutes from "./routes/admin.auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import onboardingRoutes from "./routes/onboarding.routes.js";
import foodRoutes from "./routes/food.routes.js";
import nutritionRoutes from "./routes/nutrition.routes.js";
import adminFoodsRoutes from "./routes/admin.food.routes.js";
import adminAccountsRoutes from "./routes/admin.accounts.routes.js";
import adminExercisesRoutes from "./routes/admin.exercise.routes.js"; 

// ===== Middlewares =====
import { auth } from "./middleware/auth.js";
import { UPLOAD_ROOT } from "./middleware/upload.js";

const app = express();

// ===== Env =====
const isDev = process.env.NODE_ENV !== "production";
const PORT = process.env.PORT || 5000;
const MONGO = process.env.MONGO || process.env.MONGO_URI;

// ===== Static uploads =====
// cho phép truy cập ảnh/video trong thư mục uploads
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(UPLOAD_ROOT, { maxAge: isDev ? 0 : "7d", etag: true })
);

// ===== Parsers =====
app.use(express.json({ limit: "2mb" })); // tăng limit cho form JSON nhỏ
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ===== CORS =====
const allowlist = [
  process.env.CLIENT_USER_ORIGIN,
  process.env.CLIENT_ADMIN_ORIGIN,
  isDev ? "http://localhost:5173" : null,
  isDev ? "http://localhost:5174" : null,
  isDev ? "http://127.0.0.1:5173" : null,
  isDev ? "http://127.0.0.1:5174" : null,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowlist.includes(origin)) return cb(null, true);
      console.warn(`⚠️  CORS blocked origin: ${origin}`);
      return cb(new Error(`CORS bị chặn cho origin: ${origin}`));
    },
    credentials: true,
  })
);

// ===== Logging =====
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

if (isDev) mongoose.set("debug", true);

// ===== Fix duplicated /api prefix =====
app.use((req, _res, next) => {
  if (/^\/api\/api(\/|$)/.test(req.url)) {
    req.url = req.url.replace(/^\/api\/api/, "/api");
    if (req.originalUrl)
      req.originalUrl = req.originalUrl.replace(/^\/api\/api/, "/api");
    console.log("[FIX] Normalised duplicated /api prefix ->", req.url);
  }
  next();
});

// ===== Health check =====
app.get("/", (_req, res) => res.send("FitMatch API v1"));

// ===== Auth routes =====
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/auth", authRoutes);

// ===== Admin routes =====
app.use(
  "/api/admin/admin-accounts",
  auth,
  (req, _res, next) => {
    console.log("DEBUG admin-accounts:", {
      userId: req.userId,
      userRole: req.userRole,
      userLevel: req.userLevel,
    });
    next();
  },
  adminAccountsRoutes
);

// Các nhóm admin khác
app.use("/api/admin", adminRoutes);
app.use("/api/admin", adminFoodsRoutes);

// ===== NEW: Admin Exercises =====
app.use("/api/admin", adminExercisesRoutes);

// ===== User routes =====
app.use("/api/user/onboarding", onboardingRoutes);
app.use("/api/user", userRoutes);

// ===== Public/Common routes =====
app.use("/api", foodRoutes);
app.use("/api", nutritionRoutes);

// ===== Debug: in danh sách routes khi DEV =====
if (isDev) {
  const printRegisteredRoutes = (appInstance) => {
    const out = [];
    appInstance._router?.stack?.forEach((layer) => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods)
          .join(",")
          .toUpperCase();
        out.push(`${methods} ${layer.route.path}`);
      } else if (layer.name === "router" && layer.handle?.stack) {
        const mountPath = layer.regexp?.toString() || "<router>";
        layer.handle.stack.forEach((handler) => {
          if (handler.route) {
            const methods = Object.keys(handler.route.methods)
              .join(",")
              .toUpperCase();
            out.push(`${methods} ${mountPath} -> ${handler.route.path}`);
          }
        });
      }
    });
    console.log("=== Registered routes ===\n" + out.join("\n"));
  };
  printRegisteredRoutes(app);
}

// ===== 404 for API =====
app.use((req, res) => {
  if (req.originalUrl.startsWith("/api/")) {
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy endpoint" });
  }
  return res.status(404).send("Not found");
});

// ===== Error handler =====
app.use((err, _req, res, _next) => {
  // Bắt riêng lỗi upload (multer)
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      message: "File tải lên quá lớn. Giới hạn ~150MB cho video.",
    });
  }
  if (err?.message?.includes("Chỉ chấp nhận ảnh hoặc video")) {
    return res.status(400).json({ success: false, message: err.message });
  }

  console.error("❌ Lỗi hệ thống:", err);
  res
    .status(500)
    .json({ success: false, message: "Lỗi máy chủ, vui lòng thử lại sau." });
});

// ===== Start =====
connectDB(MONGO)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 FitMatch API đang chạy tại http://localhost:${PORT}`);
    });
  })
  .catch((e) => {
    console.error("❌ Không thể kết nối MongoDB:", e);
    process.exit(1);
  });

export default app;
