// server/src/controllers/ai.controller.js
import https from "https";
import AiMessage from "../models/AiMessage.js";
import Food from "../models/Food.js";
import SuggestMenu from "../models/SuggestMenu.js";
import SuggestPlan, {
  SUGGEST_PLAN_CATEGORIES,
  SUGGEST_PLAN_LEVELS,
  SUGGEST_PLAN_GOALS,
} from "../models/SuggestPlan.js";
import { User } from "../models/User.js";
import { OnboardingProfile } from "../models/OnboardingProfile.js";
import { uploadImageWithResize } from "../utils/cloudinary.js";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const OPENAI_BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com";

const safeArr = (v) => (Array.isArray(v) ? v : []);
const s = (v) => String(v ?? "").trim();
const pick = (...v) => v.find((x) => x !== undefined && x !== null && x !== "");

const toClientMsg = (m) => {
  const o = m?.toObject ? m.toObject() : m || {};
  const urls = safeArr(o.imageUrls).filter((u) => typeof u === "string" && u);
  return {
    ...o,
    content: s(o.text),
    attachments: urls.map((u) => ({ type: "image", url: u })),
  };
};

const YES_RE = /^(có|co|ok|okay|yes|y|đồng\s*ý|dong\s*y|được|duoc)\b/i;
const NO_RE = /^(không|khong|no|n|thôi|thoi|hủy|huy)\b/i;
const CREATE_FOOD_RE = /^(tạo|tao)\s*(món|mon)\b/i;

const GEN_MENU_RE = /(tạo|tao).*(thực\s*đơn|menu).*(mới|new)/i; // user chủ động yêu cầu tạo menu mới
const GEN_PLAN_RE = /(tạo|tao).*(lịch\s*tập|workout|kế\s*hoạch\s*tập|plan).*(mới|new)/i; // user chủ động yêu cầu tạo plan mới

// user chủ động muốn "tạo/lập/xây" thực đơn (không cần chữ "mới")
const WANT_CREATE_MENU_RE =
  /(tạo|tao|lên|len|xây|xay|lập|lap|soạn|soan).*(thực\s*đơn|menu|meal\s*plan|diet)\b/i;

const WANT_CREATE_PLAN_RE =
  /(tạo|tao|lên|len|xây|xay|lập|lap|soạn|soan).*(lịch\s*tập|workout|plan|kế\s*hoạch\s*tập)\b/i;

