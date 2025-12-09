import api from "../lib/api";

function unwrap(res) {
  return res?.data?.data ?? res?.data ?? res;
}

// GET /api/match/status
export async function getMatchStatus() {
  const res = await api.get("/match/status");
  return unwrap(res);
}

export async function updateDiscoverable(discoverable) {
  const res = await api.patch("/match/discoverable", { discoverable });
  return unwrap(res);
}

export async function listNearby(mode = "one_to_one") {
  const res = await api.get("/match/nearby", { params: { mode } });
  return unwrap(res);
}

export async function createMatchRequest(payload) {
  const res = await api.post("/match/requests", payload);
  return unwrap(res);
}

export async function getMyRequests() {
  const res = await api.get("/match/requests");
  return unwrap(res);
}

export async function acceptMatchRequest(id) {
  const res = await api.patch(`/match/requests/${id}/accept`);
  return unwrap(res);
}

export async function rejectMatchRequest(id) {
  const res = await api.patch(`/match/requests/${id}/reject`);
  return unwrap(res);
}

export async function cancelMatchRequest(id) {
  const res = await api.patch(`/match/requests/${id}/cancel`);
  return unwrap(res);
}
