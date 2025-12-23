import api from "../lib/api";

export async function getChatMessages(conversationId, params = {}) {
  const r = await api.get(`/chat/conversations/${conversationId}/messages`, { params });
  return r.data?.data ?? r.data;
}

export async function uploadChatImage(conversationId, file){
  const fd=new FormData();
  fd.append("image",file);
  const r=await api.post(`/chat/conversations/${conversationId}/images`,fd,{headers:{"Content-Type":"multipart/form-data"}});
  return r.data?.data ?? r.data; // {type:"image",url,name,size}
}
