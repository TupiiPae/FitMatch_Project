import api from "../lib/api";

export async function listNotifications({ limit = 20, cursor = null } = {}) {
  const r = await api.get("/api/notifications", { params: { limit, cursor } });
  return r.data;
}

export async function getUnreadCount() {
  const r = await api.get("/api/notifications/unread-count");
  return r.data;
}

export async function markNotificationRead(id) {
  const r = await api.patch(`/api/notifications/${id}/read`);
  return r.data;
}

export async function markAllNotificationsRead() {
  const r = await api.patch("/api/notifications/read-all");
  return r.data;
}
