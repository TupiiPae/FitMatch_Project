import api from "./user-api";

// Gửi dữ liệu tiếng Việt như schema để server tính BMI/BMR
export async function upsertOnboarding(payload) {
  const { data } = await api.post("/api/user/onboarding/upsert", payload);
  return data.data; // Onboarding doc
}

export async function getMyOnboarding() {
  const { data } = await api.get("/api/user/onboarding/me");
  return data.data; // Onboarding doc
}
