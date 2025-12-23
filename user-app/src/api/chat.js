import api from "../lib/api";

export async function getChatMessages(conversationId, params = {}) {
  const r = await api.get(`/chat/conversations/${conversationId}/messages`, { params });
  return r.data?.data ?? r.data;
}
