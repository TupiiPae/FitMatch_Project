// server/src/routes/admin.exercise.routes.js
import express from "express";
import { adminAuth } from "../middleware/adminAuth.js";
import {
  uploadExerciseImageSingle, // .single("image")
  uploadExerciseVideoSingle, // .single("video")
} from "../middleware/upload.js";
import {
  listExercises,
  getExercise,
  createExercise,
  updateExercise,
  deleteExercise,
  meta,
  uploadExerciseVideo, // controller để set videoUrl riêng
} from "../controllers/exercise.controller.js";

const router = express.Router();

// Yêu cầu admin đăng nhập (không ràng buộc level theo yêu cầu)
router.use(adminAuth);

/* -------- Meta + CRUD -------- */
router.get("/exercises/meta", meta);
router.get("/exercises", listExercises);
router.get("/exercises/:id", getExercise);

// Tạo / Sửa: chỉ nhận ảnh qua field "image"
router.post("/exercises", uploadExerciseImageSingle, createExercise);
router.patch("/exercises/:id", uploadExerciseImageSingle, updateExercise);

// Upload video riêng: nhận file qua field "video"
router.post("/exercises/:id/video", uploadExerciseVideoSingle, uploadExerciseVideo);

router.delete("/exercises/:id", deleteExercise);

export default router;
