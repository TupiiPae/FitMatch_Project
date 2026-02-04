// server/src/controllers/admin.premium.controller.js
import mongoose from "mongoose";
import { User } from "../models/User.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import { responseOk } from "../utils/response.js";
import PremiumPlan, { PREMIUM_ALLOWED_MONTHS } from "../models/PremiumPlan.js";

const safeInt = (v, d = 0) => {
  const n = parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : d;
};
const clamp = (n, a, b) => Math.min(Math.max(n, a), b);

const asOid = (v) => {
  try {
    return new mongoose.Types.ObjectId(String(v));
  } catch {
    return null;
  }
};

const buildUserSearch = (q) => {
  const s = String(q || "").trim();
  if (!s) return null;
  const rx = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return {
    $or: [
      { email: rx },
      { username: rx },
      { "profile.nickname": rx },
      { phone: rx },
    ],
  };
};

const normalizePaging = (req) => {
  const limit = clamp(safeInt(req.query.limit, 20), 1, 100);

  // FE bạn đang dùng "skip" + "limit" => support cả skip lẫn page
  const skipRaw = req.query.skip;
  const pageRaw = req.query.page;

  let skip = safeInt(skipRaw, 0);
  if (!skipRaw && pageRaw) {
    const page = clamp(safeInt(pageRaw, 1), 1, 999999);
    skip = (page - 1) * limit;
  }
  skip = Math.max(skip, 0);

  const page = Math.floor(skip / limit) + 1;
  return { limit, skip, page };
};

const safeStr = (v) => String(v ?? "").trim();
const toFeatures = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) return input.map((x) => String(x || "").trim()).filter(Boolean);
  return String(input || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
};

const validateMonths = (months) => {
  const m = safeInt(months, 0);
  if (!PREMIUM_ALLOWED_MONTHS.includes(m)) {
    const e = new Error("months chỉ nhận 1/3/6/12");
    e.status = 400;
    throw e;
  }
  return m;
};

const validatePrice = (price) => {
  const n = Number(price);
  if (!Number.isFinite(n) || n < 0) {
    const e = new Error("price không hợp lệ");
    e.status = 400;
    throw e;
  }
  return Math.round(n);
};