const escapeRegex = (x) => String(x || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const GOAL_LABEL = {
  giam_can: "Giảm cân",
  duy_tri: "Duy trì",
  tang_can: "Tăng cân",
  giam_mo: "Giảm mỡ",
  tang_co: "Tăng cơ",
};

const stripVN = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");

function detectGoalOverride(text) {
  const t = stripVN(text);

  if (/\b(tang\s*co|xay\s*co|len\s*co|lean\s*bulk)\b/.test(t)) return "tang_co";
  if (/\b(tang\s*can|bulk)\b/.test(t)) return "tang_can";
  if (/\b(giam\s*mo|dot\s*mo|siet)\b/.test(t)) return "giam_mo";
  if (/\b(giam\s*can|cat\s*can)\b/.test(t)) return "giam_can";
  if (/\b(duy\s*tri|giu\s*can|maintain)\b/.test(t)) return "duy_tri";

  return null;
}

function parseMenuDaysFromText(text) {
  const t = stripVN(text);
  if (/\b(1|mot)\s*tuan\b/.test(t)) return 7;

  const mWeek = t.match(/\b(\d{1,2})\s*tuan\b/);
  if (mWeek) return Math.min(7, Math.max(1, Number(mWeek[1]) * 7));

  const mDay = t.match(/\b(\d{1,2})\s*ngay\b/);
  if (mDay) return Math.min(7, Math.max(1, Number(mDay[1])));

  return null;
}

function parseMealsPerDayFromText(text) {
  const t = stripVN(text);
  const m = t.match(/\b(\d)\s*bua\b/);
  if (m) return Math.min(5, Math.max(2, Number(m[1])));
  if (/\bbua\s*phu\b/.test(t)) return 4;
  return null;
}

function mealSlotsByCount(n) {
  if (n === 2) return ["Sáng", "Tối"];
  if (n === 3) return ["Sáng", "Trưa", "Tối"];
  if (n === 4) return ["Sáng", "Trưa", "Xế", "Tối"];
  if (n === 5) return ["Sáng", "Phụ 1", "Trưa", "Phụ 2", "Tối"];
  return ["Sáng", "Trưa", "Xế", "Tối"];
}

function calcMenuGenTokens(days, meals) {
  const d = Math.min(7, Math.max(1, Number(days) || 3));
  const m = Math.min(5, Math.max(2, Number(meals) || 3));
  return Math.min(2200, 850 + d * m * 70);
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse số “loose”:
 * - nhận "38", "38 kcal", "~38", "38.5g", "38,5" => 38 / 38.5
 */
function numLoose(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const str = String(v).replace(",", ".");
  const m = str.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function clampNum(n, min = 0, max = 10000) {
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}
function round1(n) {
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}
function fmtNum(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return Number.isInteger(x) ? String(x) : String(round1(x));
}

function clipText(str, max = 420) {
  const t = String(str || "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

/* =========================
 * USER GOAL LABELS
 * ========================= */
const GOAL_LABEL_VI = {
  giam_can: "Giảm cân",
  giam_mo: "Giảm mỡ",
  duy_tri: "Duy trì cân nặng",
  tang_can: "Tăng cân",
  tang_co: "Tăng cơ",
};

const goalLabelByKey = (k) => {
  const key = String(k || "").trim();
  return GOAL_LABEL_VI[key] || GOAL_LABEL[key] || key;
};

const GOAL_GAIN = new Set(["tang_can", "tang_co"]);
const GOAL_LOSS = new Set(["giam_can", "giam_mo"]);
const GOAL_MAINTAIN = new Set(["duy_tri"]);

/* =========================
 * MENU RECOMMEND HELPERS
 * ========================= */
function parseKcalRangeFromText(text) {
  const t = s(text);
  const m = t.match(/(\d{3,4})\s*[-–]\s*(\d{3,4})/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const min = Math.min(a, b);
  const max = Math.max(a, b);
  if (min <= 0 || max <= 0 || max - min < 50) return null;
  return { min, max, mode: "user" };
}

function calcDailyKcalRangeByGoal(targetKcal, goalKey) {
  const t = Number(targetKcal);
  if (!Number.isFinite(t) || t <= 0) return null;

  const step = 200;
  const floor = Math.floor(t / step) * step;
  const ceil = Math.ceil(t / step) * step;

  if (GOAL_MAINTAIN.has(goalKey)) {
    return { min: Math.max(0, Math.round(t - 200)), max: Math.round(t + 200), mode: "around" };
  }
  if (GOAL_LOSS.has(goalKey)) {
    return { min: Math.max(0, ceil - step), max: ceil, mode: "down" };
  }
  if (GOAL_GAIN.has(goalKey)) {
    return { min: floor, max: floor + step, mode: "up" };
  }
  return { min: floor, max: floor + step, mode: "bin" };
}

function preferredMenuCategoryByGoal(goalKey) {
  if (GOAL_LOSS.has(goalKey)) return "Ít tinh bột - Tăng đạm";
  if (GOAL_GAIN.has(goalKey)) return "Cân bằng";
  return null;
}

async function getUserGoalAndTargetKcal(userId) {
  const u = await User.findById(userId)
    .select("profile.goal profile.calorieTarget connectGoalKey")
    .lean()
    .catch(() => null);

  let goalKey = s(u?.profile?.goal) || s(u?.connectGoalKey) || "";
  let targetKcal = numOrNull(u?.profile?.calorieTarget);

  if (!goalKey || !targetKcal) {
    const onb = await OnboardingProfile.findOne({ user: userId })
      .select("base.mucTieu base.calorieTarget goals")
      .lean()
      .catch(() => null);

    if (onb) {
      const goals = safeArr(onb.goals);
      const active = goals.filter((g) => String(g?.status || "active") !== "archived");

      const pickLatest = (arr) =>
        safeArr(arr)
          .slice()
          .sort((a, b) => Number(b?.seq || 0) - Number(a?.seq || 0))[0] || null;

      const latest = pickLatest(active) || pickLatest(goals) || null;
      const src = latest || onb.base || {};

      if (!goalKey) goalKey = s(src?.mucTieu);
      if (!targetKcal) targetKcal = numOrNull(src?.calorieTarget);
    }
  }

  return {
    goalKey: goalKey || null,
    goalLabel: GOAL_LABEL_VI[goalKey] || "",
    targetKcal: Number.isFinite(Number(targetKcal)) && Number(targetKcal) > 0 ? Number(targetKcal) : null,
  };
}

async function findSuggestMenusForUser({ userId, goalKey, targetKcal, userText = "", limit = 6 }) {
  const rangeFromText = parseKcalRangeFromText(userText);
  const range = rangeFromText || calcDailyKcalRangeByGoal(targetKcal, goalKey);
  if (!range) return { range: null, items: [] };

  const cat = preferredMenuCategoryByGoal(goalKey);

  const pipeline = (extraMatch = {}) => [
    {
      $addFields: {
        _numDays: {
          $cond: [
            { $gt: ["$numDays", 0] },
            "$numDays",
            {
              $cond: [
                { $gt: [{ $size: { $ifNull: ["$days", []] } }, 0] },
                { $size: "$days" },
                1,
              ],
            },
          ],
        },
      },
    },
    { $addFields: { kcalPerDay: { $divide: ["$totalKcal", "$_numDays"] } } },
    { $match: { ...extraMatch, kcalPerDay: { $gte: range.min, $lte: range.max } } },
    { $sort: { createdAt: -1 } },
    { $limit: Math.max(1, Number(limit) || 6) },
    {
      $project: {
        name: 1,
        imageUrl: 1,
        category: 1,
        numDays: "$_numDays",
        totalKcal: 1,
        totalProteinG: 1,
        totalCarbG: 1,
        totalFatG: 1,
        savedBy: 1,
        kcalPerDay: 1,
        createdAt: 1,
      },
    },
  ];

  let docs = [];
  if (cat) docs = await SuggestMenu.aggregate(pipeline({ category: cat })).catch(() => []);
  if (!docs.length) docs = await SuggestMenu.aggregate(pipeline({})).catch(() => []);

  const items = safeArr(docs).map((m) => {
    const id = m?._id;
    const saved = safeArr(m?.savedBy).some((u) => String(u) === String(userId));
    return {
      _id: id,
      id,
      name: m?.name || "",
      imageUrl: m?.imageUrl || "",
      category: m?.category || "",
      numDays: Number(m?.numDays) || 1,
      totalKcal: Number(m?.totalKcal) || 0,
      totalProteinG: Number(m?.totalProteinG) || 0,
      totalCarbG: Number(m?.totalCarbG) || 0,
      totalFatG: Number(m?.totalFatG) || 0,
      kcalPerDay: Math.round(Number(m?.kcalPerDay) || 0),
      saved,
    };
  });

  return { range, items };
}

function formatMenuRecommendReply({ profileGoalLabel, appliedGoalLabel, targetKcal, range, items }) {
  const lines = [];

  if (profileGoalLabel) lines.push(`Mục tiêu trong hồ sơ của bạn: (${profileGoalLabel}).`);
  if (appliedGoalLabel && appliedGoalLabel !== profileGoalLabel) {
    lines.push(`Mục tiêu bạn đang yêu cầu: (${appliedGoalLabel}).`);
  }

  if (Number.isFinite(targetKcal)) lines.push(`Calo mục tiêu tham khảo: (${Math.round(targetKcal)} kcal/ngày).`);
  if (range) lines.push(`Mình sẽ gợi ý thực đơn trong khoảng (${range.min}–${range.max} kcal/ngày).`);

  if (!items?.length) {
    lines.push("");
    lines.push("Hiện tại mình chưa tìm thấy thực đơn phù hợp trong FitMatch.");
    lines.push("Bạn có muốn mình tạo một bộ thực đơn mới (không lưu vào FitMatch) không?");
    lines.push("👉 Gõ: tạo thực đơn mới");
    return lines.join("\n");
  }

  lines.push("");
  lines.push("Dưới đây là một vài thực đơn phù hợp:");
  items.slice(0, 6).forEach((m, idx) => {
    const kcal = Number(m?.kcalPerDay) || 0;
    const days = Number(m?.numDays) || 1;
    const cate = m?.category ? ` · ${m.category}` : "";
    lines.push(`${idx + 1}. ${m?.name || "Thực đơn"} — ${kcal} kcal/ngày · ${days} ngày${cate}`);
  });

  return lines.join("\n");
}

/* =========================
 * PLAN RECOMMEND HELPERS (DB-FIRST)
 * ========================= */
function normalizeLite(str) {
  return s(str).toLowerCase().replace(/\s+/g, " ").trim();
}

function parsePlanLevelFromIntensity(intensityLike, fallbackFromText) {
  const t0 = normalizeLite(fallbackFromText);
  for (const lv of SUGGEST_PLAN_LEVELS) {
    if (t0.includes(normalizeLite(lv))) return lv;
  }

  const t = normalizeLite(intensityLike).replace(/_/g, "").replace(/-/g, "");

  if (t.includes("level1") || t === "1") return "Cơ bản";
  if (t.includes("level2") || t === "2") return "Cơ bản";
  if (t.includes("level3") || t === "3") return "Trung bình";
  if (t.includes("level4") || t === "4") return "Nâng cao";

  if (t.includes("coban") || t.includes("co ban") || t.includes("nhe") || t.includes("beginner")) return "Cơ bản";
  if (t.includes("trungbinh") || t.includes("trung binh") || t.includes("vua") || t.includes("intermediate")) return "Trung bình";
  if (t.includes("nangcao") || t.includes("nang cao") || t.includes("advanced") || t.includes("cao")) return "Nâng cao";

  return null;
}

async function getUserTrainingIntensity(userId) {
  const u = await User.findById(userId)
    .select("profile.trainingIntensity")
    .lean()
    .catch(() => null);

  let intensity = s(u?.profile?.trainingIntensity);

  if (!intensity) {
    const onb = await OnboardingProfile.findOne({ user: userId })
      .select("base.cuongDoLuyenTap goals")
      .lean()
      .catch(() => null);

    if (onb) {
      const goals = safeArr(onb.goals);
      const active = goals.filter((g) => String(g?.status || "active") !== "archived");
      const pickLatest = (arr) =>
        safeArr(arr)
          .slice()
          .sort((a, b) => Number(b?.seq || 0) - Number(a?.seq || 0))[0] || null;

      const latest = pickLatest(active) || pickLatest(goals) || null;
      const src = latest || onb.base || {};
      intensity = s(src?.cuongDoLuyenTap);
    }
  }

  return intensity || null;
}

function pickFromEnums(text, arr) {
  const t = s(text).toLowerCase();
  return arr.find((x) => t.includes(String(x).toLowerCase())) || null;
}

function inferPreferredPlanGoalList(goalKey, userText) {
  const fromText = pickFromEnums(userText, SUGGEST_PLAN_GOALS);
  if (fromText) return [fromText];

  if (GOAL_LOSS.has(goalKey)) return ["Giảm cân nặng", "Tăng sức mạnh", "Tăng cơ bắp"];
  if (goalKey === "tang_co") return ["Tăng cơ bắp", "Tăng sức mạnh"];
  if (goalKey === "tang_can") return ["Tăng cơ bắp", "Tăng sức mạnh"];
  if (GOAL_MAINTAIN.has(goalKey)) return ["Tăng sức mạnh", "Tăng cơ bắp", "Giảm cân nặng"];

  return [];
}

function inferPreferredPlanCategories(goalKey, userText) {
  const fromText = pickFromEnums(userText, SUGGEST_PLAN_CATEGORIES);
  if (fromText) return [fromText];

  if (GOAL_LOSS.has(goalKey)) return ["Cardio và HIIT", "Bodyweight", "Tại nhà", "Tại Gym"];
  if (GOAL_GAIN.has(goalKey)) return ["Tại Gym", "Chỉ tạ đơn", "Tại nhà", "Bodyweight"];
  if (GOAL_MAINTAIN.has(goalKey)) return ["Tại nhà", "Tại Gym", "Bodyweight", "Cardio và HIIT"];
  return [];
}

function calcPlanStats(plan) {
  const sessions = safeArr(plan?.sessions);
  const sessionsCount = sessions.length;
  const exercisesCount = sessions.reduce((sum, ss) => sum + safeArr(ss?.exercises).length, 0);
  return { sessionsCount, exercisesCount };
}

async function findSuggestPlansForUser({ userId, goalKey, userText = "", limit = 6 }) {
  const userIntensity = await getUserTrainingIntensity(userId);
  const preferredLevel = parsePlanLevelFromIntensity(userIntensity, userText);

  const goalPrefs = inferPreferredPlanGoalList(goalKey, userText);
  const catPrefs = inferPreferredPlanCategories(goalKey, userText);

  const baseFind = { status: { $ne: "archived" } };

  const proj = {
    name: 1,
    imageUrl: 1,
    category: 1,
    level: 1,
    goal: 1,
    sessions: 1,
    savedBy: 1,
    createdAt: 1,
  };

  const seen = new Set();
  const out = [];

  const pushDocs = (docs) => {
    for (const d of safeArr(docs)) {
      const id = String(d?._id || "");
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const saved = safeArr(d.savedBy).some((u) => String(u) === String(userId));
      const { sessionsCount, exercisesCount } = calcPlanStats(d);

      out.push({
        _id: d._id,
        id: d._id,
        name: d.name || "",
        imageUrl: d.imageUrl || "",
        category: d.category || "",
        level: d.level || "",
        goal: d.goal || "",
        sessionsCount,
        exercisesCount,
        saved,
      });

      if (out.length >= limit) break;
    }
  };

  const runFind = async (find, take = limit) => {
    const docs = await SuggestPlan.find(find, proj)
      .sort({ createdAt: -1 })
      .limit(Math.max(1, take))
      .lean()
      .catch(() => []);
    pushDocs(docs);
  };

  if (goalPrefs.length) {
    for (const g of goalPrefs) {
      if (preferredLevel && catPrefs.length) {
        for (const c of catPrefs) {
          if (out.length >= limit) break;
          await runFind({ ...baseFind, goal: g, level: preferredLevel, category: c }, limit);
        }
      }
      if (out.length < limit && preferredLevel) await runFind({ ...baseFind, goal: g, level: preferredLevel }, limit);
      if (out.length < limit && catPrefs.length) {
        for (const c of catPrefs) {
          if (out.length >= limit) break;
          await runFind({ ...baseFind, goal: g, category: c }, limit);
        }
      }
      if (out.length < limit) await runFind({ ...baseFind, goal: g }, limit);
      if (out.length >= limit) break;
    }
  }

  if (out.length < limit && preferredLevel) await runFind({ ...baseFind, level: preferredLevel }, limit);
  if (out.length < limit && catPrefs.length) {
    for (const c of catPrefs) {
      if (out.length >= limit) break;
      await runFind({ ...baseFind, category: c }, limit);
    }
  }

  if (out.length < limit) await runFind(baseFind, limit);

  return {
    preferred: {
      goalPrefs,
      categoryPrefs: catPrefs,
      level: preferredLevel,
      intensity: userIntensity || undefined,
    },
    items: out.slice(0, limit),
  };
}

function explainPlanReason(goalKey, preferred) {
  const lvl = preferred?.level
    ? `Mức độ mình ưu tiên: (${preferred.level}) (dựa trên cường độ tập bạn đã thiết lập).`
    : "";

  if (GOAL_LOSS.has(goalKey)) {
    return [
      "Vì bạn đang hướng tới (giảm cân/giảm mỡ), mình ưu tiên lịch tập giúp (tăng tiêu hao năng lượng) nhưng vẫn giữ nền tảng sức mạnh.",
      "Các lịch kiểu (Cardio/HIIT) hoặc (Bodyweight) thường phù hợp vì dễ tăng nhịp tim, đốt calo tốt.",
      lvl,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (goalKey === "tang_co" || goalKey === "tang_can") {
    return [
      "Vì bạn đang hướng tới (tăng cơ/tăng cân), mình ưu tiên lịch tập thiên về (Strength/kháng lực) để tạo kích thích cơ bắp.",
      "Các lịch (tại gym) hoặc (chỉ tạ đơn) thường phù hợp vì dễ kiểm soát mức tạ và tiến bộ theo thời gian.",
      lvl,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (GOAL_MAINTAIN.has(goalKey)) {
    return [
      "Vì bạn đang ở mục tiêu (duy trì), mình ưu tiên lịch tập (cân bằng): vừa có kháng lực để giữ cơ, vừa có cardio nhẹ để giữ thể lực.",
      lvl,
    ]
      .filter(Boolean)
      .join("\n");
  }

  return ["Mình ưu tiên các lịch tập phổ biến và bền vững để bạn dễ theo lâu dài.", lvl]
    .filter(Boolean)
    .join("\n");
}

function formatPlanRecommendReply({ profileGoalLabel, appliedGoalLabel, items, goalKey, preferred }) {
  const lines = [];

  if (profileGoalLabel) lines.push(`Mục tiêu trong hồ sơ của bạn: ${profileGoalLabel}.`);
  if (appliedGoalLabel && appliedGoalLabel !== profileGoalLabel) {
    lines.push(`Mục tiêu bạn đang yêu cầu: ${appliedGoalLabel}.`);
  }

  lines.push(explainPlanReason(goalKey, preferred));

  if (!items?.length) {
    lines.push("");
    lines.push("Hiện tại mình chưa tìm thấy lịch tập gợi ý phù hợp trong FitMatch.");
    lines.push("Bạn có muốn mình tạo một lịch tập mới (không lưu vào FitMatch) không?");
    lines.push("👉 Gõ: tạo lịch tập mới");
    return lines.join("\n");
  }

  lines.push("");
  lines.push("Dưới đây là một vài lịch tập gợi ý phù hợp:");
  items.slice(0, 6).forEach((p, idx) => {
    const sessions = Number(p?.sessionsCount) || 0;
    const cate = p?.category ? ` · ${p.category}` : "";
    const lv = p?.level ? ` · ${p.level}` : "";
    const gl = p?.goal ? ` · ${p.goal}` : "";
    lines.push(`${idx + 1}. ${p?.name || "Lịch tập"} — ${sessions} buổi${cate}${lv}${gl}`);
  });

  lines.push("");
  lines.push("Bạn có thể vào *Tập luyện → Lịch tập gợi ý* để xem chi tiết và bấm *Lưu* lịch tập phù hợp.");
  return lines.join("\n");
}

/* =========================
 * MEAL SCAN HELPERS
 * ========================= */
function buildFoodDraftFromParsed({ parsed, imageUrls, fallbackName }) {
  const detected =
    s(parsed?.detectedFoodName) || s(parsed?.foodDraft?.name) || s(fallbackName) || "Món ăn từ ảnh";

  const fd = parsed?.foodDraft || {};
  const est = parsed?.estimated || {};

  const massG = clampNum(numLoose(fd.massG), 1, 10000) ?? 100;
  const unit = fd.unit === "ml" ? "ml" : "g";

  const kcal = clampNum(numLoose(fd.kcal ?? est.kcal), 0, 10000) ?? null;

  return {
    name: detected,
    imageUrl: safeArr(imageUrls)[0] || "",
    portionName: s(fd.portionName) || "1 phần",
    massG,
    unit,
    kcal,
    proteinG: clampNum(numLoose(fd.proteinG ?? est.proteinG), 0, 10000),
    carbG: clampNum(numLoose(fd.carbG ?? est.carbG), 0, 10000),
    fatG: clampNum(numLoose(fd.fatG ?? est.fatG), 0, 10000),
    saltG: clampNum(numLoose(fd.saltG), 0, 10000),
    sugarG: clampNum(numLoose(fd.sugarG), 0, 10000),
    fiberG: clampNum(numLoose(fd.fiberG), 0, 10000),
    description: s(fd.description) || "",
    confidence: s(parsed?.confidence) || "",
    notes: safeArr(parsed?.notes),
  };
}

function fillDraftFromSimilar(foodDraft, similarFoods = []) {
  const top = safeArr(similarFoods)[0];
  if (!foodDraft || !top) return foodDraft;

  const fd = { ...foodDraft };

  const fdMass = numLoose(fd.massG) || 0;
  const topMass = numLoose(top.massG) || 0;
  const scale = fdMass > 0 && topMass > 0 ? fdMass / topMass : 1;

  const scaleVal = (v) => {
    const n = numLoose(v);
    return n == null ? null : round1(n * scale);
  };

  if (fd.kcal == null && top.kcal != null) fd.kcal = Math.round(numLoose(top.kcal) * scale);
  if (fd.proteinG == null && top.proteinG != null) fd.proteinG = scaleVal(top.proteinG);
  if (fd.carbG == null && top.carbG != null) fd.carbG = scaleVal(top.carbG);
  if (fd.fatG == null && top.fatG != null) fd.fatG = scaleVal(top.fatG);

  if (fd.kcal == null) {
    const p = numLoose(fd.proteinG) || 0;
    const c = numLoose(fd.carbG) || 0;
    const f = numLoose(fd.fatG) || 0;
    if (p || c || f) fd.kcal = Math.round(p * 4 + c * 4 + f * 9);
  }

  return fd;
}

function inferIntent(text, imageUrls) {
  const t = s(text).toLowerCase();
  if (safeArr(imageUrls).length) return "meal_scan";

  // ✅ ưu tiên "tạo/lập/xây ..." => generate
  if (WANT_CREATE_MENU_RE.test(t)) return "menu_generate";
  if (WANT_CREATE_PLAN_RE.test(t)) return "plan_generate";

  if (/(thực\s*đơn|menu|bữa\s*ăn)/i.test(t)) return "menu_recommend";
  if (/(lịch\s*tập|workout|plan|kế\s*hoạch\s*tập)/i.test(t)) return "plan_recommend";
  if (/(calo|kcal|macro|protein|carb|fat)/i.test(t)) return "nutrition";
  return "general";
}


function formatMealScanReply({ parsedReply, foodDraft, similarFoods, notes = [] }) {
  const name = s(foodDraft?.name) || "món ăn trong ảnh";
  const portionLine = `${s(foodDraft?.portionName) || "1 phần"} (${fmtNum(foodDraft?.massG)}${foodDraft?.unit || "g"})`;

  const lines = [];

  // 1) Mô tả món ăn (lấy từ AI reply)
  const desc = clipText(parsedReply, 520);
  if (desc) {
    lines.push(`Mô tả món ăn (ước tính): ${desc}`);
  } else {
    lines.push(`Món ăn trong hình: ${name}.`);
  }

  lines.push("");
  lines.push(`Khẩu phần ước tính: ${portionLine}`);

  // 3) Macro & kcal
  const kcal = foodDraft?.kcal;
  const p = numLoose(foodDraft?.proteinG);
  const c = numLoose(foodDraft?.carbG);
  const f = numLoose(foodDraft?.fatG);

  lines.push(`- Năng lượng: ${kcal != null ? `${fmtNum(kcal)} kcal` : "-"}`);
  lines.push(`- Protein: ${p != null ? `${fmtNum(p)} g` : "-"}`);
  lines.push(`- Carb: ${c != null ? `${fmtNum(c)} g` : "-"}`);
  lines.push(`- Fat: ${f != null ? `${fmtNum(f)} g` : "-"}`);

  // 4) Phân tích nhanh: tỷ lệ năng lượng theo macro (nếu đủ dữ liệu)
  const kcalFromMacros =
    (Number.isFinite(p) ? p * 4 : 0) + (Number.isFinite(c) ? c * 4 : 0) + (Number.isFinite(f) ? f * 9 : 0);

  const kcalBase = Number.isFinite(Number(kcal)) && Number(kcal) > 0 ? Number(kcal) : kcalFromMacros;

  if (kcalBase > 0 && kcalFromMacros > 0 && (p != null || c != null || f != null)) {
    const pp = Math.round(((p * 4) / kcalFromMacros) * 100);
    const cc = Math.round(((c * 4) / kcalFromMacros) * 100);
    const ff = Math.round(((f * 9) / kcalFromMacros) * 100);

    lines.push(`- Tỷ lệ năng lượng (ước tính): Protein ${pp}% · Carb ${cc}% · Fat ${ff}%`);

    // nhận xét gọn
    const remarks = [];
    if (ff >= 40) remarks.push("khá nhiều chất béo (có thể do dầu/chiên/xào/sốt)");
    if (cc >= 55) remarks.push("thiên về tinh bột");
    if (pp >= 25) remarks.push("đạm tương đối tốt");
    if (remarks.length) lines.push(`- *Nhận xét nhanh: ${remarks.join(", ")}.`);
  }

  // 5) Notes/giả định (từ AI)
  const noteArr = safeArr(notes).map((x) => s(x)).filter(Boolean);
  if (noteArr.length) {
    lines.push("");
    lines.push("Giả định & điểm có thể làm lệch số liệu:");
    noteArr.slice(0, 6).forEach((n) => lines.push(`- ${n}`));
  }

  // 6) Similar foods + CTA tạo món
  const hasSimilar = safeArr(similarFoods).length > 0;
  lines.push("");
  lines.push(
    hasSimilar
      ? `FitMatch đã có ${similarFoods.length} món tương tự trong danh sách.`
      : `Chưa thấy món tương tự trong danh sách món ăn của FitMatch.`
  );
  lines.push(`Bạn có muốn (tạo món ăn mới) với các chỉ số mình vừa ước lượng không? (Trả lời “Có” hoặc bấm “Tạo món”)`);

  return lines.join("\n");
}

/** ===== Similar foods: text search + rerank ===== */
async function findSimilarFoods({ userId, query, limit = 5 }) {
  const q = s(query);
  if (!q) return [];

  const baseOr = [{ status: "approved" }];
  if (userId) baseOr.push({ createdBy: userId });

  const proj = {
    name: 1,
    imageUrl: 1,
    portionName: 1,
    massG: 1,
    unit: 1,
    kcal: 1,
    proteinG: 1,
    carbG: 1,
    fatG: 1,
    status: 1,
    createdBy: 1,
    updatedAt: 1,
  };

  const stripVn = (str) =>
    String(str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "d");

  const STOP = new Set([
    "mon", "an", "phan", "khau", "to", "bat", "chen",
    "dia", "hop", "mieng", "cai", "ly", "chai", "goi",
    "them", "it", "nhieu", "vua", "thap", "cao", "tuoi",
  ]);

  const tokenize = (str) => {
    const norm = stripVn(str).toLowerCase().replace(/[^a-z0-9]+/g, " ");
    return norm
      .split(" ")
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !STOP.has(t));
  };

  const qTokens = tokenize(q);
  const qSet = new Set(qTokens);

  const scoreByToken = (name) => {
    const cTokens = tokenize(name);
    const cSet = new Set(cTokens);

    let overlap = 0;
    for (const t of qSet) if (cSet.has(t)) overlap++;

    const union = qSet.size + cSet.size - overlap || 1;
    const jaccard = overlap / union;
    const coverage = overlap / (qSet.size || 1);

    const qNorm = stripVn(q).toLowerCase();
    const nNorm = stripVn(name).toLowerCase();
    const phraseBoost = nNorm.includes(qNorm) || qNorm.includes(nNorm) ? 0.2 : 0;

    const score = jaccard * 0.65 + coverage * 0.35 + phraseBoost;
    return { score, overlap, qLen: qSet.size };
  };

  const passFilter = ({ overlap, qLen }) => {
    if (qLen >= 3) return overlap >= 2;
    if (qLen === 2) return overlap >= 1;
    return overlap >= 1;
  };

  let candidates = await Food.find(
    { $and: [{ $or: baseOr }, { $text: { $search: q } }] },
    { ...proj, score: { $meta: "textScore" } }
  )
    .sort({ score: { $meta: "textScore" }, updatedAt: -1 })
    .limit(Math.max(30, limit * 10))
    .lean()
    .catch(() => []);

  if (!candidates?.length) {
    const tokensRaw = q
      .split(/\s+/)
      .map((x) => x.trim())
      .filter((x) => x.length >= 2)
      .slice(0, 6);

    if (!tokensRaw.length) return [];
    const re = new RegExp(tokensRaw.map(escapeRegex).join("|"), "i");

    candidates = await Food.find({ $and: [{ $or: baseOr }, { name: re }] }, proj)
      .sort({ updatedAt: -1 })
      .limit(Math.max(30, limit * 10))
      .lean()
      .catch(() => []);
  }

  const ranked = safeArr(candidates)
    .map((f) => {
      const { score, overlap, qLen } = scoreByToken(f?.name);
      return { f, score, overlap, qLen };
    })
    .filter((x) => passFilter({ overlap: x.overlap, qLen: x.qLen }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.f?.updatedAt || 0) - new Date(a.f?.updatedAt || 0);
    })
    .slice(0, limit)
    .map(({ f }) => ({
      id: f._id,
      name: f.name,
      imageUrl: f.imageUrl,
      portionName: f.portionName,
      massG: f.massG,
      unit: f.unit,
      kcal: f.kcal,
      proteinG: f.proteinG,
      carbG: f.carbG,
      fatG: f.fatG,
      status: f.status,
    }));

  return ranked;
}

function extractResponsesText(json) {
  if (!json) return "";
  if (typeof json.output_text === "string" && json.output_text.trim()) return json.output_text.trim();

  const out = [];

  const pushText = (t) => {
    const s0 = String(t || "").trim();
    if (s0) out.push(s0);
  };

  const walkContent = (c) => {
    if (!c) return;

    // đôi khi content là string thẳng
    if (typeof c === "string") return pushText(c);

    // chuẩn: { type: "output_text", text: "..." }
    if (c.type === "output_text" && c.text) return pushText(c.text);

    // một số biến thể: { type: "text", text: "..." }
    if (c.type === "text" && c.text) return pushText(c.text);

    // nested
    if (Array.isArray(c.content)) c.content.forEach(walkContent);
  };

  const outputs = Array.isArray(json.output) ? json.output : [];
  for (const item of outputs) {
    // chuẩn: item.type === "message", item.content = [...]
    if (Array.isArray(item?.content)) item.content.forEach(walkContent);

    // phòng trường hợp message lồng
    if (Array.isArray(item?.message?.content)) item.message.content.forEach(walkContent);
  }

  return out.join("\n").trim();
}

/* =========================
 * OPENAI CALLS
 * ========================= */
function postJsonNode(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
        path: u.pathname + (u.search || ""),
        headers: { "Content-Type": "application/json", ...headers },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const json = JSON.parse(data || "{}");
            if (res.statusCode >= 200 && res.statusCode < 300) return resolve(json);
            const msg = json?.error?.message || `HTTP ${res.statusCode}`;
            return reject(new Error(msg));
          } catch {
            return reject(new Error(`Invalid JSON response (${res.statusCode}): ${data?.slice(0, 300)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

async function callOpenAIResponses({ systemText, historyItems, temperature = 0.4, maxOutputTokens }) {
  if (!OPENAI_KEY) throw new Error("Missing OPENAI_API_KEY");

  const input = [
    { role: "system", content: [{ type: "input_text", text: systemText }] },
    ...historyItems.map((m) => {
      const parts = [];
      if (s(m.text)) parts.push({ type: "input_text", text: s(m.text) });
      for (const url of safeArr(m.imageUrls)) {
        if (String(url).startsWith("http")) parts.push({ type: "input_image", image_url: url });
      }
      if (!parts.length) parts.push({ type: "input_text", text: "" });
      return { role: m.role === "assistant" ? "assistant" : "user", content: parts };
    }),
  ];

  const payload = {
    model: OPENAI_MODEL,
    input,
    temperature,
    ...(Number.isFinite(maxOutputTokens) ? { max_output_tokens: maxOutputTokens } : {}),
  };

  const json = await postJsonNode(`${OPENAI_BASE}/v1/responses`, payload, {
    Authorization: `Bearer ${OPENAI_KEY}`,
  });

  const text = extractResponsesText(json);
  if (!text) throw new Error("Responses API returned empty text");
  return text;
}

async function callOpenAIChatFallback({ systemText, historyItems, maxOutputTokens }) {
  const messages = [
    { role: "system", content: systemText },
    ...historyItems.map((m) => {
      if (safeArr(m.imageUrls).length) {
        const content = [];
        if (s(m.text)) content.push({ type: "text", text: s(m.text) });
        for (const url of safeArr(m.imageUrls)) {
          if (String(url).startsWith("http")) content.push({ type: "image_url", image_url: { url } });
        }
        return { role: m.role, content };
      }
      return { role: m.role, content: s(m.text) };
    }),
  ];

  const payload = {
    model: OPENAI_MODEL,
    messages,
    temperature: 0.4,
    ...(Number.isFinite(maxOutputTokens) ? { max_tokens: maxOutputTokens } : {}),
  };

  const json = await postJsonNode(`${OPENAI_BASE}/v1/chat/completions`, payload, {
    Authorization: `Bearer ${OPENAI_KEY}`,
  });

  return s(json?.choices?.[0]?.message?.content) || "";
}

/* =========================
 * OUTPUT BUDGET + OUTRO
 * ========================= */

const MAX_OUT_TOKENS = {
  router: 220,

  meal_scan: 800,        // JSON + hệ thống format lại -> đủ dùng
  nutrition: 900,        // đầy đủ hơn cho dinh dưỡng
  general: 850,          // đủ chi tiết nhưng không lan man

  menu_generate: 1200,   // 3 ngày, 3 bữa/ngày
  plan_generate: 1400,   // nhiều buổi nên cho cao hơn

  menu_recommend: 520,   // trả list DB -> gọn
  plan_recommend: 600,   // trả list DB + lý do -> vừa
};

function getMaxOutTokensByIntent(intent) {
  return MAX_OUT_TOKENS[intent] ?? 850;
}

// câu chốt theo yêu cầu của bạn
const OUTRO_LONG =
  "\n\n—\n*Lưu ý:* Các gợi ý trên chỉ mang tính tham khảo và có thể chưa hoàn hảo 100%, vì mỗi người có một thể trạng và đáp ứng khác nhau. Nếu bạn thực hiện tốt theo kế hoạch và điều chỉnh dần theo cơ thể, bạn sẽ có cơ hội đạt kết quả gần với mong muốn nhất.\nChúc bạn kiên trì và sớm đạt được mục tiêu nhé! 💪✨";

const OUTRO_SHORT =
  "\n\n—\n*Lưu ý:* Gợi ý chỉ mang tính tham khảo (mỗi người khác nhau). Chúc bạn sớm đạt mục tiêu! 💪";

const HEALTH_Q_RE =
  /(dinh\s*dưỡng|dinh\s*duong|calo|kcal|macro|protein|carb|fat|giảm\s*cân|tăng\s*cân|tăng\s*cơ|giảm\s*mỡ|lịch\s*tập|workout|tập\s*luyện|tập\s*gì|gym|cardio|hiit)/i;

function shouldAppendOutroIntent(intent, userText = "") {
  // các intent “chắc chắn” thuộc dinh dưỡng/tập luyện
  if (
    intent === "nutrition" ||
    intent === "meal_scan" ||
    intent === "menu_generate" ||
    intent === "plan_generate" ||
    intent === "menu_recommend" ||
    intent === "plan_recommend"
  ) {
    return true;
  }
  // nếu intent = general nhưng câu hỏi vẫn là dinh dưỡng/tập luyện => vẫn chốt
  if (intent === "general" && HEALTH_Q_RE.test(s(userText))) return true;
  return false;
}

function appendOutroSmart(reply, intent, userText = "") {
  const r = s(reply);
  if (!r) return r;
  if (!shouldAppendOutroIntent(intent, userText)) return r;

  // tránh lặp disclaimer
  const already =
    /mang\s*tính\s*tham\s*khảo|không\s*hoàn\s*hảo|mỗi\s*người\s*khác\s*nhau/i.test(r);

  if (already) {
    // vẫn thêm câu chúc nếu chưa có
    if (!/chúc\s*bạn/i.test(r)) return r + "\nChúc bạn sớm đạt được mục tiêu nhé! 💪✨";
    return r;
  }

  // nếu reply dài => outro ngắn
  if (r.length >= 2600) return r + OUTRO_SHORT;
  return r + OUTRO_LONG;
}

function tryParseJsonLoose(text) {
  const raw = s(text);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const i = raw.indexOf("{");
    const j = raw.lastIndexOf("}");
    if (i >= 0 && j > i) {
      try {
        return JSON.parse(raw.slice(i, j + 1));
      } catch {}
    }
    return null;
  }
}

const ROUTE_INTENTS = new Set([
  "menu_recommend",
  "menu_generate",
  "plan_recommend",
  "plan_generate",
  "nutrition",
  "general",
]);

async function routeByLLM({ text, lastMeta }) {
  const sys = [
    "Bạn là FitMatch AI Router.",
    "Nhiệm vụ: phân loại ý định của người dùng để hệ thống quyết định chạy logic nội bộ hay để AI trả lời tự do.",
    "",
    "ĐỊNH DẠNG NHẤN MẠNH (tùy chọn trong field reply):",
    "- Dùng **...** để in đậm, và ==...== để tô nền những chỗ quan trọng (số kcal, macro, bước hành động).",
    "- Không dùng HTML, không dùng markdown khác (không headings, không code block).",
    "",
    "CHỈ TRẢ JSON THUẦN (không markdown) theo schema:",
    "{",
    '  "intent": "menu_recommend|menu_generate|plan_recommend|plan_generate|nutrition|general",',
    '  "confidence": 0-1,',
    '  "reply": "chỉ điền khi intent = nutrition hoặc general, còn lại để chuỗi rỗng",',
    '  "notes": "ghi ngắn 1 dòng lý do chọn intent (tùy chọn)"',
    "}",
    "",
    "QUY TẮC CHỌN INTENT:",
    "- menu_recommend: user hỏi gợi ý thực đơn/chế độ ăn/ăn gì/bữa sáng-trưa-tối/meal plan/diet theo mục tiêu.",
    "- menu_generate: user muốn 'tạo thực đơn mới', 'thực đơn khác', 'không ưng', 'thêm lựa chọn', 'tùy chỉnh theo nhu cầu'.",
    "- plan_recommend: user hỏi gợi ý lịch tập/tập gì/workout plan/routine.",
    "- plan_generate: user muốn 'tạo lịch tập mới', 'lịch tập khác', 'không ưng', 'tùy chỉnh lịch'.",
    "- nutrition: user hỏi về kcal/macro/dinh dưỡng theo câu hỏi chung (không yêu cầu thực đơn DB).",
    "- general: còn lại.",
    "",
    "RÀNG BUỘC AN TOÀN:",
    "- KHÔNG tự ý chọn plan_* nếu user không hỏi tập luyện.",
    "- Nếu intent là menu_* hoặc plan_* thì reply bắt buộc là chuỗi rỗng.",
    
  ].join("\n");

  const ctx = [
    `Tin nhắn user: ${s(text)}`,
    lastMeta?.action ? `Ngữ cảnh trước: ${s(lastMeta.action)}` : "",
    lastMeta?.intent ? `Intent trước: ${s(lastMeta.intent)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let out = "";
  try {
    out = await callOpenAIResponses({
      systemText: sys,
      historyItems: [{ role: "user", text: ctx, imageUrls: [] }],
      temperature: 0,
      maxOutputTokens: getMaxOutTokensByIntent("router"),
    });
  } catch (e) {
    out = await callOpenAIChatFallback({
      systemText: sys,
      historyItems: [{ role: "user", text: ctx, imageUrls: [] }],
      maxOutputTokens: getMaxOutTokensByIntent("router"),
    });
  }

  const parsed = tryParseJsonLoose(out);
  const intent = s(parsed?.intent);
  const confidence = Number(parsed?.confidence);

  if (!ROUTE_INTENTS.has(intent)) return null;
  return {
    intent,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    reply: s(parsed?.reply),
    notes: s(parsed?.notes),
  };
}

/* =========================
 * BUILD SUGGESTIONS (đã làm sạch)
 * - KHÔNG tự ý gợi ý plan nếu user không hỏi
 * ========================= */
async function buildSuggestions({ userId, userText, detectedFoodName, intent }) {
  const out = { foods: [], menus: [], plans: [] };

  const allowMenus = intent === "menu_recommend" || intent === "menu_generate";
  const allowPlans = intent === "plan_recommend" || intent === "plan_generate";

  // FOODS (luôn ok: giúp tìm món tương tự)
  const foodQuery = s(detectedFoodName) || s(userText);
  if (foodQuery) {
    const foods = await Food.find(
      { $text: { $search: foodQuery }, status: "approved" },
      {
        name: 1,
        imageUrl: 1,
        portionName: 1,
        massG: 1,
        unit: 1,
        kcal: 1,
        proteinG: 1,
        carbG: 1,
        fatG: 1,
      }
    )
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean()
      .catch(() => []);

    out.foods = safeArr(foods).map((f) => ({
      id: f._id,
      name: f.name,
      imageUrl: f.imageUrl,
      portionName: f.portionName,
      massG: f.massG,
      unit: f.unit,
      kcal: f.kcal,
      proteinG: f.proteinG,
      carbG: f.carbG,
      fatG: f.fatG,
    }));
  }

  // MENUS (chỉ khi user hỏi thực đơn)
  if (allowMenus) {
    const { goalKey, targetKcal } = await getUserGoalAndTargetKcal(userId);
    if (targetKcal) {
      const rec = await findSuggestMenusForUser({ userId, goalKey, targetKcal, userText, limit: 3 });
      out.menus = safeArr(rec.items)
        .slice(0, 3)
        .map((m) => ({
          ...m,
          kcalRange: rec.range ? { min: rec.range.min, max: rec.range.max } : undefined,
          goalKey: goalKey || undefined,
        }));
    }
  }

  // PLANS (chỉ khi user hỏi lịch tập)
  if (allowPlans) {
    const category = pickFromEnums(userText, SUGGEST_PLAN_CATEGORIES) || undefined;
    const level = pickFromEnums(userText, SUGGEST_PLAN_LEVELS) || undefined;
    const goal = pickFromEnums(userText, SUGGEST_PLAN_GOALS) || undefined;

    const planFilter = { status: { $ne: "archived" } };
    if (category) planFilter.category = category;
    if (level) planFilter.level = level;
    if (goal) planFilter.goal = goal;

    const plans = await SuggestPlan.find(
      planFilter,
      { name: 1, imageUrl: 1, category: 1, level: 1, goal: 1, savedBy: 1, createdAt: 1, sessions: 1 }
    )
      .sort({ createdAt: -1 })
      .limit(3)
      .lean()
      .catch(() => []);

    out.plans = safeArr(plans).map((p) => {
      const { sessionsCount, exercisesCount } = calcPlanStats(p);
      return {
        id: p._id,
        name: p.name,
        imageUrl: p.imageUrl,
        category: p.category,
        level: p.level,
        goal: p.goal,
        sessionsCount,
        exercisesCount,
        saved: safeArr(p.savedBy).some((u) => String(u) === String(userId)),
      };
    });
  }

  return out;
}

/* =========================
 * GET /api/ai/messages
 * ========================= */
export async function listAiMessages(req, res) {
  const userId = req.userId;
  const limit = Math.min(Number(req.query.limit) || 80, 200);
  const skip = Math.max(Number(req.query.skip) || 0, 0);

  const docs = await AiMessage.find({ user: userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit + 1)
    .lean();

  const hasMore = docs.length > limit;
  const items = docs.slice(0, limit).reverse().map(toClientMsg);
  res.json({ items, hasMore, limit, skip });
}

/* =========================
 * POST /api/ai/images
 * ========================= */
export async function uploadAiImage(req, res) {
  if (!req.file?.buffer) {
    return res.status(400).json({ message: "Vui lòng chọn ảnh (field: image)" });
  }
  try {
    const url = await uploadImageWithResize(
      req.file.buffer,
      "asset/folder/ai_chat",
      { width: 1024, height: 1024, fit: "inside", withoutEnlargement: true },
      { quality: 85 }
    );
    return res.json({ url });
  } catch (e) {
    console.error("[ai.upload]", e?.message || e);
    return res.status(500).json({ message: "Upload ảnh thất bại" });
  }
}

/* =========================
 * POST /api/ai/chat
 * body: { text, imageUrls?:[] }
 * ========================= */
export async function sendAiChat(req, res) {
  try {
    const userId = req.userId;
    const text = s(req.body?.text);
    const imageUrls = safeArr(req.body?.imageUrls).filter((u) => typeof u === "string" && u.startsWith("http"));

    if (!text && !imageUrls.length) {
      return res.status(400).json({ message: "Thiếu nội dung chat" });
    }

    const intent = inferIntent(text, imageUrls);

    // save user message
    const userMessage = await AiMessage.create({
      user: userId,
      role: "user",
      text,
      imageUrls,
      meta: { intent },
    });

    // ===== YES/NO tạo món: chỉ xử lý khi thật sự đang xác nhận tạo FOOD =====
    const OFFER_TTL_MS = 10 * 60 * 1000; // 10 phút

    const canHandleFoodConfirm =
      !imageUrls.length &&
      !GEN_MENU_RE.test(text) &&
      !GEN_PLAN_RE.test(text) &&
      intent !== "menu_recommend" &&
      intent !== "plan_recommend";

    const lastOfferFood = canHandleFoodConfirm
      ? await AiMessage.findOne({
          user: userId,
          role: "assistant",
          "meta.offerCreateFood": true,
          "meta.foodDraft": { $exists: true },
          createdAt: { $gte: new Date(Date.now() - OFFER_TTL_MS) },
        })
          .sort({ createdAt: -1 })
          .lean()
          .catch(() => null)
      : null;

    if (canHandleFoodConfirm && (YES_RE.test(text) || CREATE_FOOD_RE.test(text)) && lastOfferFood?.meta?.foodDraft) {
      const assistantMessage = await AiMessage.create({
        user: userId,
        role: "assistant",
        text: "Ok ✅ Mình đã chuẩn bị dữ liệu. Mình sẽ mở trang Tạo món để bạn kiểm tra và nhấn Tạo.",
        imageUrls: [],
        meta: {
          action: "create_food",
          foodDraft: lastOfferFood.meta.foodDraft,
          hasSimilar: !!lastOfferFood.meta.hasSimilar,
          similarFoods: safeArr(lastOfferFood.meta.similarFoods),
          suggestions: lastOfferFood?.meta?.suggestions || undefined,
        },
      });

      return res.json({
        userMessage: toClientMsg(userMessage),
        assistantMessage: toClientMsg(assistantMessage),
        items: [toClientMsg(assistantMessage)],
        suggestions: lastOfferFood?.meta?.suggestions || undefined,
      });
    }

    if (canHandleFoodConfirm && NO_RE.test(text) && lastOfferFood?.meta?.foodDraft) {
      const assistantMessage = await AiMessage.create({
        user: userId,
        role: "assistant",
        text: "Ok nha 👍 Nếu bạn muốn tạo món sau, cứ gửi lại ảnh hoặc nói 'tạo món' nhé.",
        imageUrls: [],
        meta: { action: "dismiss_create_food" },
      });

      return res.json({
        userMessage: toClientMsg(userMessage),
        assistantMessage: toClientMsg(assistantMessage),
        items: [toClientMsg(assistantMessage)],
      });
    }

    // ===== SMART ROUTING =====
    let smart = null;
    if (!imageUrls.length) {
      const lastAssistant = await AiMessage.findOne({ user: userId, role: "assistant" })
        .sort({ createdAt: -1 })
        .lean()
        .catch(() => null);

      const ruleIntent = inferIntent(text, imageUrls);
      const needRouter =
        ruleIntent === "general" ||
        /(khác|thêm|tùy\s*chỉnh|không\s*ưng|không\s*hợp|đổi|thay)/i.test(text);

      if (needRouter) smart = await routeByLLM({ text, lastMeta: lastAssistant?.meta });
    }

    // ưu tiên explicit commands
    let intentFinal = inferIntent(text, imageUrls);
    if (GEN_MENU_RE.test(text)) intentFinal = "menu_generate";
    if (GEN_PLAN_RE.test(text)) intentFinal = "plan_generate";

    if (smart?.intent && smart.confidence >= 0.55) {
      intentFinal = smart.intent;
    }

    await AiMessage.updateOne({ _id: userMessage._id }, { $set: { "meta.intent": intentFinal } }).catch(() => null);

    // =========================
    // MENU RECOMMEND / GENERATE
    // =========================
    if (!imageUrls.length && (intentFinal === "menu_recommend" || intentFinal === "menu_generate")) {
      const { goalKey: profileGoalKey, goalLabel: profileGoalLabel, targetKcal } = await getUserGoalAndTargetKcal(userId);

      const requestedGoalKey = detectGoalOverride(text);
      const appliedGoalKey = requestedGoalKey || profileGoalKey || "duy_tri";
      const appliedGoalLabel = goalLabelByKey(appliedGoalKey) || profileGoalLabel;
      const profileLabel = profileGoalLabel || goalLabelByKey(profileGoalKey);

      const rangeFromText = parseKcalRangeFromText(text);
      const appliedTargetKcal =
        targetKcal || (rangeFromText ? Math.round((rangeFromText.min + rangeFromText.max) / 2) : null);

      if (intentFinal === "menu_generate") {
        const days = parseMenuDaysFromText(text) || 3;
        const mealsPerDay = parseMealsPerDayFromText(text) || 3;
        const slots = mealSlotsByCount(mealsPerDay);

        const sys = [
          "Bạn là FitMatch AI Coach.",
          "Hãy tạo một bộ THỰC ĐƠN GỢI Ý (không lưu DB) cho người dùng.",
          "Ngôn ngữ: Tiếng Việt, rõ ràng, đủ ý nhưng không lan man.",
          "QUY TẮC ƯU TIÊN: nếu người dùng nêu mục tiêu, ưu tiên tuyệt đối mục tiêu đó (không bám cứng mục tiêu hồ sơ).",
          "",
          "Yêu cầu:",
          `- Mục tiêu theo yêu cầu: ${appliedGoalLabel || appliedGoalKey}`,
          `- Calo mục tiêu tham khảo: ${appliedTargetKcal ? Math.round(appliedTargetKcal) : "không rõ"} kcal/ngày`,
          `- Tạo ${days} ngày (Ngày 1-${days}), mỗi ngày ${mealsPerDay} bữa: ${slots.join(" / ")}.`,
          "- Mỗi bữa liệt kê 2-4 món, ước tính kcal từng món và tổng kcal/ngày xấp xỉ mục tiêu.",
          "- Không cần nói về DB FitMatch.",
          "- Có thể dùng **...** để in đậm và ==...== để tô nền chỗ quan trọng (kcal, mục tiêu, bước làm).",
          "- Không dùng HTML, không dùng code block.",
        ].join("\n");

        let genText = "";
        try {
          const maxTokens = calcMenuGenTokens(days, mealsPerDay);

          genText = await callOpenAIResponses({
            systemText: sys,
            historyItems: [{ role: "user", text, imageUrls: [] }],
            maxOutputTokens: maxTokens,
          });
        } catch (e) {
          genText = await callOpenAIChatFallback({
            systemText: sys,
            historyItems: [{ role: "user", text, imageUrls: [] }],
            maxOutputTokens: getMaxOutTokensByIntent("menu_generate"),
          });
        }

        genText = appendOutroSmart(genText, "menu_generate", text);

        const assistantMessage = await AiMessage.create({
          user: userId,
          role: "assistant",
          text: s(genText) || "Mình chưa tạo được thực đơn mới, bạn thử lại giúp mình nhé.",
          imageUrls: [],
          meta: {
            intent: "menu_generate",
            action: "virtual_menu",
            goalKey: appliedGoalKey || undefined,
            targetKcal: appliedTargetKcal || undefined,
          },
        });

        return res.json({
          userMessage: toClientMsg(userMessage),
          assistantMessage: toClientMsg(assistantMessage),
          items: [toClientMsg(assistantMessage)],
        });
      }

      if (!appliedTargetKcal) {
        const replyMissing =
          "Mình chưa thấy (Calo mục tiêu) trong hồ sơ của bạn.\n" +
          "Bạn vào *Tài khoản → Hồ sơ* (hoặc Onboarding) để cập nhật, rồi quay lại nhắn: “Gợi ý thực đơn cho mình” nhé.";

        const assistantMessage = await AiMessage.create({
          user: userId,
          role: "assistant",
          text: replyMissing,
          imageUrls: [],
          meta: { intent: intentFinal, action: "menu_missing_target", goalKey: appliedGoalKey || profileGoalKey || undefined },
        });

        return res.json({
          userMessage: toClientMsg(userMessage),
          assistantMessage: toClientMsg(assistantMessage),
          items: [toClientMsg(assistantMessage)],
        });
      }

      const rec = await findSuggestMenusForUser({
        userId,
        goalKey: appliedGoalKey,
        targetKcal: appliedTargetKcal,
        userText: text,
        limit: 6,
      });

      let reply = formatMenuRecommendReply({
        profileGoalLabel: profileLabel,
        appliedGoalLabel,
        targetKcal: appliedTargetKcal,
        range: rec.range,
        items: rec.items,
      });

      reply = appendOutroSmart(reply, "menu_recommend", text);

      const assistantMessage = await AiMessage.create({
        user: userId,
        role: "assistant",
        text: reply,
        imageUrls: [],
        meta: {
          intent: intentFinal,
          action: "recommend_menus",
          menuRecommendations: {
            goalKey: appliedGoalKey || undefined,
            goalLabel: appliedGoalLabel || undefined,
            targetKcal: appliedTargetKcal || undefined,
            range: rec.range || undefined,
            items: rec.items || [],
          },
          suggestions: { menus: rec.items || [] },
        },
      });

      return res.json({
        userMessage: toClientMsg(userMessage),
        assistantMessage: toClientMsg(assistantMessage),
        items: [toClientMsg(assistantMessage)],
        suggestions: { menus: rec.items || [] },
      });
    }

    // =========================
    // PLAN RECOMMEND / GENERATE
    // =========================
    if (!imageUrls.length && (intentFinal === "plan_recommend" || intentFinal === "plan_generate")) {
      const { goalKey: profileGoalKey, goalLabel: profileGoalLabel } = await getUserGoalAndTargetKcal(userId);

      const requestedGoalKey = detectGoalOverride(text);
      const appliedGoalKey = requestedGoalKey || profileGoalKey;
      const appliedGoalLabel = appliedGoalKey ? goalLabelByKey(appliedGoalKey) : "";
      const profileLabel = profileGoalLabel || goalLabelByKey(profileGoalKey);

      if (!appliedGoalKey) {
        const replyMissing =
          "Mình chưa thấy (Mục tiêu luyện tập) trong hồ sơ của bạn.\n" +
          "Bạn vào *Tài khoản → Hồ sơ* (hoặc Onboarding) để cập nhật mục tiêu, rồi nhắn lại: “Gợi ý lịch tập cho mình” nhé.";

        const assistantMessage = await AiMessage.create({
          user: userId,
          role: "assistant",
          text: replyMissing,
          imageUrls: [],
          meta: { intent: intentFinal, action: "plan_missing_goal" },
        });

        return res.json({
          userMessage: toClientMsg(userMessage),
          assistantMessage: toClientMsg(assistantMessage),
          items: [toClientMsg(assistantMessage)],
        });
      }

      if (intentFinal === "plan_generate") {
        const intensity = await getUserTrainingIntensity(userId);
        const level = parsePlanLevelFromIntensity(intensity, text) || "Cơ bản";
        const sessionsPerWeek = level === "Nâng cao" ? 5 : level === "Trung bình" ? 4 : 3;

        const sys = [
          "Bạn là FitMatch AI Coach.",
          "Hãy tạo một LỊCH TẬP GỢI Ý MỚI (không lưu DB) cho người dùng.",
          "Ngôn ngữ: Tiếng Việt, rõ ràng, đủ ý nhưng không lan man.",
          "Nếu gần hết giới hạn nội dung, hãy rút gọn bằng cách giảm số bài mỗi buổi (vẫn giữ cấu trúc buổi).",
          "Yêu cầu:",
          `- Mục tiêu theo yêu cầu: ${appliedGoalLabel || appliedGoalKey}`, requestedGoalKey && profileGoalKey && requestedGoalKey !== profileGoalKey ? `- (Tham khảo) Mục tiêu trong hồ sơ: ${profileLabel}` : "",
          `- Mức độ: ${level}`,
          `- Số buổi/tuần: ${sessionsPerWeek} buổi`,
          "- Trình bày theo Buổi 1..N.",
          "- Mỗi buổi gồm: khởi động 5-10p, 5-8 bài tập (ghi set x reps hoặc thời gian), nghỉ giữa set, giãn cơ.",
          "- Ưu tiên an toàn: nhắc kỹ thuật cơ bản, không đưa lời khuyên y khoa.",
          "- Không cần nhắc DB FitMatch.",
          "- Có thể dùng **...** để in đậm và ==...== để tô nền chỗ quan trọng (kcal, mục tiêu, bước làm).",
          "- Không dùng HTML, không dùng code block.",
        ].join("\n");

        let genText = "";
        try {
          genText = await callOpenAIResponses({
            systemText: sys,
            historyItems: [{ role: "user", text, imageUrls: [] }],
            maxOutputTokens: getMaxOutTokensByIntent("plan_generate"),
          });
        } catch (e) {
          genText = await callOpenAIChatFallback({
            systemText: sys,
            historyItems: [{ role: "user", text, imageUrls: [] }],
            maxOutputTokens: getMaxOutTokensByIntent("plan_generate"),
          });
        }

        genText = appendOutroSmart(genText, "plan_generate", text);

        const assistantMessage = await AiMessage.create({
          user: userId,
          role: "assistant",
          text: s(genText) || "Mình chưa tạo được lịch tập mới, bạn thử lại giúp mình nhé.",
          imageUrls: [],
          meta: {
            intent: "plan_generate",
            action: "virtual_plan",
            goalKey: appliedGoalKey || undefined,
            preferredLevel: level,
            sessionsPerWeek,
          },
        });

        return res.json({
          userMessage: toClientMsg(userMessage),
          assistantMessage: toClientMsg(assistantMessage),
          items: [toClientMsg(assistantMessage)],
        });
      }

      const rec = await findSuggestPlansForUser({
        userId,
        goalKey: appliedGoalKey,
        userText: text,
        limit: 6,
      });

      let reply = formatPlanRecommendReply({
        profileGoalLabel: profileLabel,
        appliedGoalLabel,
        goalKey: appliedGoalKey,
        items: rec.items,
        preferred: rec.preferred,
      });

      reply = appendOutroSmart(reply, "plan_recommend", text);

      const assistantMessage = await AiMessage.create({
        user: userId,
        role: "assistant",
        text: reply,
        imageUrls: [],
        meta: {
          intent: intentFinal,
          action: "recommend_plans",
          planRecommendations: {
            goalKey: appliedGoalKey || undefined,
            goalLabel: appliedGoalLabel || undefined,
            preferred: rec.preferred || undefined,
            items: rec.items || [],
          },
          suggestions: { plans: rec.items || [] },
        },
      });

      return res.json({
        userMessage: toClientMsg(userMessage),
        assistantMessage: toClientMsg(assistantMessage),
        items: [toClientMsg(assistantMessage)],
        suggestions: { plans: rec.items || [] },
      });
    }

    // ===== FAST PATH: Router đã tạo reply cho nutrition/general =====
    if (!imageUrls.length && (intentFinal === "nutrition" || intentFinal === "general") && s(smart?.reply)) {
      const suggestions = await buildSuggestions({
        userId,
        userText: text,
        detectedFoodName: "",
        intent: intentFinal,
      });

      const reply = appendOutroSmart(smart.reply, intentFinal, text);

      const assistantMessage = await AiMessage.create({
        user: userId,
        role: "assistant",
        text: reply,
        imageUrls: [],
        meta: {
          intent: intentFinal,
          action: "router_reply",
          router: { confidence: smart?.confidence, notes: smart?.notes },
          suggestions,
        },
      });

      return res.json({
        userMessage: toClientMsg(userMessage),
        assistantMessage: toClientMsg(assistantMessage),
        items: [toClientMsg(assistantMessage)],
        suggestions,
      });
    }

    // =========================
    // OPENAI GENERAL / MEAL SCAN JSON
    // =========================
    const history = await AiMessage.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const historyChrono = history.reverse();

    // runtimeIntent: nếu có ảnh => meal_scan; nếu không => theo router/intentFinal
    const runtimeIntent = imageUrls.length ? "meal_scan" : intentFinal;

    const systemText =
      runtimeIntent === "meal_scan"
        ? [
            "Bạn là FitMatch AI Coach.",
            "Người dùng gửi ẢNH MÓN ĂN. Nhiệm vụ: ước lượng dinh dưỡng dựa trên món TRONG ẢNH.",
            "Không nói 'tra mạng' hay trích nguồn web. Nếu khẩu phần không rõ, ước lượng hợp lý và ghi chú.",
            "",
            "ĐỊNH DẠNG NHẤN MẠNH (tùy chọn trong các string): dùng **...** và ==...==.",
            "Ví dụ: \"==520 kcal==\", \"**Protein**\". Không dùng HTML.",
            "",
            "CHỈ trả về JSON thuần (không markdown), đúng schema:",
            "{",
            '  "reply": "mô tả rõ hơn (3-6 câu): món gồm thành phần gì, cách chế biến (nếu đoán được), yếu tố nào làm thay đổi kcal nhiều (dầu/sốt/đường...), và giả định khẩu phần",',
            '  "detectedFoodName": "tên món trong ảnh (không cần chính xác 100%)",',
            '  "foodDraft": {',
            '     "name": string,',
            '     "portionName": string,',
            '     "massG": number,',
            '     "unit": "g"|"ml",',
            '     "kcal": number,',
            '     "proteinG": number|null,',
            '     "carbG": number|null,',
            '     "fatG": number|null,',
            '     "saltG": number|null,',
            '     "sugarG": number|null,',
            '     "fiberG": number|null,',
            '     "description": "mô tả món + thành phần chính + cách chế biến (nếu đoán được), viết gọn 1-3 câu"',
            "  },",
            '  "notes": ["gạch đầu dòng 3-6 ý: giả định khẩu phần, dầu/sốt/đường, phần không chắc trong ảnh..."]',
            "}",
          ].join("\n")
        : [
            "Bạn là FitMatch AI Coach.",
            "Nhiệm vụ: hỗ trợ dinh dưỡng & luyện tập an toàn, thực tế.",
            "Không chẩn đoán bệnh. Nếu có vấn đề y tế, khuyên người dùng gặp bác sĩ.",
            "ĐỊNH DẠNG NHẤN MẠNH (tùy chọn trong reply): dùng **...** và ==...== để nhấn mạnh.",
            "Không dùng HTML, không dùng markdown khác.",
            "",
            "QUY TẮC: Không tự ý gợi ý lịch tập/plan nếu người dùng chưa hỏi. Chỉ trả lịch tập khi user yêu cầu rõ ràng.",
            "",
            "YÊU CẦU TRẢ LỜI: đầy đủ hơn nhưng không lan man.",
            "- Trả lời theo cấu trúc: (1) Tóm tắt 1-2 câu, (2) Gợi ý hành động 4-8 gạch đầu dòng, (3) Lưu ý an toàn/nguyên tắc.",
            "- Nếu thiếu dữ liệu (tuổi, chiều cao, cân nặng, mức vận động...), hãy đưa giả định hợp lý và hỏi 1 câu ngắn để bổ sung.",
            "- Ưu tiên đưa khoảng/ước lượng thay vì khẳng định tuyệt đối.",
            "",
            "CHỈ trả về JSON thuần (không markdown) theo format:",
            "{",
            '  "reply": "câu trả lời để hiển thị",',
            '  "detectedFoodName": "nếu có ảnh món ăn thì ghi tên món (có thể rỗng)",',
            '  "estimated": { "kcal": number|null, "proteinG": number|null, "carbG": number|null, "fatG": number|null }',
            "}",
          ].join("\n");

    const modelHistory =
      runtimeIntent === "meal_scan"
        ? [{ role: "user", text, imageUrls }]
        : historyChrono.map((m) => ({ role: m.role, text: m.text, imageUrls: m.imageUrls }));

    const budgetIntent =
      runtimeIntent === "meal_scan" ? "meal_scan" : runtimeIntent === "nutrition" ? "nutrition" : "general";

    let outText = "";
    try {
      outText = await callOpenAIResponses({
        systemText,
        historyItems: modelHistory,
        maxOutputTokens: getMaxOutTokensByIntent(budgetIntent),
      });
    } catch (e) {
      console.warn("[ai.openai.responses] fallback ->", e?.message || e);
      outText = await callOpenAIChatFallback({
        systemText,
        historyItems: modelHistory,
        maxOutputTokens: getMaxOutTokensByIntent(budgetIntent),
      });
    }

    const parsed = tryParseJsonLoose(outText);
    const detectedFoodName = s(parsed?.detectedFoodName) || "";

    const suggestions = await buildSuggestions({
      userId,
      userText: text,
      detectedFoodName,
      intent: runtimeIntent,
    });

    let reply = s(parsed?.reply) || s(outText) || "Mình chưa nhận được nội dung trả lời từ AI.";

    let foodDraft = null;
    let similarFoods = [];
    let hasSimilar = false;

    if (runtimeIntent === "meal_scan") {
      foodDraft = buildFoodDraftFromParsed({
        parsed,
        imageUrls,
        fallbackName: detectedFoodName,
      });

      const queryName = foodDraft?.name || detectedFoodName;
      similarFoods = await findSimilarFoods({ userId, query: queryName, limit: 5 });
      hasSimilar = similarFoods.length > 0;

      foodDraft = fillDraftFromSimilar(foodDraft, similarFoods);

      reply = formatMealScanReply({
        parsedReply: s(parsed?.reply),
        foodDraft,
        similarFoods,
        notes: parsed?.notes,
      });
    }

    // ✅ chốt theo yêu cầu (smart dài/ngắn)
    if (budgetIntent !== "meal_scan") {
      reply = appendOutroSmart(reply, budgetIntent, text);
    }

    const assistantMessage = await AiMessage.create({
      user: userId,
      role: "assistant",
      text: reply,
      imageUrls: [],
      meta: {
        intent: runtimeIntent,
        detectedFoodName: detectedFoodName || undefined,
        estimated: parsed?.estimated || undefined,
        suggestions,

        offerCreateFood: runtimeIntent === "meal_scan",
        foodDraft: foodDraft || undefined,
        similarFoods: similarFoods || [],
        hasSimilar,
      },
    });

    return res.json({
      userMessage: toClientMsg(userMessage),
      assistantMessage: toClientMsg(assistantMessage),
      items: [toClientMsg(assistantMessage)],
      suggestions,
    });
  } catch (e) {
    console.error("[ai.chat]", e);
    if (!OPENAI_KEY) {
      return res.status(500).json({ message: "Chưa cấu hình OPENAI_API_KEY trên server" });
    }
    return res.status(500).json({ message: "AI server lỗi, vui lòng thử lại" });
  }
}

/* =========================
 * DELETE /api/ai/messages
 * => Clear all AI chat history of current user
 * ========================= */
export async function clearAiMessages(req, res) {
  try {
    const userId = req.userId;
    await AiMessage.deleteMany({ user: userId });
    return res.json({ ok: true });
  } catch (e) {
    console.error("[ai.clear]", e?.message || e);
    return res.status(500).json({ message: "Không thể xóa đoạn chat AI" });
  }
}
