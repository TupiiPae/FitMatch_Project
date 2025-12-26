import api from "../lib/api";

export async function getChatMessages(conversationId, params = {}) {
  const r = await api.get(`/chat/conversations/${conversationId}/messages`, { params });
  return r.data?.data ?? r.data;
}

export async function uploadChatImage(conversationId, file){
  const fd=new FormData();
  fd.append("image",file);
  const r=await api.post(`/chat/conversations/${conversationId}/images`,fd,{headers:{"Content-Type":"multipart/form-data"}});
  return r.data?.data ?? r.data;
}

export async function getChatConversationSummary(conversationId){
  const r=await api.get(`/chat/conversations/${conversationId}/summary`);
  return r.data?.data ?? r.data;
}

// ===== DM (Tin nhắn riêng) =====
const asArr = (x) => (Array.isArray(x) ? x : Array.isArray(x?.items) ? x.items : []);

export async function listDmConversations() {
  const r = await api.get("/api/chat/dm/conversations", {
    params: { _ts: Date.now() }, 
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
  });
  return r.data?.data ?? r.data;
}

export async function createOrGetDmConversation(userId) {
  const r = await api.post(`/chat/dm/conversations`, { userId });
  return r.data?.data ?? r.data;
}

export async function searchDmUsers(q) {
  const r = await api.get(`/chat/dm/search-users`, { params: { q } });
  const data = r.data?.data ?? r.data;
  return asArr(data);
}
