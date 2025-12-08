// server/src/routes/suggestMenu.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  listSuggestMenusUser,
  getSuggestMenu,
  toggleSaveSuggestMenu,
} from "../controllers/suggestMenu.controller.js";

const r = Router();

// tất cả API này yêu cầu đăng nhập user
r.use(auth);

r.get("/suggest-menus", listSuggestMenusUser);           // GET /api/suggest-menus
r.get("/suggest-menus/:id", getSuggestMenu);             // GET /api/suggest-menus/:id
r.post("/suggest-menus/:id/save", toggleSaveSuggestMenu); // POST /api/suggest-menus/:id/save

export default r;
