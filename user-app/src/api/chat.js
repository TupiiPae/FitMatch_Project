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

export const listDmConversations = async () => {
  const r = await api.get("/chat/dm/conversations");
  return r.data?.items ?? r.data?.data ?? r.data;
};

export const searchDmUsers = async (q) => {
  const r = await api.get("/chat/dm/users", { params: { q } });
  return r.data?.items ?? r.data?.data ?? r.data;
};

export async function createOrGetDmConversation(userId) {
  const uid = String(userId || "").trim();
  if (!/^[0-9a-fA-F]{24}$/.test(uid)) throw new Error("INVALID_USER_ID");

  const r = await api.post("/chat/dm/conversations", { userId: uid }); 
  return r.data?.data ?? r.data;
}