// server/src/routes/match.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { uploadTeamCoverSingle } from "../middleware/upload.js";
import {
  getMatchStatus,
  updateDiscoverable,
  listNearby,
  createMatchRequest,
  listMyRequests,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  getRoomDetail,
  leaveMatchRoom,
  createGroupRoom, 
  listRoomRequests,
  updateGroupRoom,
  manageGroupMembers,
} from "../controllers/match.controller.js";

const router = Router();
router.use(auth);

router.get("/match/status", getMatchStatus);
router.patch("/match/discoverable", updateDiscoverable);
router.get("/match/nearby", listNearby);

router.post("/match/requests", createMatchRequest);
router.get("/match/requests", listMyRequests);
router.patch("/match/requests/:id/accept", acceptRequest);
router.patch("/match/requests/:id/reject", rejectRequest);
router.patch("/match/requests/:id/cancel", cancelRequest);

router.get("/match/rooms/:id", getRoomDetail);
router.post("/match/rooms/:id/leave", leaveMatchRoom);

// Create team (multipart/form-data)
router.post("/match/groups", uploadTeamCoverSingle, createGroupRoom);

router.get("/match/rooms/:id/requests", listRoomRequests);

// edit group info (JSON hoặc multipart có file)
router.patch("/match/rooms/:id", uploadTeamCoverSingle, updateGroupRoom);
router.patch("/match/rooms/:id/members/manage", manageGroupMembers);


export default router;
