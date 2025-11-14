import { Router } from "express";
import { auth } from "../middleware/auth.js";
import rateLimit from "../middleware/rateLimit.js";
import { listFoods, getFood, createFood, updateFood, deleteFood,toggleFavorite, recordView, createLog } from "../controllers/food.controller.js";
import { uploadFoodSingle } from "../middleware/upload.js";

const r = Router();
r.use(auth);                 // mọi API đều cần đăng nhập
r.use(rateLimit({ windowMs: 30*1000, max: 120 }));

r.get("/foods", listFoods);
r.get("/foods/:id", getFood);
r.post("/foods", uploadFoodSingle, createFood);
r.patch("/foods/:id", uploadFoodSingle, updateFood);         // owner / admin
r.delete("/foods/:id", deleteFood);         // owner / admin
r.post("/foods/:id/favorite", toggleFavorite);
r.post("/foods/:id/view", recordView);

// Nutrition logs
r.post("/nutrition/logs", createLog);

export default r;
