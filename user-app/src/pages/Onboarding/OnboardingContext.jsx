import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../../lib/api";

export const OnboardingContext = createContext({});

export function OnboardingProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    nickname: "",
    goal: "",
    // heightCm, weightKg, targetWeightKg, weeklyChangeKg, trainingIntensity ... sẽ bổ sung bước sau
  });

  // THÊM state cho nickname
  const [nickname, setNickname] = useState("");

  useEffect(() => {
    // nạp dữ liệu sẵn có (nếu user đã điền dở dang)
    (async () => {
      try {
        const { data: res } = await api.get("/user/me");
        const p = res.user?.profile || {};
        setData((d) => ({
          ...d,
          nickname: p.nickname || "",
          goal: p.goal || "",
        }));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const savePartial = async (patch) => {
    setData((d) => ({ ...d, ...patch }));
    const body = {};
    if ("nickname" in patch) body["profile.nickname"] = patch.nickname;
    if ("goal" in patch) body["profile.goal"] = patch.goal;
    await api.patch("/user/onboarding", body);
  };

  const value = {
    loading,
    data,
    setData,
    savePartial,
    nickname,
    setNickname,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}
