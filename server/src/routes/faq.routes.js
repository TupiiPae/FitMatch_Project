// server/src/routes/faq.routes.js
import express from "express";
import { listFaqPublic } from "../controllers/faq.controller.js";

const router = express.Router();

// Public FAQ – không cần đăng nhập
router.get("/faq", listFaqPublic);

export default router;
