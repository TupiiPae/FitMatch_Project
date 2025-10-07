import { ENDPOINTS, apiCall } from "../lib/api.js";

export const getOnboardingData = () => apiCall(ENDPOINTS.USER.ONBOARDING.GET);

export const upsertOnboardingData = (payload) =>
  apiCall(ENDPOINTS.USER.ONBOARDING.UPSERT, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const finalizeOnboarding = () =>
  apiCall(ENDPOINTS.USER.ONBOARDING.FINALIZE, { method: "POST" });
