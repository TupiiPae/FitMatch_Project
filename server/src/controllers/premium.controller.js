// server/src/controllers/premium.controller.js
import { User } from "../models/User.js";
import { responseOk } from "../utils/response.js";

const PLANS = [1, 3, 6, 12];

const BENEFITS = {
  free: {
    aiDailyLimit: 20,
    connectLimit: 5,
  },
  premium: {
    aiDailyLimit: 200,
    connectLimit: 50,
  },
};

function addMonths(date, months) {
  const d = new Date(date);
  const m = Number(months) || 0;
  const day = d.getDate();
  d.setMonth(d.getMonth() + m);

  // Fix case “31 + 1 month” overflow
  if (d.getDate() !== day) d.setDate(0);
  return d;
}

function premiumSnapshot(user) {
  const p = user?.premium || {};
  const now = Date.now();
  const expiresAt = p?.expiresAt ? new Date(p.expiresAt) : null;
  const isPremium = !!(expiresAt && expiresAt.getTime() > now);

  const tier = isPremium ? "premium" : "free";
  const benefits = BENEFITS[tier] || BENEFITS.free;

  const daysLeft =
    isPremium && expiresAt
      ? Math.max(0, Math.ceil((expiresAt.getTime() - now) / (24 * 3600 * 1000)))
      : 0;

  return {
    tier,
    isPremium,
    months: Number(p?.months || 0),
    startedAt: p?.startedAt || null,
    expiresAt: p?.expiresAt || null,
    provider: p?.provider || "mock",
    daysLeft,
    benefits,
  };
}

// GET /api/premium/me
export async function getMyPremium(req, res) {
  try {
    const userId = req.userId;
    const u = await User.findById(userId)
      .select("premium")
      .lean()
      .catch(() => null);

    return responseOk(res, { premium: premiumSnapshot(u) });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// POST /api/premium/subscribe  body: { months: 1|3|6|12 }
// (Mock: kích hoạt ngay, nếu bạn có payment thật thì đổi sang trả redirectUrl)
export async function subscribePremium(req, res) {
  try {
    const userId = req.userId;
    const months = Number(req.body?.months);

    if (!PLANS.includes(months)) {
      return res.status(400).json({ success: false, message: "Gói không hợp lệ" });
    }

    const u = await User.findById(userId).select("premium").catch(() => null);
    if (!u) return res.status(404).json({ success: false, message: "User not found" });

    const now = new Date();
    const curExp = u?.premium?.expiresAt ? new Date(u.premium.expiresAt) : null;
    const base = curExp && curExp.getTime() > now.getTime() ? curExp : now;

    const nextExp = addMonths(base, months);

    u.premium = {
      tier: "premium",
      months,
      startedAt: u?.premium?.startedAt || now,
      expiresAt: nextExp,
      provider: u?.premium?.provider || "mock",
    };

    await u.save();

    return responseOk(res, {
      message: "Kích hoạt Premium thành công (mock)",
      premium: premiumSnapshot(u),
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

// POST /api/premium/cancel  (giữ tới hết hạn, chỉ set tier về free khi hết hạn)
export async function cancelPremium(req, res) {
  try {
    const userId = req.userId;
    const u = await User.findById(userId).select("premium").catch(() => null);
    if (!u) return res.status(404).json({ success: false, message: "User not found" });

    // Không xóa expiresAt để user vẫn dùng tới hết hạn
    u.premium = {
      ...(u.premium || {}),
      tier: "free",
    };

    await u.save();
    return responseOk(res, { message: "Đã hủy gia hạn (dùng tới hết hạn)", premium: premiumSnapshot(u) });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
