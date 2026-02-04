// server/src/controllers/admin.premium.controller.js
import mongoose from "mongoose";
import { User } from "../models/User.js";
import PaymentTransaction from "../models/PaymentTransaction.js";
import { responseOk } from "../utils/response.js";

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
