// server/src/routes/suggestMenu.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import rateLimit from "../middleware/rateLimit.js";
import {
  listSuggestMenus,
  getSuggestMenu,
  createSuggestMenu,
  updateSuggestMenu,
  deleteSuggestMenu,
} from "../controllers/suggestMenu.controller.js";
import { uploadFoodSingle } from "../middleware/upload.js";

const r = Router();

// mọi API cần đăng nhập, giống food.routes
r.use(auth);
r.use(rateLimit({ windowMs: 30 * 1000, max: 120 }));

// Danh sách / chi tiết thực đơn gợi ý
r.get("/suggest-menus", listSuggestMenus);
r.get("/suggest-menus/:id", getSuggestMenu);

// Tạo / cập nhật / xoá – controller tự kiểm tra isAdminRole
r.post("/suggest-menus", uploadFoodSingle, createSuggestMenu);
r.patch("/suggest-menus/:id", uploadFoodSingle, updateSuggestMenu);
r.delete("/suggest-menus/:id", deleteSuggestMenu);

export default r;
