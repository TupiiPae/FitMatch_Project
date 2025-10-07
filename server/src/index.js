// src/index.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import userRoutes from "./routes/user.routes.js";
import onboardingRoutes from "./routes/onboarding.routes.js";

const app = express();

// ===== Cấu hình chung =====
app.use(express.json({ limit: "1mb" }));

// CORS: ưu tiên ENV, tự thêm localhost khi DEV
const isDev = process.env.NODE_ENV !== "production";
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
      // Cho phép các request không có Origin (Postman/cURL) hoặc trong allowlist
      if (!origin || allowlist.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS bị chặn cho origin: ${origin}`));
    },
    credentials: true,
  })
);

// Log request đơn giản
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Bật debug query cho DEV
if (isDev) mongoose.set("debug", true);

// Normalise duplicated /api prefix (fix requests like /api/api/...)
app.use((req, _res, next) => {
  // only adjust when there's a duplicated /api at the beginning
  if (/^\/api\/api(\/|$)/.test(req.url)) {
    req.url = req.url.replace(/^\/api\/api/, "/api");
    // also set originalUrl for any debug logic that reads it
    if (req.originalUrl) req.originalUrl = req.originalUrl.replace(/^\/api\/api/, "/api");
    console.log("[FIX] Normalised duplicated /api prefix ->", req.url);
  }
  next();
});

// ===== Routes =====
app.get("/", (_req, res) => res.send("FitMatch API v1"));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

// Mount onboarding BEFORE generic user routes
app.use("/api/user/onboarding", onboardingRoutes);
app.use("/api/user", userRoutes);

// Simple request logger (debug)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// --- DEBUG: in danh sách route và log req base/path (xóa khi xong) ---
app.use((req, _res, next) => {
  console.log("[DBG] req.baseUrl:", req.baseUrl, " req.path:", req.path, " method:", req.method);
  next();
});

const printRegisteredRoutes = (appInstance) => {
  const out = [];
  appInstance._router.stack.forEach((layer) => {
    if (layer.route) {
      // route registered directly on app
      const methods = Object.keys(layer.route.methods).join(",").toUpperCase();
      out.push(`${methods} ${layer.route.path}`);
    } else if (layer.name === "router" && layer.handle && layer.handle.stack) {
      // router mounted; try to extract mount path from layer.regexp
      const mountPath = layer.regexp?.toString() || "<router>";
      layer.handle.stack.forEach((handler) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods).join(",").toUpperCase();
          out.push(`${methods} ${mountPath} -> ${handler.route.path}`);
        }
      });
    }
  });
  console.log("=== Registered routes ===\n" + out.join("\n"));
};

printRegisteredRoutes(app);

// 404 cho API
app.use((req, res) => {
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(404).json({ success: false, message: "Không tìm thấy endpoint" });
  }
  return res.status(404).send("Not found");
});

// Error handler gọn
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("Lỗi hệ thống:", err?.message || err);
  res.status(500).json({ success: false, message: "Lỗi máy chủ" });
});

// ===== Khởi động =====
const PORT = process.env.PORT || 5000;
// Sử dụng biến MONGO (viết hoa) trước, fallback về MONGO_URI
const MONGO = process.env.MONGO || process.env.MONGO_URI;

connectDB(MONGO)
  .then(() => app.listen(PORT, () => console.log(`🚀 API on http://localhost:${PORT}`)))
  .catch((e) => {
    console.error("Không thể kết nối MongoDB:", e);
    process.exit(1);
  });

export default app;
