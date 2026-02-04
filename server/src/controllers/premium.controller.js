// server/src/controllers/premium.controller.js
import { User } from "../models/User.js";
import PremiumPlan from "../models/PremiumPlan.js";
import { responseOk } from "../utils/response.js";

const BENEFITS = {
  free: { aiDailyLimit: 20, connectLimit: 5 },
  premium: { aiDailyLimit: 200, connectLimit: 50 },
};

function addMonths(date, months) {
  const d = new Date(date);
  const m = Number(months) || 0;
  const day = d.getDate();
  d.setMonth(d.getMonth() + m);
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

const safeStr = (v) => String(v ?? "").trim();

async function ensurePlans() {
  await PremiumPlan.ensureDefaults().catch(() => {});
}

async function getActivePlanByMonths(months) {
  const m = Number(months || 0);
  if (!m) return null;
  return PremiumPlan.findOne({ months: m, isActive: true }).lean().catch(() => null);
}

async function getActivePlanByCode(code) {
  const c = safeStr(code);
  if (!c) return null;
  return PremiumPlan.findOne({ code: c, isActive: true }).lean().catch(() => null);
}

/**
 * GET /api/premium/plans
 * -> dùng để FE user hiển thị các gói & giá (lấy từ DB)
 */
export async function listPremiumPlans(req, res) {
  try {
    await ensurePlans();
    const items = await PremiumPlan.find({ isActive: true })
      .sort({ sortOrder: 1, months: 1 })
      .lean();
    return responseOk(res, { items });
  } catch (e) {
    return res.status(500).json({ success: false, message: e?.message || "Server error" });
  }
}

// GET /api/premium/me
export async function getMyPremium(req, res) {
  try {
    await ensurePlans();

    const userId = req.userId;
    const u = await User.findById(userId).select("premium").lean().catch(() => null);

    const snap = premiumSnapshot(u);
    let plan = null;

    if (snap.isPremium && snap.months) {
      plan = await getActivePlanByMonths(snap.months);
    }

    return responseOk(res, { premium: snap, plan });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/**
 * POST /api/premium/subscribe
 * Body hỗ trợ 2 dạng:
 *  - { planCode: "premium_3m" }
 *  - { months: 3 }
 *
 * (Mock activate: vẫn kích hoạt ngay, nhưng months/plan lấy từ DB)
 */
export async function subscribePremium(req, res) {
  try {
    await ensurePlans();

    const userId = req.userId;
    const planCode = safeStr(req.body?.planCode);
    const monthsBody = req.body?.months;

    // ✅ lookup plan từ DB (ưu tiên planCode)
    let plan = null;
    if (planCode) plan = await getActivePlanByCode(planCode);
    if (!plan && monthsBody != null) plan = await getActivePlanByMonths(Number(monthsBody));

    if (!plan) {
      return res.status(400).json({ success: false, message: "Gói không hợp lệ hoặc đã tắt" });
    }

    const months = Number(plan.months);

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
      plan, // ✅ trả plan để FE hiển thị đúng gói/giá
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e?.message || "Server error" });
  }
}

// POST /api/premium/cancel  (giữ tới hết hạn, chỉ set tier về free khi hết hạn)
export async function cancelPremium(req, res) {
  try {
    const userId = req.userId;
    const u = await User.findById(userId).select("premium").catch(() => null);
    if (!u) return res.status(404).json({ success: false, message: "User not found" });

    u.premium = { ...(u.premium || {}), tier: "free" };
    await u.save();

    return responseOk(res, {
      message: "Đã hủy gia hạn (dùng tới hết hạn)",
      premium: premiumSnapshot(u),
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
