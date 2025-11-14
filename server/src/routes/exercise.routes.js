import { Router } from "express";
import { listExercises, getExercise, getExerciseMeta as meta } from "../controllers/exercise.controller.js";
const r = Router();
r.get("/exercises", listExercises);
r.get("/exercises/meta", meta);
r.get("/exercises/:id", getExercise);
export default r;
