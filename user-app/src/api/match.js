// user-app/src/api/match.js
import api from "../lib/api";

/** Lấy trạng thái kết nối hiện tại của user */
export async function getMatchStatus() {
  const res = await api.get("/match/status");        // ❌ bỏ /api
  return res.data;
}

/** Bật / tắt cho phép tìm kiếm */
export async function updateDiscoverable(discoverable) {
  const res = await api.patch("/match/discoverable", { discoverable }); // ❌ bỏ /api
  return res.data;
}

/** Lấy danh sách gợi ý xung quanh */
export async function listNearby(mode = "one_to_one") {
  const res = await api.get("/match/nearby", { params: { mode } }); // ❌ bỏ /api
  return res.data;
}

/** Gửi request kết nối */
export async function createMatchRequest(payload) {
  const res = await api.post("/match/requests", payload); // ❌ bỏ /api
  return res.data;
}

/** Lấy các request của tôi */
export async function getMyRequests() {
  const res = await api.get("/match/requests"); // ❌ bỏ /api
  return res.data;
}

/** Duyệt lời mời */
export async function acceptMatchRequest(id) {
  const res = await api.patch(`/match/requests/${id}/accept`); // ❌ bỏ /api
  return res.data;
}

/** Từ chối lời mời */
export async function rejectMatchRequest(id) {
  const res = await api.patch(`/match/requests/${id}/reject`); // ❌ bỏ /api
  return res.data;
}

/** Hủy lời mời mình đã gửi */
export async function cancelMatchRequest(id) {
  const res = await api.patch(`/match/requests/${id}/cancel`); // ❌ bỏ /api
  return res.data;
}
