import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  listDayLogs, deleteDayLog, getStreak,
  getWaterDay, incWaterDay
} from "../controllers/nutrition.controller.js";

const r = Router();
r.use(auth); // riêng tư theo user

r.get("/nutrition/logs", listDayLogs);
r.delete("/nutrition/logs/:id", deleteDayLog);
r.get("/nutrition/streak", getStreak);

r.get("/nutrition/water", getWaterDay);
r.post("/nutrition/water", incWaterDay);

export default r;
