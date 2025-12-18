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
  getRoomStreaks,
} from "../controllers/match.controller.js";
import { getMyRoomView,bumpMyRoomView,syncMyRoomView } from "../controllers/match.room.views.controller.js";
import { createConnectReport, listConnectReportsAdmin, updateConnectReportAdmin } from "../controllers/match.controller.js";

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

router.get("/match/rooms/:id/streaks", getRoomStreaks);

router.get("/match/rooms/:id/views/me", getMyRoomView);
router.post("/match/rooms/:id/views/bump", bumpMyRoomView);
router.post("/match/rooms/:id/views/sync", syncMyRoomView);

router.post("/match/reports", createConnectReport);
router.get("/match/reports/admin", listConnectReportsAdmin);
router.patch("/match/reports/:id/admin", updateConnectReportAdmin);

export default router;
