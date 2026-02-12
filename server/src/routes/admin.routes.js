// server/src/routes/admin.routes.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import { Admin } from "../models/Admin.js";
import { User } from "../models/User.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { requireAdminLevel } from "../middleware/requireAdminLevel.js";
import { generateToken } from "../utils/tokens.js";
import NutritionLog from "../models/NutritionLog.js";
import Food from "../models/Food.js";
import SuggestMenu from "../models/SuggestMenu.js";
import dayjs from "dayjs";
import WorkoutPlan from "../models/WorkoutPlan.js";
import Exercise from "../models/Exercise.js";
import SuggestPlan from "../models/SuggestPlan.js";
import MatchRoom from "../models/MatchRoom.js";
import MatchRequest from "../models/MatchRequest.js";
import ConnectReport from "../models/ConnectReport.js";
import ChatMessage from "../models/ChatMessage.js";
import PaymentTransaction from "../models/PaymentTransaction.js";

const router = Router();
const escapeRegex = (s = "") => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* ======================= AUTH (Admin) ======================= */
router.post("/auth/login", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (!username || !password) {
      return res.status(400).json({ message: "Thiếu username hoặc password" });
    }

    const admin = await Admin.findOne({ username }).select("+password");
    if (!admin) return res.status(400).json({ message: "Tài khoản không tồn tại" });
    if (admin.status === "blocked") return res.status(403).json({ message: "Tài khoản đã bị chặn" });

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) return res.status(401).json({ message: "Sai mật khẩu" });

    const token = generateToken({
      id: admin._id,
      username: admin.username,
      role: "admin",
      level: admin.level,
    });

    return res.json({
      token,
      user: {
        id: admin._id,
        username: admin.username,
        nickname: admin.nickname,   // <— thêm
        role: "admin",
        level: admin.level,
        status: admin.status,
      },
    });
  } catch (e) {
    console.error("[admin.auth.login]", e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

router.get("/auth/me", adminAuth, async (req, res) => {
  const admin = await Admin.findById(req.adminId).select("_id username nickname level status");
  if (!admin) return res.status(404).json({ message: "Không tìm thấy admin" });
  res.json({
    id: admin._id,
    username: admin.username,
    nickname: admin.nickname,      // <— thêm
    role: "admin",
    level: admin.level,
    status: admin.status,
  });
});

/* ======================= Stats (mẫu) ======================= */
router.get("/stats", adminAuth, async (_req, res) => {
  res.json({ users: 0, scansToday: 0, mergesToday: 0, nutritionLogUsers: 0 });
});

/* ======================= USERS MANAGEMENT ======================= */
router.get("/users", adminAuth, async (req, res) => {
  try {
    const qRaw = String(req.query?.q ?? "").trim();
    const limit = Math.min(Math.max(Number(req.query?.limit ?? 10) || 10, 1), 100);
    const skip  = Math.max(Number(req.query?.skip ?? 0) || 0, 0);

    const cond = {};
    if (qRaw) {
      const rx = new RegExp(escapeRegex(qRaw), "i");
      cond.$or = [
        { username: rx },
        { email: rx },
        { phone: rx },
        { "profile.nickname": rx },
        { "profile.address.city": rx },
        { "profile.address.district": rx },
        { "profile.address.ward": rx },
      ];
    }

    const [items, total] = await Promise.all([
      User.find(cond)
        .select(
          "_id username email phone blocked createdAt " +
          "profile.avatarUrl profile.nickname profile.sex " +
          "profile.address.country profile.address.city " +
          "profile.address.district profile.address.ward"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(cond),
    ]);

    return res.json({ items, total, limit, skip });
  } catch (e) {
    console.error("[admin.users.list]", e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

router.post("/users/:id/block", adminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await User.findByIdAndUpdate(id, { $set: { blocked: true } }, { new: true })
      .select("_id blocked");
    if (!doc) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    return res.json({ success: true, blocked: doc.blocked });
  } catch (e) {
    console.error("[admin.users.block]", e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

router.post("/users/:id/unblock", adminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const doc = await User.findByIdAndUpdate(id, { $set: { blocked: false } }, { new: true })
      .select("_id blocked");
    if (!doc) return res.status(404).json({ message: "Không tìm thấy người dùng" });
    return res.json({ success: true, blocked: doc.blocked });
  } catch (e) {
    console.error("[admin.users.unblock]", e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

/* ======================= ADMIN ACCOUNTS (chỉ cấp 1 mới quản trị) ======================= */
/**
 * [GET] /api/admin/admin-accounts
 * Query: q, limit, skip
 * Chỉ hiển thị admin cấp 2 để quản trị; admin cấp 1 là duy nhất (không list để tránh xoá nhầm).
 */
router.get("/admin-accounts", adminAuth, requireAdminLevel(1), async (req, res) => {
  try {
    const { q = "", limit = 20, skip = 0 } = req.query;
    const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const sk = Math.max(Number(skip) || 0, 0);
    const cond = {};

    if (q && String(q).trim()) {
      const rx = new RegExp(escapeRegex(String(q).trim()), "i");
      cond.$or = [
        { username: rx },
        { nickname: rx },
        { status: rx },
      ];
    }

    // sort: LV1 đứng đầu, sau đó mới tới các LV2 mới nhất
    const [items, total] = await Promise.all([
      Admin.find(cond)
        .select("_id username nickname level status createdAt")
        .sort({ level: 1, createdAt: -1 })
        .skip(sk)
        .limit(lim)
        .lean(),
      Admin.countDocuments(cond),
    ]);

    res.json({ items, total, limit: lim, skip: sk });
  } catch (e) {
    console.error("[admin.admin-accounts.list]", e);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

/** [POST] /api/admin/admin-accounts
 *  → chỉ LV1 được phép tạo admin cấp 2
 */
router.post("/admin-accounts", adminAuth, requireAdminLevel(1), async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const nickname = String(req.body?.nickname || "").trim();
    if (!username || !nickname) {
      return res.status(400).json({ message: "Thiếu username hoặc nickname" });
    }

    const existed = await Admin.findOne({ username }).lean();
    if (existed) {
      return res.status(409).json({ message: "Username đã tồn tại" });
    }

    const doc = await Admin.create({
      username,
      nickname,
      password: "fitmatch@admin2",
      level: 2,
      status: "active",
    });

    res.json({
      success: true,
      item: {
        _id: doc._id,
        username: doc.username,
        nickname: doc.nickname,
        level: doc.level,
        status: doc.status,
        createdAt: doc.createdAt,
      },
    });
  } catch (e) {
    console.error("[admin.admin-accounts.create]", e);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
});

/* ======================= Stats: USERS ======================= */
/**
 * GET /api/admin/stats/users
 * Query:
 *  - from=YYYY-MM-DD
 *  - to=YYYY-MM-DD
 *  - granularity=day|week|month
 *  - q=search text
 *  - goals=giam_can,duy_tri,...
 *  - sex=male,female
 */
router.get("/stats/users", adminAuth, async (req, res) => {
  try {
    const qRaw = String(req.query?.q ?? "").trim();
    const granularityRaw = String(req.query?.granularity ?? "day").trim().toLowerCase();
    const granularity = ["day", "week", "month"].includes(granularityRaw) ? granularityRaw : "day";

    const parseCsv = (v) =>
      String(v || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

    const goals = parseCsv(req.query?.goals);
    const sex = parseCsv(req.query?.sex);

    const parseYMD = (s) => {
      const str = String(s || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
      const d = new Date(str + "T00:00:00.000Z");
      return Number.isNaN(d.getTime()) ? null : d;
    };

    // default last 30 days
    const now = new Date();
    const fromQ = parseYMD(req.query?.from);
    const toQ = parseYMD(req.query?.to);

    const fromDate = fromQ || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
    const toDateInclusive = toQ || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const toDateExclusive = new Date(toDateInclusive.getTime() + 24 * 60 * 60 * 1000);

    // ===== base filters (không áp date-range cho "tổng users", chỉ áp cho "new users" + series) =====
    const baseMatch = {};

    if (qRaw) {
      const rx = new RegExp(escapeRegex(qRaw), "i");
      baseMatch.$or = [
        { username: rx },
        { email: rx },
        { phone: rx },
        { "profile.nickname": rx },
        { "profile.address.country": rx },
        { "profile.address.city": rx },
        { "profile.address.district": rx },
        { "profile.address.ward": rx },
        { connectLocationLabel: rx },
      ];
    }

    if (goals.length) baseMatch["profile.goal"] = { $in: goals };
    if (sex.length) baseMatch["profile.sex"] = { $in: sex };

    // ===== helpers for bucket =====
    const bucketBy = (dateExpr) => {
      if (granularity === "month") {
        return { $dateToString: { format: "%Y-%m", date: dateExpr } };
      }
      if (granularity === "week") {
        // YYYY-Www
        return {
          $concat: [
            { $toString: { $isoWeekYear: dateExpr } },
            "-W",
            {
              $cond: [
                { $lt: [{ $isoWeek: dateExpr }, 10] },
                "0",
                "",
              ],
            },
            { $toString: { $isoWeek: dateExpr } },
          ],
        };
      }
      return { $dateToString: { format: "%Y-%m-%d", date: dateExpr } };
    };

    // ===== profile completeness condition (tuỳ bạn mở rộng) =====
    // “đầy đủ” = có nickname + sex + dob + heightCm + weightKg + goal
    const completeExpr = {
      $and: [
        { $ne: ["$profile.nickname", null] },
        { $ne: ["$profile.sex", null] },
        { $ne: ["$profile.dob", null] },
        { $ne: ["$profile.heightCm", null] },
        { $ne: ["$profile.weightKg", null] },
        { $ne: ["$profile.goal", null] },
      ],
    };

    // ===== active stamp: ưu tiên lastActiveAt, fallback lastLoginAt =====
    const activeStampExpr = { $ifNull: ["$lastActiveAt", "$lastLoginAt"] };

    // ===== active windows (DAU/WAU/MAU) dựa theo “toDateExclusive” =====
    const msDay = 24 * 60 * 60 * 1000;
    const dauFrom = new Date(toDateExclusive.getTime() - 1 * msDay);
    const wauFrom = new Date(toDateExclusive.getTime() - 7 * msDay);
    const mauFrom = new Date(toDateExclusive.getTime() - 30 * msDay);

    // ===== totalAll (toàn hệ thống, bỏ qua filter) =====
    const totalAllPromise = User.estimatedDocumentCount();

    // ===== aggregate 1 lần bằng facet =====
    const [agg, totalAll] = await Promise.all([
      User.aggregate([
        { $match: baseMatch },
        {
          $facet: {
            // totals (trong filter baseMatch)
            totalFiltered: [{ $count: "v" }],
            blockedFiltered: [{ $match: { blocked: true } }, { $count: "v" }],
            onboardedFiltered: [{ $match: { onboarded: true } }, { $count: "v" }],
            profileCompleteFiltered: [
              { $match: { $expr: completeExpr } },
              { $count: "v" },
            ],

            // new users trong range
            newUsersInRange: [
              { $match: { createdAt: { $gte: fromDate, $lt: toDateExclusive } } },
              { $count: "v" },
            ],

            // distributions ALL (trong baseMatch)
            distGoalAll: [
              { $group: { _id: "$profile.goal", v: { $sum: 1 } } },
              { $sort: { v: -1 } },
            ],
            distSexAll: [
              { $group: { _id: "$profile.sex", v: { $sum: 1 } } },
              { $sort: { v: -1 } },
            ],
            topCitiesAll: [
              { $addFields: { _city: { $ifNull: ["$profile.address.city", "$connectLocationLabel"] } } },
              { $addFields: { _city: { $trim: { input: { $ifNull: ["$_city", ""] } } } } },
              { $match: { _city: { $nin: ["", null] } } },
              { $group: { _id: "$_city", v: { $sum: 1 } } },
              { $sort: { v: -1 } },
              { $limit: 8 },
            ],

            // age buckets ALL (trong baseMatch)
            ageBucketsAll: [
              {
                $addFields: {
                  _dob: {
                    $dateFromString: {
                      dateString: "$profile.dob",
                      format: "%Y-%m-%d",
                      onError: null,
                      onNull: null,
                    },
                  },
                },
              },
              {
                $addFields: {
                  _age: {
                    $cond: [
                      { $ne: ["$_dob", null] },
                      { $dateDiff: { startDate: "$_dob", endDate: toDateExclusive, unit: "year" } },
                      null,
                    ],
                  },
                },
              },
              {
                $addFields: {
                  _bucket: {
                    $switch: {
                      branches: [
                        { case: { $and: [{ $ne: ["$_age", null] }, { $lt: ["$_age", 18] }] }, then: "<18" },
                        { case: { $and: [{ $gte: ["$_age", 18] }, { $lte: ["$_age", 21] }] }, then: "18-21" },
                        { case: { $and: [{ $gte: ["$_age", 22] }, { $lte: ["$_age", 27] }] }, then: "22-27" },
                        { case: { $and: [{ $gte: ["$_age", 28] }, { $lte: ["$_age", 35] }] }, then: "28-35" },
                        { case: { $and: [{ $gte: ["$_age", 36] }, { $lte: ["$_age", 45] }] }, then: "36-45" },
                        { case: { $and: [{ $ne: ["$_age", null] }, { $gt: ["$_age", 45] }] }, then: "45+" },
                      ],
                      default: "unknown",
                    },
                  },
                },
              },
              { $group: { _id: "$_bucket", v: { $sum: 1 } } },
              { $sort: { v: -1 } },
            ],

            // distributions NEW users trong range (để vẽ pie hợp lý theo khoảng thời gian)
            distGoalNew: [
              { $match: { createdAt: { $gte: fromDate, $lt: toDateExclusive } } },
              { $group: { _id: "$profile.goal", v: { $sum: 1 } } },
              { $sort: { v: -1 } },
            ],
            distSexNew: [
              { $match: { createdAt: { $gte: fromDate, $lt: toDateExclusive } } },
              { $group: { _id: "$profile.sex", v: { $sum: 1 } } },
              { $sort: { v: -1 } },
            ],

            // series: new users theo thời gian
            newUsersSeries: [
              { $match: { createdAt: { $gte: fromDate, $lt: toDateExclusive } } },
              { $group: { _id: bucketBy("$createdAt"), v: { $sum: 1 } } },
              { $sort: { _id: 1 } },
            ],

            // series: active users theo thời gian (dựa trên lastActiveAt/lastLoginAt)
            activeUsersSeries: [
              { $addFields: { _activeAt: activeStampExpr } },
              { $match: { _activeAt: { $gte: fromDate, $lt: toDateExclusive } } },
              { $group: { _id: bucketBy("$_activeAt"), v: { $sum: 1 } } },
              { $sort: { _id: 1 } },
            ],

            // DAU/WAU/MAU (đếm user có active stamp trong cửa sổ)
            dau: [
              { $addFields: { _activeAt: activeStampExpr } },
              { $match: { _activeAt: { $gte: dauFrom, $lt: toDateExclusive } } },
              { $count: "v" },
            ],
            wau: [
              { $addFields: { _activeAt: activeStampExpr } },
              { $match: { _activeAt: { $gte: wauFrom, $lt: toDateExclusive } } },
              { $count: "v" },
            ],
            mau: [
              { $addFields: { _activeAt: activeStampExpr } },
              { $match: { _activeAt: { $gte: mauFrom, $lt: toDateExclusive } } },
              { $count: "v" },
            ],
          },
        },
      ]),
      totalAllPromise,
    ]);

    const out = (agg && agg[0]) || {};
    const pickCount = (arr) => (Array.isArray(arr) && arr[0] ? Number(arr[0].v || 0) : 0);
    const mapKV = (arr) =>
      (Array.isArray(arr) ? arr : [])
        .map((x) => ({ key: x?._id ?? "unknown", value: Number(x?.v || 0) }))
        .filter((x) => x.value > 0);

    const totalFiltered = pickCount(out.totalFiltered);
    const blockedFiltered = pickCount(out.blockedFiltered);
    const onboardedFiltered = pickCount(out.onboardedFiltered);
    const profileCompleteFiltered = pickCount(out.profileCompleteFiltered);
    const newUsersInRange = pickCount(out.newUsersInRange);

    const dau = pickCount(out.dau);
    const wau = pickCount(out.wau);
    const mau = pickCount(out.mau);

    const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0); // 1 decimal

    const distGoalAll = mapKV(out.distGoalAll);
    const distSexAll = mapKV(out.distSexAll);
    const distGoalNew = mapKV(out.distGoalNew);
    const distSexNew = mapKV(out.distSexNew);

    const ageBucketsAll = mapKV(out.ageBucketsAll);
    const topCitiesAll = mapKV(out.topCitiesAll);

    const newUsersSeries = (out.newUsersSeries || []).map((x) => ({ t: x._id, v: Number(x.v || 0) }));
    const activeUsersSeries = (out.activeUsersSeries || []).map((x) => ({ t: x._id, v: Number(x.v || 0) }));

    // top segments (cho SimpleTopTable)
    const topGoal = distGoalAll[0]?.key || "—";
    const topSex = distSexAll[0]?.key || "—";
    const topAge = ageBucketsAll.find((x) => x.key !== "unknown")?.key || "—";
    const topCity = topCitiesAll[0]?.key || "—";

    const topSegments = [
      { name: `Goal: ${topGoal}`, value: distGoalAll[0]?.value ?? "—", note: "Phân khúc phổ biến" },
      { name: `Sex: ${topSex}`, value: distSexAll[0]?.value ?? "—", note: "Tỷ lệ theo giới tính" },
      { name: `Age: ${topAge}`, value: ageBucketsAll.find((x) => x.key === topAge)?.value ?? "—", note: "Nhóm tuổi nổi bật" },
      { name: `City: ${topCity}`, value: topCitiesAll[0]?.value ?? "—", note: "Khu vực top" },
    ];

    return res.json({
      success: true,
      data: {
        query: {
          from: fromDate.toISOString().slice(0, 10),
          to: toDateInclusive.toISOString().slice(0, 10),
          granularity,
          q: qRaw,
          goals,
          sex,
        },
        kpis: {
          totalAll,
          totalFiltered,
          newUsersInRange,
          blockedFiltered,
          onboardedFiltered,
          onboardedRate: pct(onboardedFiltered, totalFiltered),
          profileCompleteFiltered,
          profileCompleteRate: pct(profileCompleteFiltered, totalFiltered),
          active: { dau, wau, mau, basis: "lastActiveAt||lastLoginAt" },
        },
        series: {
          newUsers: newUsersSeries,
          activeUsers: activeUsersSeries,
        },
        distributions: {
          goalAll: distGoalAll,
          sexAll: distSexAll,
          goalNew: distGoalNew,
          sexNew: distSexNew,
          ageAll: ageBucketsAll,
          cityAll: topCitiesAll,
        },
        topSegments,
      },
    });
  } catch (e) {
    console.error("[admin.stats.users]", e);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
});

/* ======================= Stats: NUTRITION ======================= */
/**
 * GET /api/admin/stats/nutrition
 * Query:
 *  - from=YYYY-MM-DD
 *  - to=YYYY-MM-DD
 *  - granularity=day|week|month
 *  - q=search food name (optional)
 *  - top=top foods limit (optional, default 8)
 */
router.get("/stats/nutrition", adminAuth, async (req, res) => {
  try {
    const qRaw = String(req.query?.q ?? "").trim();
    const granularityRaw = String(req.query?.granularity ?? "day").trim().toLowerCase();
    const granularity = ["day", "week", "month"].includes(granularityRaw) ? granularityRaw : "day";
    const top = Math.min(Math.max(Number(req.query?.top ?? 8) || 8, 3), 20);

    const parseYMD = (s) => {
      const str = String(s || "").trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(str) ? str : null;
    };

    // default last 30 days (string YYYY-MM-DD)
    const todayStr = dayjs().format("YYYY-MM-DD");
    const fromStr = parseYMD(req.query?.from) || dayjs(todayStr).subtract(29, "day").format("YYYY-MM-DD");
    const toStr = parseYMD(req.query?.to) || todayStr;

    const qRegex = qRaw ? new RegExp(escapeRegex(qRaw), "i") : null;

    // ===== bucket helper (NutritionLog.date là string) =====
    const bucketStages = (() => {
      if (granularity === "month") {
        return [{ $addFields: { bucket: { $substrCP: ["$date", 0, 7] } } }]; // YYYY-MM
      }
      if (granularity === "week") {
        return [
          {
            $addFields: {
              dt: { $dateFromString: { dateString: "$date", format: "%Y-%m-%d" } },
            },
          },
          {
            $addFields: {
              isoYear: { $isoWeekYear: "$dt" },
              isoWeek: { $isoWeek: "$dt" },
            },
          },
          {
            $addFields: {
              bucket: {
                $concat: [
                  { $toString: "$isoYear" },
                  "-W",
                  {
                    $cond: [
                      { $lt: ["$isoWeek", 10] },
                      { $concat: ["0", { $toString: "$isoWeek" }] },
                      { $toString: "$isoWeek" },
                    ],
                  },
                ],
              },
            },
          },
        ];
      }
      // day
      return [{ $addFields: { bucket: "$date" } }];
    })();

    // ===== Aggregate logs (lookup Food để tính kcal/macro theo qty & mass ratio) =====
    const agg = await NutritionLog.aggregate([
      { $match: { date: { $gte: fromStr, $lte: toStr } } },

      {
        $lookup: {
          from: "foods",
          localField: "food",
          foreignField: "_id",
          as: "foodDoc",
        },
      },
      { $unwind: { path: "$foodDoc", preserveNullAndEmptyArrays: true } },

      ...(qRegex ? [{ $match: { "foodDoc.name": { $regex: qRegex } } }] : []),

      {
        $addFields: {
          qty: { $ifNull: ["$quantity", 1] },
          baseMass: { $ifNull: ["$foodDoc.massG", 0] },
          chosenMass: {
            $ifNull: ["$massG", { $ifNull: ["$foodDoc.massG", 0] }],
          },
        },
      },
      {
        $addFields: {
          ratio: {
            $cond: [
              { $gt: ["$baseMass", 0] },
              { $divide: ["$chosenMass", "$baseMass"] },
              1,
            ],
          },
        },
      },
      {
        $addFields: {
          mult: { $multiply: ["$qty", "$ratio"] },
          kcalN: { $multiply: [{ $ifNull: ["$foodDoc.kcal", 0] }, "$mult"] },
          proteinN: { $multiply: [{ $ifNull: ["$foodDoc.proteinG", 0] }, "$mult"] },
          carbN: { $multiply: [{ $ifNull: ["$foodDoc.carbG", 0] }, "$mult"] },
          fatN: { $multiply: [{ $ifNull: ["$foodDoc.fatG", 0] }, "$mult"] },
        },
      },

      {
        $facet: {
          kpis: [
            {
              $group: {
                _id: null,
                totalLogs: { $sum: 1 },
                totalKcal: { $sum: "$kcalN" },
                totalProteinG: { $sum: "$proteinN" },
                totalCarbG: { $sum: "$carbN" },
                totalFatG: { $sum: "$fatN" },
                users: { $addToSet: "$user" },
                userDaySet: {
                  $addToSet: { $concat: [{ $toString: "$user" }, "|", "$date"] },
                },
              },
            },
            {
              $addFields: {
                usersWithLogs: { $size: "$users" },
                userDays: { $size: "$userDaySet" },
              },
            },
            {
              $project: {
                _id: 0,
                totalLogs: 1,
                usersWithLogs: 1,
                totalKcal: 1,
                totalProteinG: 1,
                totalCarbG: 1,
                totalFatG: 1,
                userDays: 1,
              },
            },
          ],

          kcalSeries: [
            ...bucketStages,
            { $group: { _id: "$bucket", v: { $sum: "$kcalN" } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, t: "$_id", v: { $round: ["$v", 0] } } },
          ],

          topFoods: [
            {
              $group: {
                _id: "$food",
                name: { $first: "$foodDoc.name" },
                count: { $sum: 1 },
                totalKcal: { $sum: "$kcalN" },
              },
            },
            { $sort: { count: -1 } },
            { $limit: top },
            {
              $project: {
                _id: 0,
                name: { $ifNull: ["$name", "(Không tên)"] },
                count: 1,
                totalKcal: { $round: ["$totalKcal", 0] },
              },
            },
          ],
        },
      },
    ]);

    const out = agg?.[0] || {};
    const k = out.kpis?.[0] || {
      totalLogs: 0,
      usersWithLogs: 0,
      totalKcal: 0,
      totalProteinG: 0,
      totalCarbG: 0,
      totalFatG: 0,
      userDays: 0,
    };

    const userDays = Number(k.userDays || 0);
    const avgKcalPerUserDay = userDays > 0 ? Number(k.totalKcal || 0) / userDays : 0;
    const avgProteinPerUserDay = userDays > 0 ? Number(k.totalProteinG || 0) / userDays : 0;

    // ===== Food status (global, có thể lọc theo q tên food) =====
    const foodMatch = qRegex ? { name: { $regex: qRegex } } : {};
    const foodStatusAgg = await Food.aggregate([
      { $match: foodMatch },
      { $group: { _id: "$status", value: { $sum: 1 } } },
      { $project: { _id: 0, key: "$_id", value: 1 } },
    ]);

    const mapStatus = new Map(foodStatusAgg.map((x) => [String(x.key), Number(x.value || 0)]));
    const foodsPending = mapStatus.get("pending") || 0;
    const foodsApproved = mapStatus.get("approved") || 0;
    const foodsRejected = mapStatus.get("rejected") || 0;

    // ===== SuggestMenu saves (global, có thể lọc theo q tên thực đơn) =====
    const smMatch = qRegex ? { name: { $regex: qRegex } } : {};
    const savesAgg = await SuggestMenu.aggregate([
      { $match: smMatch },
      { $project: { savedCount: { $size: { $ifNull: ["$savedBy", []] } } } },
      { $group: { _id: null, total: { $sum: "$savedCount" } } },
      { $project: { _id: 0, total: 1 } },
    ]);
    const suggestMenuSaves = Number(savesAgg?.[0]?.total || 0);

    const macrosBars = [
      { t: "Protein", v: Math.round(Number(k.totalProteinG || 0)) },
      { t: "Carb", v: Math.round(Number(k.totalCarbG || 0)) },
      { t: "Fat", v: Math.round(Number(k.totalFatG || 0)) },
    ];

    const topFoodsTable = (out.topFoods || []).map((x) => ({
      name: x?.name || "(Không tên)",
      value: Number(x?.count || 0),
      note: `${Number(x?.totalKcal || 0)} kcal`,
    }));

    return res.json({
      success: true,
      data: {
        query: {
          from: fromStr,
          to: toStr,
          granularity,
          q: qRaw,
          top,
        },
        kpis: {
          totalLogs: Number(k.totalLogs || 0),
          usersWithLogs: Number(k.usersWithLogs || 0),
          avgKcalPerUserDay: Math.round(avgKcalPerUserDay || 0),
          avgProteinPerUserDay: Math.round(avgProteinPerUserDay || 0),

          foodsPending,
          foodsApproved,
          foodsRejected,

          suggestMenuSaves,
          aiScans: 0, // chưa tracking
        },
        series: {
          kcalLogged: out.kcalSeries || [], // [{t,v}]
        },
        macros: {
          bars: macrosBars, // [{t,v}]
        },
        distributions: {
          foodStatus: foodStatusAgg, // [{key,value}]
        },
        topFoods: topFoodsTable, // [{name,value,note}]
      },
    });
  } catch (e) {
    console.error("[admin.stats.nutrition]", e);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
});

/* ======================= Stats: WORKOUTS ======================= */
/**
 * GET /api/admin/stats/workouts
 * Query:
 *  - from=YYYY-MM-DD
 *  - to=YYYY-MM-DD
 *  - granularity=day|week|month
 *  - q=search plan name OR exerciseName (optional)
 *  - top=top exercises limit (default 8)
 */
router.get("/stats/workouts", adminAuth, async (req, res) => {
  try {
    const qRaw = String(req.query?.q ?? "").trim();
    const granularityRaw = String(req.query?.granularity ?? "day").trim().toLowerCase();
    const granularity = ["day", "week", "month"].includes(granularityRaw) ? granularityRaw : "day";
    const top = Math.min(Math.max(Number(req.query?.top ?? 8) || 8, 3), 20);

    const parseYMD = (s) => {
      const str = String(s || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
      const d = new Date(str + "T00:00:00.000Z");
      return Number.isNaN(d.getTime()) ? null : d;
    };

    // default last 30 days (UTC)
    const now = new Date();
    const fromQ = parseYMD(req.query?.from);
    const toQ = parseYMD(req.query?.to);

    const fromDate = fromQ || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
    const toDateInclusive = toQ || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const toDateExclusive = new Date(toDateInclusive.getTime() + 24 * 60 * 60 * 1000);

    const rx = qRaw ? new RegExp(escapeRegex(qRaw), "i") : null;

    // chỉ lấy plan chưa archived
    const baseMatch = { status: { $ne: "archived" } };

    if (rx) {
      baseMatch.$or = [
        { name: rx },
        { "items.exerciseName": rx },
      ];
    }

    const bucketBy = (dateExpr) => {
      if (granularity === "month") {
        return { $dateToString: { format: "%Y-%m", date: dateExpr } };
      }
      if (granularity === "week") {
        return {
          $concat: [
            { $toString: { $isoWeekYear: dateExpr } },
            "-W",
            {
              $cond: [{ $lt: [{ $isoWeek: dateExpr }, 10] }, "0", ""],
            },
            { $toString: { $isoWeek: dateExpr } },
          ],
        };
      }
      return { $dateToString: { format: "%Y-%m-%d", date: dateExpr } };
    };

    // ===== WorkoutPlan stats trong khoảng thời gian =====
    const [agg, exMeta, spMeta] = await Promise.all([
      WorkoutPlan.aggregate([
        {
          $match: {
            ...baseMatch,
            createdAt: { $gte: fromDate, $lt: toDateExclusive },
          },
        },
        {
          $facet: {
            kpis: [
              {
                $group: {
                  _id: null,
                  totalPlans: { $sum: 1 },
                  users: { $addToSet: "$user" },

                  totalKcal: { $sum: { $ifNull: ["$totals.kcal", 0] } },
                  totalExercises: { $sum: { $ifNull: ["$totals.exercises", 0] } },
                  totalSets: { $sum: { $ifNull: ["$totals.sets", 0] } },
                  totalReps: { $sum: { $ifNull: ["$totals.reps", 0] } },

                  totalSaved: {
                    $sum: { $size: { $ifNull: ["$savedBy", []] } },
                  },
                },
              },
              {
                $addFields: {
                  usersWithPlans: { $size: "$users" },
                  avgPlansPerUser: {
                    $cond: [
                      { $gt: [{ $size: "$users" }, 0] },
                      { $divide: ["$totalPlans", { $size: "$users" }] },
                      0,
                    ],
                  },
                  avgKcalPerPlan: {
                    $cond: [
                      { $gt: ["$totalPlans", 0] },
                      { $divide: ["$totalKcal", "$totalPlans"] },
                      0,
                    ],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  totalPlans: 1,
                  usersWithPlans: 1,
                  avgPlansPerUser: 1,
                  totalKcal: 1,
                  avgKcalPerPlan: 1,
                  totalExercises: 1,
                  totalSets: 1,
                  totalReps: 1,
                  totalSaved: 1,
                },
              },
            ],

            plansSeries: [
              { $group: { _id: bucketBy("$createdAt"), v: { $sum: 1 } } },
              { $sort: { _id: 1 } },
              { $project: { _id: 0, t: "$_id", v: 1 } },
            ],

            kcalSeries: [
              { $group: { _id: bucketBy("$createdAt"), v: { $sum: { $ifNull: ["$totals.kcal", 0] } } } },
              { $sort: { _id: 1 } },
              { $project: { _id: 0, t: "$_id", v: { $round: ["$v", 0] } } },
            ],

            itemTypes: [
              { $unwind: { path: "$items", preserveNullAndEmptyArrays: false } },
              {
                $group: {
                  _id: "$items.type",
                  value: { $sum: 1 },
                },
              },
              { $sort: { value: -1 } },
              { $project: { _id: 0, key: "$_id", value: 1 } },
            ],

            topExercises: [
              { $unwind: { path: "$items", preserveNullAndEmptyArrays: false } },
              {
                $addFields: {
                  _setCount: { $size: { $ifNull: ["$items.sets", []] } },
                  _reps: {
                    $reduce: {
                      input: { $ifNull: ["$items.sets", []] },
                      initialValue: 0,
                      in: { $add: ["$$value", { $ifNull: ["$$this.reps", 0] }] },
                    },
                  },
                  _kcalEst: {
                    $multiply: [
                      {
                        $reduce: {
                          input: { $ifNull: ["$items.sets", []] },
                          initialValue: 0,
                          in: { $add: ["$$value", { $ifNull: ["$$this.reps", 0] }] },
                        },
                      },
                      { $ifNull: ["$items.caloriePerRep", 0] },
                    ],
                  },
                },
              },
              {
                $group: {
                  _id: "$items.exerciseName",
                  count: { $sum: 1 },
                  reps: { $sum: "$_reps" },
                  sets: { $sum: "$_setCount" },
                  kcalEst: { $sum: "$_kcalEst" },
                },
              },
              { $sort: { count: -1 } },
              { $limit: top },
              {
                $project: {
                  _id: 0,
                  name: { $ifNull: ["$_id", "(Không tên)"] },
                  value: "$count",
                  note: {
                    $concat: [
                      { $toString: "$sets" }, " sets • ",
                      { $toString: "$reps" }, " reps • ~",
                      { $toString: { $round: ["$kcalEst", 0] } }, " kcal",
                    ],
                  },
                },
              },
            ],
          },
        },
      ]),

      // ===== Exercise catalog meta (global) =====
      Exercise.aggregate([
        {
          $facet: {
            byStatus: [
              { $group: { _id: "$status", v: { $sum: 1 } } },
              { $project: { _id: 0, key: "$_id", value: "$v" } },
            ],
            byType: [
              { $group: { _id: "$type", v: { $sum: 1 } } },
              { $project: { _id: 0, key: "$_id", value: "$v" } },
            ],
            total: [{ $count: "v" }],
          },
        },
      ]),

      // ===== SuggestPlan meta (global) =====
      SuggestPlan.aggregate([
        {
          $facet: {
            byStatus: [
              { $group: { _id: "$status", v: { $sum: 1 } } },
              { $project: { _id: 0, key: "$_id", value: "$v" } },
            ],
            saves: [
              { $project: { savedCount: { $size: { $ifNull: ["$savedBy", []] } } } },
              { $group: { _id: null, total: { $sum: "$savedCount" } } },
              { $project: { _id: 0, total: 1 } },
            ],
            total: [{ $count: "v" }],
          },
        },
      ]),
    ]);

    const out = agg?.[0] || {};
    const k = out.kpis?.[0] || {
      totalPlans: 0,
      usersWithPlans: 0,
      avgPlansPerUser: 0,
      totalKcal: 0,
      avgKcalPerPlan: 0,
      totalExercises: 0,
      totalSets: 0,
      totalReps: 0,
      totalSaved: 0,
    };

    const itemTypes = Array.isArray(out.itemTypes) ? out.itemTypes : [];
    const mapType = new Map(itemTypes.map((x) => [String(x.key), Number(x.value || 0)]));
    const strengthCount = mapType.get("Strength") || 0;
    const cardioCount = mapType.get("Cardio") || 0;
    const sportCount = mapType.get("Sport") || 0;

    const exOut = exMeta?.[0] || {};
    const exTotal = (Array.isArray(exOut.total) && exOut.total[0] ? Number(exOut.total[0].v || 0) : 0);
    const exByStatus = Array.isArray(exOut.byStatus) ? exOut.byStatus : [];

    const spOut = spMeta?.[0] || {};
    const spTotal = (Array.isArray(spOut.total) && spOut.total[0] ? Number(spOut.total[0].v || 0) : 0);
    const spSaves = Number(spOut?.saves?.[0]?.total || 0);

    return res.json({
      success: true,
      data: {
        query: {
          from: fromDate.toISOString().slice(0, 10),
          to: toDateInclusive.toISOString().slice(0, 10),
          granularity,
          q: qRaw,
          top,
        },
        kpis: {
          totalPlans: Number(k.totalPlans || 0),
          usersWithPlans: Number(k.usersWithPlans || 0),
          avgPlansPerUser: Math.round(Number(k.avgPlansPerUser || 0) * 10) / 10,

          totalKcal: Math.round(Number(k.totalKcal || 0)),
          avgKcalPerPlan: Math.round(Number(k.avgKcalPerPlan || 0)),

          totalExercises: Number(k.totalExercises || 0),
          totalSets: Number(k.totalSets || 0),
          totalReps: Number(k.totalReps || 0),

          savedPlans: Number(k.totalSaved || 0),

          // type counts (theo items)
          strengthCount,
          cardioCount,
          sportCount,

          // global catalog meta (để KPI/ghi chú nếu muốn)
          exerciseCatalogTotal: exTotal,
          exerciseCatalogByStatus: exByStatus,
          suggestPlanTotal: spTotal,
          suggestPlanSaves: spSaves,
        },
        series: {
          plansCreated: out.plansSeries || [],
          kcalBurned: out.kcalSeries || [],
        },
        distributions: {
          itemTypes, // [{key,value}]
        },
        topExercises: out.topExercises || [], // [{name,value,note}]
      },
    });
  } catch (e) {
    console.error("[admin.stats.workouts]", e);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
});

/* ======================= Stats: CONNECT ======================= */
/**
 * GET /api/admin/stats/connect
 * Query:
 *  - from=YYYY-MM-DD
 *  - to=YYYY-MM-DD
 *  - granularity=day|week|month
 *  - q=search text (room name/location/goal, request meta, report snapshot...)
 *  - top=top list limit (default 8)
 */
router.get("/stats/connect", adminAuth, async (req, res) => {
  try {
    const qRaw = String(req.query?.q ?? "").trim();
    const granularityRaw = String(req.query?.granularity ?? "day").trim().toLowerCase();
    const granularity = ["day", "week", "month"].includes(granularityRaw) ? granularityRaw : "day";
    const top = Math.min(Math.max(Number(req.query?.top ?? 8) || 8, 3), 20);

    const parseYMD = (s) => {
      const str = String(s || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
      const d = new Date(str + "T00:00:00.000Z");
      return Number.isNaN(d.getTime()) ? null : d;
    };

    // default last 30 days (UTC)
    const now = new Date();
    const fromQ = parseYMD(req.query?.from);
    const toQ = parseYMD(req.query?.to);

    const fromDate = fromQ || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
    const toDateInclusive = toQ || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const toDateExclusive = new Date(toDateInclusive.getTime() + 24 * 60 * 60 * 1000);

    const rx = qRaw ? new RegExp(escapeRegex(qRaw), "i") : null;

    const bucketBy = (dateExpr) => {
      if (granularity === "month") {
        return { $dateToString: { format: "%Y-%m", date: dateExpr } };
      }
      if (granularity === "week") {
        return {
          $concat: [
            { $toString: { $isoWeekYear: dateExpr } },
            "-W",
            { $cond: [{ $lt: [{ $isoWeek: dateExpr }, 10] }, "0", ""] },
            { $toString: { $isoWeek: dateExpr } },
          ],
        };
      }
      return { $dateToString: { format: "%Y-%m-%d", date: dateExpr } };
    };

    // =========================
    // 1) ROOMS (duo/group/dm)
    // =========================
    const roomMatch = {
      createdAt: { $gte: fromDate, $lt: toDateExclusive },
      type: { $in: ["duo", "group", "dm"] },
    };

    if (rx) {
      roomMatch.$or = [
        { name: rx },
        { description: rx },
        { locationLabel: rx },
        { goalLabel: rx },
        { goalKey: rx },
        { joinPolicy: rx },
        { status: rx },
      ];
    }

    const roomsAggPromise = MatchRoom.aggregate([
      { $match: roomMatch },
      {
        $addFields: {
          membersCount: { $size: { $ifNull: ["$members", []] } },
        },
      },
      {
        $facet: {
          kpis: [
            {
              $group: {
                _id: null,
                totalRooms: { $sum: 1 },

                duoRooms: { $sum: { $cond: [{ $eq: ["$type", "duo"] }, 1, 0] } },
                groupRooms: { $sum: { $cond: [{ $eq: ["$type", "group"] }, 1, 0] } },
                dmRooms: { $sum: { $cond: [{ $eq: ["$type", "dm"] }, 1, 0] } },

                activeRooms: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
                fullRooms: { $sum: { $cond: [{ $eq: ["$status", "full"] }, 1, 0] } },
                closedRooms: { $sum: { $cond: [{ $eq: ["$status", "closed"] }, 1, 0] } },

                totalMembers: { $sum: "$membersCount" },
                avgMembers: { $avg: "$membersCount" },
                avgMaxMembers: { $avg: { $ifNull: ["$maxMembers", 0] } },

                openJoin: { $sum: { $cond: [{ $eq: ["$joinPolicy", "open"] }, 1, 0] } },
                requestJoin: { $sum: { $cond: [{ $eq: ["$joinPolicy", "request"] }, 1, 0] } },
              },
            },
            {
              $project: {
                _id: 0,
                totalRooms: 1,
                duoRooms: 1,
                groupRooms: 1,
                dmRooms: 1,
                activeRooms: 1,
                fullRooms: 1,
                closedRooms: 1,
                totalMembers: 1,
                avgMembers: 1,
                avgMaxMembers: 1,
                openJoin: 1,
                requestJoin: 1,
              },
            },
          ],

          roomsCreatedSeries: [
            { $group: { _id: bucketBy("$createdAt"), v: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, t: "$_id", v: 1 } },
          ],

          membersSeries: [
            { $group: { _id: bucketBy("$createdAt"), v: { $sum: "$membersCount" } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, t: "$_id", v: 1 } },
          ],

          distRoomType: [
            { $group: { _id: "$type", value: { $sum: 1 } } },
            { $project: { _id: 0, key: "$_id", value: 1 } },
            { $sort: { value: -1 } },
          ],
          distRoomStatus: [
            { $group: { _id: "$status", value: { $sum: 1 } } },
            { $project: { _id: 0, key: "$_id", value: 1 } },
            { $sort: { value: -1 } },
          ],
          distJoinPolicy: [
            { $match: { type: "group" } },
            { $group: { _id: "$joinPolicy", value: { $sum: 1 } } },
            { $project: { _id: 0, key: "$_id", value: 1 } },
            { $sort: { value: -1 } },
          ],

          topGroupsByMembers: [
            { $match: { type: "group" } },
            { $sort: { membersCount: -1, updatedAt: -1 } },
            { $limit: top },
            {
              $project: {
                _id: 0,
                name: { $ifNull: ["$name", "Nhóm tập luyện"] },
                value: "$membersCount",
                note: {
                  $concat: [
                    "Max ",
                    { $toString: { $ifNull: ["$maxMembers", 5] } },
                    " • ",
                    { $ifNull: ["$locationLabel", "—"] },
                  ],
                },
              },
            },
          ],
        },
      },
    ]);

    // =========================
    // 2) REQUESTS
    // =========================
    const reqMatch = { createdAt: { $gte: fromDate, $lt: toDateExclusive } };
    if (rx) {
      reqMatch.$or = [
        { message: rx },
        { "meta.fromNickname": rx },
        { "meta.fromGoalLabel": rx },
        { status: rx },
        { type: rx },
      ];
    }

    const requestsAggPromise = MatchRequest.aggregate([
      { $match: reqMatch },
      {
        $addFields: {
          _resolvedMs: {
            $cond: [
              { $and: [{ $ne: ["$resolvedAt", null] }, { $ne: ["$createdAt", null] }] },
              { $subtract: ["$resolvedAt", "$createdAt"] },
              null,
            ],
          },
        },
      },
      {
        $facet: {
          kpis: [
            {
              $group: {
                _id: null,
                totalRequests: { $sum: 1 },

                duoRequests: { $sum: { $cond: [{ $eq: ["$type", "duo"] }, 1, 0] } },
                groupRequests: { $sum: { $cond: [{ $eq: ["$type", "group"] }, 1, 0] } },

                pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
                accepted: { $sum: { $cond: [{ $eq: ["$status", "accepted"] }, 1, 0] } },
                rejected: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
                cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
                expired: { $sum: { $cond: [{ $eq: ["$status", "expired"] }, 1, 0] } },

                avgResolveMs: { $avg: "$_resolvedMs" },
              },
            },
            {
              $addFields: {
                acceptanceRate: {
                  $cond: [
                    { $gt: [{ $add: ["$accepted", "$rejected"] }, 0] },
                    { $divide: ["$accepted", { $add: ["$accepted", "$rejected"] }] },
                    0,
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                totalRequests: 1,
                duoRequests: 1,
                groupRequests: 1,
                pending: 1,
                accepted: 1,
                rejected: 1,
                cancelled: 1,
                expired: 1,
                acceptanceRate: 1,
                avgResolveMs: 1,
              },
            },
          ],

          requestsCreatedSeries: [
            { $group: { _id: bucketBy("$createdAt"), v: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, t: "$_id", v: 1 } },
          ],

          distRequestType: [
            { $group: { _id: "$type", value: { $sum: 1 } } },
            { $project: { _id: 0, key: "$_id", value: 1 } },
            { $sort: { value: -1 } },
          ],
          distRequestStatus: [
            { $group: { _id: "$status", value: { $sum: 1 } } },
            { $project: { _id: 0, key: "$_id", value: 1 } },
            { $sort: { value: -1 } },
          ],
        },
      },
    ]);

    // =========================
    // 3) REPORTS
    // =========================
    const reportMatch = { createdAt: { $gte: fromDate, $lt: toDateExclusive } };
    if (rx) {
      reportMatch.$or = [
        { otherReason: rx },
        { note: rx },
        { adminNote: rx },
        { "snapshot.nickname": rx },
        { "snapshot.name": rx },
        { "snapshot.locationLabel": rx },
      ];
    }

    const reportsAggPromise = ConnectReport.aggregate([
      { $match: reportMatch },
      {
        $facet: {
          kpis: [
            {
              $group: {
                _id: null,
                totalReports: { $sum: 1 },
                pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
                reviewed: { $sum: { $cond: [{ $eq: ["$status", "reviewed"] }, 1, 0] } },
                dismissed: { $sum: { $cond: [{ $eq: ["$status", "dismissed"] }, 1, 0] } },
                userReports: { $sum: { $cond: [{ $eq: ["$targetType", "user"] }, 1, 0] } },
                groupReports: { $sum: { $cond: [{ $eq: ["$targetType", "group"] }, 1, 0] } },
              },
            },
            { $project: { _id: 0, totalReports: 1, pending: 1, reviewed: 1, dismissed: 1, userReports: 1, groupReports: 1 } },
          ],

          reportsCreatedSeries: [
            { $group: { _id: bucketBy("$createdAt"), v: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, t: "$_id", v: 1 } },
          ],

          distReportTarget: [
            { $group: { _id: "$targetType", value: { $sum: 1 } } },
            { $project: { _id: 0, key: "$_id", value: 1 } },
            { $sort: { value: -1 } },
          ],
          distReportStatus: [
            { $group: { _id: "$status", value: { $sum: 1 } } },
            { $project: { _id: 0, key: "$_id", value: 1 } },
            { $sort: { value: -1 } },
          ],

          topReasons: [
            { $unwind: { path: "$reasons", preserveNullAndEmptyArrays: true } },
            { $group: { _id: { $ifNull: ["$reasons", "unknown"] }, value: { $sum: 1 } } },
            { $sort: { value: -1 } },
            { $limit: top },
            { $project: { _id: 0, key: "$_id", value: 1 } },
          ],
        },
      },
    ]);

    // =========================
    // 4) CHAT ACTIVITY (duo/group only via lookup MatchRoom)
    // =========================
    const chatAggPromise = ChatMessage.aggregate([
      { $match: { createdAt: { $gte: fromDate, $lt: toDateExclusive } } },
      {
        $lookup: {
          from: "matchrooms",
          localField: "conversationId",
          foreignField: "_id",
          as: "room",
        },
      },
      { $unwind: { path: "$room", preserveNullAndEmptyArrays: false } },
      { $match: { "room.type": { $in: ["duo", "group"] } } },
      {
        $addFields: {
          _hasImage: {
            $gt: [{ $size: { $ifNull: ["$attachments", []] } }, 0],
          },
        },
      },
      {
        $facet: {
          kpis: [
            {
              $group: {
                _id: null,
                totalMessages: { $sum: 1 },
                imageMessages: { $sum: { $cond: ["$_hasImage", 1, 0] } },
                convSet: { $addToSet: "$conversationId" },
              },
            },
            {
              $addFields: {
                activeConversations: { $size: "$convSet" },
              },
            },
            { $project: { _id: 0, totalMessages: 1, imageMessages: 1, activeConversations: 1 } },
          ],
          messagesSeries: [
            { $group: { _id: bucketBy("$createdAt"), v: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, t: "$_id", v: 1 } },
          ],
          distRoomTypeByMessages: [
            { $group: { _id: "$room.type", value: { $sum: 1 } } },
            { $project: { _id: 0, key: "$_id", value: 1 } },
            { $sort: { value: -1 } },
          ],
        },
      },
    ]);

    const [roomsAgg, reqAgg, repAgg, chatAgg] = await Promise.all([
      roomsAggPromise,
      requestsAggPromise,
      reportsAggPromise,
      chatAggPromise,
    ]);

    const roomsOut = roomsAgg?.[0] || {};
    const reqOut = reqAgg?.[0] || {};
    const repOut = repAgg?.[0] || {};
    const chatOut = chatAgg?.[0] || {};

    const roomsK = roomsOut.kpis?.[0] || {};
    const reqK = reqOut.kpis?.[0] || {};
    const repK = repOut.kpis?.[0] || {};
    const chatK = chatOut.kpis?.[0] || {};

    const avgResolveHours = Number(reqK.avgResolveMs || 0) > 0 ? (Number(reqK.avgResolveMs) / 3600000) : 0;

    return res.json({
      success: true,
      data: {
        query: {
          from: fromDate.toISOString().slice(0, 10),
          to: toDateInclusive.toISOString().slice(0, 10),
          granularity,
          q: qRaw,
          top,
        },

        kpis: {
          rooms: {
            total: Number(roomsK.totalRooms || 0),
            duo: Number(roomsK.duoRooms || 0),
            group: Number(roomsK.groupRooms || 0),
            dm: Number(roomsK.dmRooms || 0),
            active: Number(roomsK.activeRooms || 0),
            full: Number(roomsK.fullRooms || 0),
            closed: Number(roomsK.closedRooms || 0),
            totalMembers: Number(roomsK.totalMembers || 0),
            avgMembers: Math.round(Number(roomsK.avgMembers || 0) * 10) / 10,
            avgMaxMembers: Math.round(Number(roomsK.avgMaxMembers || 0) * 10) / 10,
            joinPolicyOpen: Number(roomsK.openJoin || 0),
            joinPolicyRequest: Number(roomsK.requestJoin || 0),
          },

          requests: {
            total: Number(reqK.totalRequests || 0),
            duo: Number(reqK.duoRequests || 0),
            group: Number(reqK.groupRequests || 0),
            pending: Number(reqK.pending || 0),
            accepted: Number(reqK.accepted || 0),
            rejected: Number(reqK.rejected || 0),
            cancelled: Number(reqK.cancelled || 0),
            expired: Number(reqK.expired || 0),
            acceptanceRate: Math.round(Number(reqK.acceptanceRate || 0) * 1000) / 10, // %
            avgResolveHours: Math.round(avgResolveHours * 10) / 10,
          },

          reports: {
            total: Number(repK.totalReports || 0),
            pending: Number(repK.pending || 0),
            reviewed: Number(repK.reviewed || 0),
            dismissed: Number(repK.dismissed || 0),
            user: Number(repK.userReports || 0),
            group: Number(repK.groupReports || 0),
          },

          chat: {
            totalMessages: Number(chatK.totalMessages || 0),
            imageMessages: Number(chatK.imageMessages || 0),
            activeConversations: Number(chatK.activeConversations || 0),
          },
        },

        series: {
          roomsCreated: roomsOut.roomsCreatedSeries || [],
          membersJoined: roomsOut.membersSeries || [],
          requestsCreated: reqOut.requestsCreatedSeries || [],
          reportsCreated: repOut.reportsCreatedSeries || [],
          messagesSent: chatOut.messagesSeries || [],
        },

        distributions: {
          roomType: roomsOut.distRoomType || [],
          roomStatus: roomsOut.distRoomStatus || [],
          joinPolicy: roomsOut.distJoinPolicy || [],

          requestType: reqOut.distRequestType || [],
          requestStatus: reqOut.distRequestStatus || [],

          reportTarget: repOut.distReportTarget || [],
          reportStatus: repOut.distReportStatus || [],
          reportReasons: repOut.topReasons || [],

          roomTypeByMessages: chatOut.distRoomTypeByMessages || [],
        },

        top: {
          groupsByMembers: roomsOut.topGroupsByMembers || [],
          reportReasonsTop: repOut.topReasons || [],
        },
      },
    });
  } catch (e) {
    console.error("[admin.stats.connect]", e);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
});

/* ======================= Stats: PREMIUM (Revenue) ======================= */
/**
 * GET /api/admin/stats/premium
 * Query:
 *  - from=YYYY-MM-DD
 *  - to=YYYY-MM-DD
 *  - granularity=day|week|month
 *  - q=search (username/email/nickname/planCode/planName)
 *  - top=top list limit (default 8)
 *
 * Quy ước:
 *  - Doanh thu "đã nhận": tx.status=PAID và lọc theo paidAt trong khoảng
 *  - Pending/Cancelled: lọc theo createdAt trong khoảng (phản ánh phát sinh giao dịch)
 */
router.get("/stats/premium", adminAuth, async (req, res) => {
  try {
    const qRaw = String(req.query?.q ?? "").trim();
    const granularityRaw = String(req.query?.granularity ?? "day").trim().toLowerCase();
    const granularity = ["day", "week", "month"].includes(granularityRaw) ? granularityRaw : "day";
    const top = Math.min(Math.max(Number(req.query?.top ?? 8) || 8, 3), 20);

    const parseYMD = (s) => {
      const str = String(s || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
      const d = new Date(str + "T00:00:00.000Z");
      return Number.isNaN(d.getTime()) ? null : d;
    };

    const now = new Date();
    const fromQ = parseYMD(req.query?.from);
    const toQ = parseYMD(req.query?.to);

    // default last 30 days (UTC like các stats khác)
    const fromDate = fromQ || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29));
    const toDateInclusive = toQ || new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const toDateExclusive = new Date(toDateInclusive.getTime() + 24 * 60 * 60 * 1000);

    const rx = qRaw ? new RegExp(escapeRegex(qRaw), "i") : null;

    const bucketBy = (dateExpr) => {
      if (granularity === "month") {
        return { $dateToString: { format: "%Y-%m", date: dateExpr } };
      }
      if (granularity === "week") {
        return {
          $concat: [
            { $toString: { $isoWeekYear: dateExpr } },
            "-W",
            { $cond: [{ $lt: [{ $isoWeek: dateExpr }, 10] }, "0", ""] },
            { $toString: { $isoWeek: dateExpr } },
          ],
        };
      }
      return { $dateToString: { format: "%Y-%m-%d", date: dateExpr } };
    };

    // Lấy những giao dịch có liên quan trong khoảng:
    // - PAID: dựa vào paidAt
    // - PENDING/CANCELLED: dựa vào createdAt
    const txMatch = {
      $or: [
        { status: "PAID", paidAt: { $gte: fromDate, $lt: toDateExclusive } },
        { status: { $in: ["PENDING", "CANCELLED"] }, createdAt: { $gte: fromDate, $lt: toDateExclusive } },
      ],
    };

    const basePipe = [
      { $match: txMatch },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "u",
        },
      },
      { $unwind: { path: "$u", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "premiumplans",
          localField: "planCode",
          foreignField: "code",
          as: "plan",
        },
      },
      { $unwind: { path: "$plan", preserveNullAndEmptyArrays: true } },
      ...(rx
        ? [
            {
              $match: {
                $or: [
                  { planCode: rx },
                  { "plan.name": rx },
                  { "plan.code": rx },
                  { "u.username": rx },
                  { "u.email": rx },
                  { "u.profile.nickname": rx },
                  { "u.profile.tenGoi": rx },
                ],
              },
            },
          ]
        : []),
    ];

    // 1) KPI + series + top
    const agg = await PaymentTransaction.aggregate([
      ...basePipe,
      {
        $facet: {
          kpis: [
            {
              $group: {
                _id: null,
                revenuePaid: { $sum: { $cond: [{ $eq: ["$status", "PAID"] }, "$amount", 0] } },
                ordersPaid: { $sum: { $cond: [{ $eq: ["$status", "PAID"] }, 1, 0] } },
                ordersPending: { $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] } },
                ordersCancelled: { $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] } },
                payerSet: { $addToSet: { $cond: [{ $eq: ["$status", "PAID"] }, "$user", null] } },
              },
            },
            {
              $addFields: {
                uniquePayers: { $size: { $setDifference: ["$payerSet", [null]] } },
                avgOrderValue: {
                  $cond: [{ $gt: ["$ordersPaid", 0] }, { $divide: ["$revenuePaid", "$ordersPaid"] }, 0],
                },
              },
            },
            { $project: { _id: 0, revenuePaid: 1, ordersPaid: 1, ordersPending: 1, ordersCancelled: 1, uniquePayers: 1, avgOrderValue: 1 } },
          ],

          revenueSeries: [
            { $match: { status: "PAID", paidAt: { $gte: fromDate, $lt: toDateExclusive } } },
            { $group: { _id: bucketBy("$paidAt"), v: { $sum: "$amount" } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, t: "$_id", v: { $round: ["$v", 0] } } },
          ],

          paidOrdersSeries: [
            { $match: { status: "PAID", paidAt: { $gte: fromDate, $lt: toDateExclusive } } },
            { $group: { _id: bucketBy("$paidAt"), v: { $sum: 1 } } },
            { $sort: { _id: 1 } },
            { $project: { _id: 0, t: "$_id", v: 1 } },
          ],

          topPlansByRevenue: [
            { $match: { status: "PAID", paidAt: { $gte: fromDate, $lt: toDateExclusive } } },
            {
              $group: {
                _id: "$planCode",
                revenue: { $sum: "$amount" },
                orders: { $sum: 1 },
                planName: { $first: { $ifNull: ["$plan.name", "$planCode"] } },
              },
            },
            { $sort: { revenue: -1 } },
            { $limit: top },
            { $project: { _id: 0, code: "$_id", name: "$planName", revenue: 1, orders: 1 } },
          ],

          topUsersByRevenue: [
            { $match: { status: "PAID", paidAt: { $gte: fromDate, $lt: toDateExclusive } } },
            {
              $group: {
                _id: "$user",
                revenue: { $sum: "$amount" },
                orders: { $sum: 1 },
                username: { $first: "$u.username" },
                email: { $first: "$u.email" },
                nick: { $first: { $ifNull: ["$u.profile.nickname", "$u.profile.tenGoi"] } },
              },
            },
            { $sort: { revenue: -1 } },
            { $limit: top },
            {
              $project: {
                _id: 0,
                userId: "$_id",
                name: { $ifNull: ["$nick", { $ifNull: ["$username", { $ifNull: ["$email", "—"] }] }] },
                revenue: 1,
                orders: 1,
              },
            },
          ],
        },
      },
    ]);

    const out = agg?.[0] || {};
    const k = out.kpis?.[0] || {
      revenuePaid: 0,
      ordersPaid: 0,
      ordersPending: 0,
      ordersCancelled: 0,
      uniquePayers: 0,
      avgOrderValue: 0,
    };

    // 2) New premium users in range = user có FIRST PAID nằm trong range
    // (phải scan PAID toàn lịch sử, rồi mới lọc firstPaidAt trong khoảng)
    const firstPaidPipe = [
      { $match: { status: "PAID", paidAt: { $ne: null } } },
      { $group: { _id: "$user", firstPaidAt: { $min: "$paidAt" } } },
      { $match: { firstPaidAt: { $gte: fromDate, $lt: toDateExclusive } } },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "u",
        },
      },
      { $unwind: { path: "$u", preserveNullAndEmptyArrays: true } },
      ...(rx
        ? [
            {
              $match: {
                $or: [
                  { "u.username": rx },
                  { "u.email": rx },
                  { "u.profile.nickname": rx },
                  { "u.profile.tenGoi": rx },
                ],
              },
            },
          ]
        : []),
      { $count: "v" },
    ];

    const firstPaidAgg = await PaymentTransaction.aggregate(firstPaidPipe);
    const newPremiumUsersInRange = Number(firstPaidAgg?.[0]?.v || 0);

    // 3) Active premium users: đếm trực tiếp từ User.premium (chuẩn nhất vì bạn lưu expiresAt)
    const userPremiumMatch = {
      "premium.tier": "premium",
      "premium.expiresAt": { $ne: null },
    };

    const userSearchMatch = rx
      ? {
          $or: [
            { username: rx },
            { email: rx },
            { "profile.nickname": rx },
            { "profile.tenGoi": rx },
          ],
        }
      : null;

    const activePremiumUsers = await User.countDocuments({
      ...(userSearchMatch || {}),
      ...userPremiumMatch,
      "premium.expiresAt": { $gte: now },
    });

    const totalPremiumUsers = await User.countDocuments({
      ...(userSearchMatch || {}),
      ...userPremiumMatch,
    });

    return res.json({
      success: true,
      data: {
        query: {
          from: fromDate.toISOString().slice(0, 10),
          to: toDateInclusive.toISOString().slice(0, 10),
          granularity,
          q: qRaw,
          top,
        },
        kpis: {
          revenuePaid: Number(k.revenuePaid || 0),
          ordersPaid: Number(k.ordersPaid || 0),
          ordersPending: Number(k.ordersPending || 0),
          ordersCancelled: Number(k.ordersCancelled || 0),
          uniquePayers: Number(k.uniquePayers || 0),
          avgOrderValue: Math.round(Number(k.avgOrderValue || 0)),
          newPremiumUsersInRange,
          activePremiumUsers,
          totalPremiumUsers,
        },
        series: {
          revenue: out.revenueSeries || [],
          paidOrders: out.paidOrdersSeries || [],
        },
        top: {
          plansByRevenue: out.topPlansByRevenue || [],
          usersByRevenue: out.topUsersByRevenue || [],
        },
      },
    });
  } catch (e) {
    console.error("[admin.stats.premium]", e);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
});

export default router;