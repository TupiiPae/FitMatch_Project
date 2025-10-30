// server/src/index.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

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

// ===== Middlewares =====
import { auth } from "./middleware/auth.js";
import { UPLOAD_ROOT } from "./middleware/upload.js";

const app = express();

// ===== Env =====
const isDev = process.env.NODE_ENV !== "production";
const PORT = process.env.PORT || 5000;
const MONGO = process.env.MONGO || process.env.MONGO_URI;

// ===== Static uploads (điểm sự thật: từ middleware/upload.js) =====
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(UPLOAD_ROOT, { maxAge: isDev ? 0 : "7d", etag: true })
);

// ===== Parsers =====
app.use(express.json({ limit: "1mb" }));
// (Không cần express.urlencoded cho upload; multer xử lý multipart)

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
      // Cho phép request không có Origin (Postman/cURL) hoặc nằm trong allowlist
      if (!origin || allowlist.includes(origin)) return cb(null, true);
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

// Bật debug query cho DEV
if (isDev) mongoose.set("debug", true);

// Normalise duplicated /api prefix (fix requests like /api/api/...)
app.use((req, _res, next) => {
  if (/^\/api\/api(\/|$)/.test(req.url)) {
    req.url = req.url.replace(/^\/api\/api/, "/api");
    if (req.originalUrl) req.originalUrl = req.originalUrl.replace(/^\/api\/api/, "/api");
    console.log("[FIX] Normalised duplicated /api prefix ->", req.url);
  }
  next();
});

// ===== Health =====
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
app.use("/api/admin", adminFoodsRoutes); // gồm /foods, /foods/import/validate, /foods/import

// ===== User routes =====
app.use("/api/user/onboarding", onboardingRoutes);
app.use("/api/user", userRoutes);

// ===== Public/Common routes =====
app.use("/api", foodRoutes);
app.use("/api", nutritionRoutes);

// (Tùy chọn) In danh sách routes khi khởi động
const printRegisteredRoutes = (appInstance) => {
  const out = [];
  appInstance._router.stack.forEach((layer) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).join(",").toUpperCase();
      out.push(`${methods} ${layer.route.path}`);
    } else if (layer.name === "router" && layer.handle && layer.handle.stack) {
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
if (isDev) printRegisteredRoutes(app);

// ===== 404 cho API =====
app.use((req, res) => {
  if (req.originalUrl.startsWith("/api/")) {
    return res.status(404).json({ success: false, message: "Không tìm thấy endpoint" });
  }
  return res.status(404).send("Not found");
});

// ===== Error handler =====
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("Lỗi hệ thống:", err?.message || err);
  res.status(500).json({ success: false, message: "Lỗi máy chủ" });
});

// ===== Start =====
connectDB(MONGO)
  .then(() => app.listen(PORT, () => console.log(`🚀 API on http://localhost:${PORT}`)))
  .catch((e) => {
    console.error("Không thể kết nối MongoDB:", e);
    process.exit(1);
  });

export default app;
