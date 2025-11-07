// server/src/routes/admin.exercise.routes.js
import express from "express";
import { adminAuth } from "../middleware/adminAuth.js";
import {
  uploadExerciseImageSingle, // single("image") – chỉ nhận ảnh
  uploadExerciseVideoSingle, // single("video") – chỉ nhận video
} from "../middleware/upload.js";
import {
  listExercises,
  getExercise,
  createExercise,
  updateExercise,
  deleteExercise,
  meta,
  uploadExerciseVideo, // controller cho endpoint upload video riêng
} from "../controllers/exercise.controller.js";

const router = express.Router();

router.use(adminAuth);

// Meta + CRUD
router.get("/exercises/meta", meta);
router.get("/exercises", listExercises);
router.get("/exercises/:id", getExercise);

// Tạo: nhận ảnh (field "image") + form fields
router.post("/exercises", uploadExerciseImageSingle, createExercise);

// Sửa: có thể kèm ảnh mới (field "image")
router.patch("/exercises/:id", uploadExerciseImageSingle, updateExercise);

// Upload/replace video: nhận file video (field "video")
router.post("/exercises/:id/video", uploadExerciseVideoSingle, uploadExerciseVideo);

router.delete("/exercises/:id", deleteExercise);

export default router;
