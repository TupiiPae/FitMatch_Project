// server/src/routes/admin.exercise.routes.js
import express from "express";
import { adminAuth } from "../middleware/adminAuth.js";
import { uploadExerciseAny } from "../middleware/upload.js"; // fields: image, video
import {
  listExercises,
  getExercise,
  createExercise,
  updateExercise,
  deleteExercise,
  meta,
} from "../controllers/exercise.controller.js";

const router = express.Router();

router.use(adminAuth);

// Meta + CRUD Exercises (không ràng buộc level — theo yêu cầu)
router.get("/exercises/meta", meta);
router.get("/exercises", listExercises);
router.get("/exercises/:id", getExercise);

// Nhận cả ảnh & video (multipart) qua fields: image, video
router.post("/exercises", uploadExerciseAny, createExercise);
router.patch("/exercises/:id", uploadExerciseAny, updateExercise);

router.delete("/exercises/:id", deleteExercise);

export default router;
