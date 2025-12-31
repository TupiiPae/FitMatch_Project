import api from "../lib/api";

const unwrapItems = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
};

export async function listAiMessages(params = {}) {
  const r = await api.get("/ai/messages", { params });
  const data = r.data?.data ?? r.data;
  return { raw: data, items: unwrapItems(data) };
}

export async function uploadAiImage(file) {
  const fd = new FormData();
  fd.append("image", file);
  const r = await api.post("/ai/images", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return r.data?.data ?? r.data;
}

export async function sendAiChat(body = {}) {
  // body: { text?, imageUrls?, intent?, meta? }
  const r = await api.post("/ai/chat", body);
  return r.data?.data ?? r.data;
}