export async function adminListPremiumUsers(req, res) {
  try {
    const { limit, skip, page } = normalizePaging(req);

    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "active").toLowerCase(); // active | expired | all
    const provider = String(req.query.provider || "").trim();

    const now = new Date();

    const base = {
      role: "user",
      "premium.tier": "premium",
    };

    if (provider) base["premium.provider"] = provider;

    if (status === "active") {
      base["premium.expiresAt"] = { $gt: now };
    } else if (status === "expired") {
      base["premium.expiresAt"] = { $lte: now };
    } else {
      // all: chỉ cần tier=premium, giữ nguyên
    }

    const search = buildUserSearch(q);
    const filter = search ? { ...base, ...search } : base;

    const [items, total] = await Promise.all([
      User.find(filter)
        .select(
          "username email phone profile.nickname profile.sex premium createdAt blocked blockedReason"
        )
        .sort({ "premium.expiresAt": -1, "premium.startedAt": -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    // Tx summary (last transaction) cho list
    const ids = items.map((u) => u?._id).filter(Boolean);
    let txMap = new Map();
    if (ids.length) {
      const agg = await PaymentTransaction.aggregate([
        { $match: { user: { $in: ids } } },
        { $sort: { paidAt: -1, createdAt: -1 } },
        {
          $group: {
            _id: "$user",
            lastStatus: { $first: "$status" },
            lastAmount: { $first: "$amount" },
            lastMonths: { $first: "$months" },
            lastPlanCode: { $first: "$planCode" },
            lastOrderCode: { $first: "$orderCode" },
            lastPaidAt: { $first: "$paidAt" },
            lastCreatedAt: { $first: "$createdAt" },
          },
        },
      ]);
      txMap = new Map(agg.map((x) => [String(x._id), x]));
    }

    const outItems = items.map((u) => ({
      ...u,
      lastTransaction: txMap.get(String(u._id)) || null,
    }));

    // Counts để hiển thị quick stats
    const [countAll, countActive, countExpired] = await Promise.all([
      User.countDocuments({ role: "user", "premium.tier": "premium" }),
      User.countDocuments({
        role: "user",
        "premium.tier": "premium",
        "premium.expiresAt": { $gt: now },
      }),
      User.countDocuments({
        role: "user",
        "premium.tier": "premium",
        "premium.expiresAt": { $lte: now },
      }),
    ]);

    return responseOk(res, {
      items: outItems,
      total,
      limit,
      skip,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      counts: { all: countAll, active: countActive, expired: countExpired },
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: e?.message || "Server error" });
  }
}

export async function adminListPremiumTransactions(req, res) {
  try {
    const userId = asOid(req.params.id);
    if (!userId) return res.status(400).json({ success: false, message: "Invalid user id" });

    const { limit, skip, page } = normalizePaging(req);
    const status = String(req.query.status || "all").toUpperCase(); // all|PAID|PENDING|CANCELLED
    const q = String(req.query.q || "").trim();

    const filter = { user: userId };
    if (status !== "ALL") filter.status = status;

    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      // orderCode là Number => match bằng string thì dùng $expr/$toString (Mongo 4+)
      filter.$or = [
        { planCode: rx },
        { status: rx },
        { checkoutUrl: rx },
        { paymentLinkId: rx },
        { qrCode: rx },
        { $expr: { $regexMatch: { input: { $toString: "$orderCode" }, regex: rx } } },
      ];
    }

    const [items, total, summaryAgg] = await Promise.all([
      PaymentTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PaymentTransaction.countDocuments(filter),
      PaymentTransaction.aggregate([
        { $match: { user: userId } },
        {
          $group: {
            _id: "$user",
            totalTx: { $sum: 1 },
            paidCount: { $sum: { $cond: [{ $eq: ["$status", "PAID"] }, 1, 0] } },
            paidAmount: { $sum: { $cond: [{ $eq: ["$status", "PAID"] }, "$amount", 0] } },
            lastPaidAt: { $max: "$paidAt" },
            lastCreatedAt: { $max: "$createdAt" },
          },
        },
      ]),
    ]);

    const summary = summaryAgg?.[0]
      ? {
          totalTx: summaryAgg[0].totalTx || 0,
          paidCount: summaryAgg[0].paidCount || 0,
          paidAmount: summaryAgg[0].paidAmount || 0,
          lastPaidAt: summaryAgg[0].lastPaidAt || null,
          lastCreatedAt: summaryAgg[0].lastCreatedAt || null,
        }
      : { totalTx: 0, paidCount: 0, paidAmount: 0, lastPaidAt: null, lastCreatedAt: null };

    return responseOk(res, {
      items,
      total,
      limit,
      skip,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      summary,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: e?.message || "Server error" });
  }
}

export async function adminRevokePremium(req, res) {
  try {
    const userId = asOid(req.params.id);
    if (!userId) return res.status(400).json({ success: false, message: "Invalid user id" });

    const reason = String(req.body?.reason || "").trim();

    const u = await User.findById(userId).select("_id role premium").lean();
    if (!u) return res.status(404).json({ success: false, message: "User not found" });
    if (String(u.role || "") !== "user")
      return res.status(400).json({ success: false, message: "Chỉ áp dụng cho user" });

    await User.updateOne(
      { _id: userId },
      {
        $set: {
          "premium.tier": "free",
          "premium.months": 0,
          "premium.startedAt": null,
          "premium.expiresAt": null,
        },
      }
    );

    return responseOk(res, {
      ok: true,
      message: "Đã hủy Premium",
      reason: reason || undefined,
    });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, message: e?.message || "Server error" });
  }
}

// GET /api/admin/premium/plans
export async function adminListPremiumPlans(req, res) {
  try {
    await PremiumPlan.ensureDefaults().catch(() => {});

    const { limit, skip, page } = normalizePaging(req);
    const q = safeStr(req.query.q);
    const active = safeStr(req.query.active); // "true" | "false" | ""

    const filter = {};
    if (active === "true") filter.isActive = true;
    if (active === "false") filter.isActive = false;

    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { code: rx },
        { name: rx },
        { description: rx },
        { features: { $elemMatch: rx } },
      ];
    }

    const [items, total] = await Promise.all([
      PremiumPlan.find(filter)
        .sort({ sortOrder: 1, months: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PremiumPlan.countDocuments(filter),
    ]);

    return responseOk(res, {
      items,
      total,
      limit,
      skip,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e?.message || "Server error" });
  }
}

