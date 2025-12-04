// server/src/routes/activity.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  getDayActivity,
  setStepsDay,
  setWeightDay,
  setWorkoutsDay,
  toggleWorkoutDay,
  getWeightHistory
} from "../controllers/activity.controller.js";

const r = Router();
r.use(auth);

r.get("/day", getDayActivity);
r.post("/steps", setStepsDay);
r.post("/weight", setWeightDay);
r.post("/workouts", setWorkoutsDay);
r.post("/toggle-workout", toggleWorkoutDay);
r.get("/weight-history", getWeightHistory);

export default r;
