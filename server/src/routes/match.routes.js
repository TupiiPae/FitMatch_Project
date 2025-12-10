// server/src/routes/match.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  getMatchStatus,
  updateDiscoverable,
  listNearby,
  createMatchRequest,
  listMyRequests,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  getRoomDetail,       // 👈 thêm
  leaveMatchRoom,      // 👈 thêm
} from "../controllers/match.controller.js";

const router = Router();

// Tất cả route Connect đều yêu cầu đăng nhập
router.use(auth);

// Trạng thái connect hiện tại
router.get("/match/status", getMatchStatus);

// Bật/tắt cho phép tìm kiếm
router.patch("/match/discoverable", updateDiscoverable);

// Danh sách gợi ý xung quanh
router.get("/match/nearby", listNearby);

// Request
router.post("/match/requests", createMatchRequest);
router.get("/match/requests", listMyRequests);
router.patch("/match/requests/:id/accept", acceptRequest);
router.patch("/match/requests/:id/reject", rejectRequest);
router.patch("/match/requests/:id/cancel", cancelRequest);

// 🔹 Duo / group room
router.get("/match/rooms/:id", getRoomDetail);
router.post("/match/rooms/:id/leave", leaveMatchRoom);

export default router;