// POST /api/admin/premium/plans
export async function adminCreatePremiumPlan(req, res) {
  try {
    const months = validateMonths(req.body?.months);
    const price = validatePrice(req.body?.price);

    // chặn trùng months để đơn giản (1/3/6/12 mỗi loại 1 plan)
    const dup = await PremiumPlan.findOne({ months }).select("_id").lean();
    if (dup) return res.status(400).json({ success: false, message: "Đã có gói với thời hạn này." });

    const code = safeStr(req.body?.code) || `premium_${months}m`;
    const name = safeStr(req.body?.name) || `Premium ${months} tháng`;

    const doc = await PremiumPlan.create({
      code,
      name,
      months,
      price,
      currency: safeStr(req.body?.currency) || "VND",
      description: safeStr(req.body?.description),
      features: toFeatures(req.body?.features),
      isActive: req.body?.isActive === false ? false : true,
      sortOrder: safeInt(req.body?.sortOrder, 0),
    });

    return responseOk(res, doc.toObject());
  } catch (e) {
    const status = e?.status || 500;
    return res.status(status).json({ success: false, message: e?.message || "Server error" });
  }
}

// PATCH /api/admin/premium/plans/:id
export async function adminUpdatePremiumPlan(req, res) {
  try {
    const id = asOid(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid plan id" });

    const cur = await PremiumPlan.findById(id);
    if (!cur) return res.status(404).json({ success: false, message: "Plan not found" });

    const patch = {};

    if (req.body?.months != null) {
      const months = validateMonths(req.body.months);
      const dup = await PremiumPlan.findOne({ _id: { $ne: id }, months }).select("_id").lean();
      if (dup) return res.status(400).json({ success: false, message: "Đã có gói khác với thời hạn này." });

      patch.months = months;
      if (req.body?.code == null) patch.code = `premium_${months}m`;
      if (req.body?.name == null) patch.name = `Premium ${months} tháng`;
    }

    if (req.body?.code != null) patch.code = safeStr(req.body.code);
    if (req.body?.name != null) patch.name = safeStr(req.body.name);
    if (req.body?.price != null) patch.price = validatePrice(req.body.price);
    if (req.body?.currency != null) patch.currency = safeStr(req.body.currency) || "VND";
    if (req.body?.description != null) patch.description = safeStr(req.body.description);
    if (req.body?.features != null) patch.features = toFeatures(req.body.features);
    if (req.body?.isActive != null) patch.isActive = !!req.body.isActive;
    if (req.body?.sortOrder != null) patch.sortOrder = safeInt(req.body.sortOrder, 0);

    const updated = await PremiumPlan.findByIdAndUpdate(id, patch, { new: true, runValidators: true }).lean();
    return responseOk(res, updated);
  } catch (e) {
    const status = e?.status || 500;
    return res.status(status).json({ success: false, message: e?.message || "Server error" });
  }
}

// DELETE /api/admin/premium/plans/:id
export async function adminDeletePremiumPlan(req, res) {
  try {
    const id = asOid(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid plan id" });

    const doc = await PremiumPlan.findById(id).lean();
    if (!doc) return res.status(404).json({ success: false, message: "Plan not found" });

    // nếu plan đã phát sinh giao dịch => chặn xóa
    const used = await PaymentTransaction.findOne({ planCode: String(doc.code) }).select("_id").lean();
    if (used) {
      return res.status(400).json({
        success: false,
        message: "Gói đã có giao dịch. Không thể xóa. Hãy tắt kích hoạt (isActive=false).",
      });
    }

    await PremiumPlan.deleteOne({ _id: id });
    return responseOk(res, { ok: true });
  } catch (e) {
    return res.status(500).json({ success: false, message: e?.message || "Server error" });
  }
}