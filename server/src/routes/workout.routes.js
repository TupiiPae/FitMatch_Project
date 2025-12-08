// server/src/routes/workout.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  listPlans, getPlan, createPlan, updatePlan, deletePlan, toggleSavePlan,
} from "../controllers/workout.controller.js";

const r = Router();
r.use(auth);

r.get("/workouts", listPlans);              // ?scope=mine|saved&q=&limit=&skip=
r.post("/workouts", createPlan);
r.get("/workouts/:id", getPlan);
r.patch("/workouts/:id", updatePlan);
r.delete("/workouts/:id", deletePlan);
r.post("/workouts/:id/save", toggleSavePlan); // toggle “đã lưu”

export default r;
