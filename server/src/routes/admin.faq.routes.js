// server/src/routes/admin.faq.routes.js
import express from "express";
import { adminAuth } from "../middleware/adminAuth.js";

import {
  listFaqCategoriesAdmin,
  createFaqCategoryAdmin,
  updateFaqCategoryAdmin,
  deleteFaqCategoryAdmin,
  listFaqQuestionsAdmin,
  createFaqQuestionAdmin,
  updateFaqQuestionAdmin,
  deleteFaqQuestionAdmin,
} from "../controllers/admin.faq.controller.js";

const router = express.Router();

// Bắt buộc phải đăng nhập admin (giống routes contact)
router.use(adminAuth);

// ===== Categories =====
router.get("/faq/categories", listFaqCategoriesAdmin);
router.post("/faq/categories", createFaqCategoryAdmin);
router.patch("/faq/categories/:id", updateFaqCategoryAdmin);
router.delete("/faq/categories/:id", deleteFaqCategoryAdmin);

// ===== Questions =====
router.get("/faq/questions", listFaqQuestionsAdmin);
router.post("/faq/questions", createFaqQuestionAdmin);
router.patch("/faq/questions/:id", updateFaqQuestionAdmin);
router.delete("/faq/questions/:id", deleteFaqQuestionAdmin);

export default router;
