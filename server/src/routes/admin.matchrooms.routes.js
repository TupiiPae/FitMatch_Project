// server/src/routes/admin.matchrooms.routes.js
import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth.js";
import {
  listMatchRoomsAdmin,
  getMatchRoomAdmin,
  closeMatchRoomAdmin,
  deleteMatchRoomAdmin,
  deleteManyMatchRoomsAdmin,
  kickMemberAdmin,
  transferOwnerAdmin,
} from "../controllers/admin.matchrooms.controller.js";

const router = Router();

router.get("/", adminAuth, listMatchRoomsAdmin);
router.get("/:id", adminAuth, getMatchRoomAdmin);

router.post("/:id/close", adminAuth, closeMatchRoomAdmin);

router.delete("/:id", adminAuth, deleteMatchRoomAdmin);
router.delete("/", adminAuth, deleteManyMatchRoomsAdmin);

router.post("/:id/kick", adminAuth, kickMemberAdmin);
router.post("/:id/transfer-owner", adminAuth, transferOwnerAdmin);


export default router;
