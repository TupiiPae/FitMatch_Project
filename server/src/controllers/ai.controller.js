// server/src/controllers/ai.controller.js
import https from "https";
import http from "http";
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

const toClientMsg = (m) => {
  const o = m?.toObject ? m.toObject() : m || {};
  const urls = safeArr(o.imageUrls).filter((u) => typeof u === "string" && u);
  return {
    ...o,
    content: s(o.text),
    attachments: urls.map((u) => ({ type: "image", url: u })),
  };
};

// ✅ thu hẹp YES để tránh bắt nhầm "tạo thực đơn mới"
const YES_RE = /^(có|co|ok|okay|yes|y|đồng\s*ý|dong\s*y|được|duoc|tạo\s*món|tao\s*mon)\b/i;
const NO_RE = /^(không|khong|no|n|thôi|thoi|hủy|huy)\b/i;

const escapeRegex = (x) => String(x || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function numOrNull(v) {
  const n = Number(v);
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

/* =========================
 * FITMATCH: MENU RECOMMEND HELPERS
 * ========================= */

const GOAL_LABEL_VI = {
  giam_can: "Giảm cân",
  giam_mo: "Giảm mỡ",
  duy_tri: "Duy trì cân nặng",
  tang_can: "Tăng cân",
  tang_co: "Tăng cơ",
};

const GOAL_GAIN = new Set(["tang_can", "tang_co"]);
const GOAL_LOSS = new Set(["giam_can", "giam_mo"]);
const GOAL_MAINTAIN = new Set(["duy_tri"]);

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
    {
      $match: {
        ...extraMatch,
        kcalPerDay: { $gte: range.min, $lte: range.max },
      },
    },
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

function formatMenuRecommendReply({ goalLabel, targetKcal, range, items }) {
  const lines = [];
  if (goalLabel) lines.push(`Mục tiêu hiện tại của bạn: **${goalLabel}**.`);
  if (Number.isFinite(targetKcal)) lines.push(`Calo mục tiêu: **${Math.round(targetKcal)} kcal/ngày**.`);

  if (range) lines.push(`Mình sẽ gợi ý thực đơn trong khoảng **${range.min}–${range.max} kcal/ngày**.`);

  if (!items?.length) {
    lines.push("");
    lines.push("Hiện tại mình **chưa tìm thấy** thực đơn phù hợp trong FitMatch.");
    lines.push("Bạn có muốn mình **tạo một bộ thực đơn mới** (không lưu vào FitMatch) không?");
    lines.push("👉 Gõ: **tạo thực đơn mới**");
    return lines.join("\n");
  }

  lines.push("");
  lines.push("Dưới đây là một vài thực đơn phù hợp (bạn có thể bấm để xem chi tiết):");
  items.slice(0, 6).forEach((m, idx) => {
    const kcal = Number(m?.kcalPerDay) || 0;
    const days = Number(m?.numDays) || 1;
    const cate = m?.category ? ` · ${m.category}` : "";
    lines.push(`${idx + 1}. ${m?.name || "Thực đơn"} — **${kcal} kcal/ngày** · ${days} ngày${cate}`);
  });

  return lines.join("\n");
}

const GEN_MENU_RE = /(tạo|tao).*(thực\s*đơn|menu).*(mới|new)/i;

function buildFoodDraftFromParsed({ parsed, imageUrls, fallbackName }) {
  const detected =
    s(parsed?.detectedFoodName) || s(parsed?.foodDraft?.name) || s(fallbackName) || "Món ăn từ ảnh";

  const fd = parsed?.foodDraft || {};
  const est = parsed?.estimated || {};

  const massG = clampNum(numOrNull(fd.massG), 1, 10000) ?? 100;
  const unit = fd.unit === "ml" ? "ml" : "g";
  const kcal = clampNum(numOrNull(fd.kcal ?? est.kcal), 0, 10000) ?? null;

  return {
    name: detected,
    imageUrl: safeArr(imageUrls)[0] || "",
    portionName: s(fd.portionName) || "1 phần",
    massG,
    unit,
    kcal,
    proteinG: clampNum(numOrNull(fd.proteinG ?? est.proteinG), 0, 10000),
    carbG: clampNum(numOrNull(fd.carbG ?? est.carbG), 0, 10000),
    fatG: clampNum(numOrNull(fd.fatG ?? est.fatG), 0, 10000),
    saltG: clampNum(numOrNull(fd.saltG), 0, 10000),
    sugarG: clampNum(numOrNull(fd.sugarG), 0, 10000),
    fiberG: clampNum(numOrNull(fd.fiberG), 0, 10000),
    description: s(fd.description) || "",
    confidence: s(parsed?.confidence) || "",
    notes: safeArr(parsed?.notes),
  };
}

function inferIntent(text, imageUrls) {
  const t = s(text).toLowerCase();
  if (safeArr(imageUrls).length) return "meal_scan";
  if (/(thực\s*đơn|menu|bữa\s*ăn)/i.test(t)) return "menu_recommend";
  if (/(lịch\s*tập|workout|plan|kế\s*hoạch\s*tập)/i.test(t)) return "plan_recommend";
  if (/(calo|kcal|macro|protein|carb|fat)/i.test(t)) return "nutrition";
  return "general";
}

function pickFromEnums(text, arr) {
  const t = s(text).toLowerCase();
  return arr.find((x) => t.includes(String(x).toLowerCase())) || null;
}

/** ===== Reply format dạng ý cho meal_scan ===== */
function formatMealScanReply({ parsedReply, foodDraft, similarFoods }) {
  const name = s(foodDraft?.name) || "món ăn trong ảnh";
  const portionLine = `${s(foodDraft?.portionName) || "1 phần"} (${fmtNum(foodDraft?.massG)}${foodDraft?.unit || "g"})`;

  const lines = [];
  const p = s(parsedReply);
  if (p) {
    const firstSentence = p.split(/\n+/)[0].trim();
    lines.push(firstSentence);
  } else {
    lines.push(`Món ăn trong hình là ${name}.`);
  }

  lines.push(`Khẩu phần ước tính: ${portionLine}`);
  lines.push(`  - Ước tính năng lượng: ${foodDraft?.kcal != null ? `${fmtNum(foodDraft.kcal)} kcal` : "-"}.`);
  lines.push(`  - Đạm (Protein): ${foodDraft?.proteinG != null ? `${fmtNum(foodDraft.proteinG)} g` : "-"}.`);
  lines.push(`  - Đường bột (Carb): ${foodDraft?.carbG != null ? `${fmtNum(foodDraft.carbG)} g` : "-"}.`);
  lines.push(`  - Chất béo (Fat): ${foodDraft?.fatG != null ? `${fmtNum(foodDraft.fatG)} g` : "-"}.`);

  lines.push(`Giá trị dinh dưỡng có thể thay đổi tuỳ theo cách chế biến và khẩu phần thực tế.`);

  const hasSimilar = safeArr(similarFoods).length > 0;
  lines.push("");
  lines.push(
    hasSimilar
      ? `FitMatch đã có ${similarFoods.length} món tương tự trong danh sách.`
      : `Chưa thấy món tương tự trong danh sách món ăn của FitMatch.`
  );
  lines.push(`Bạn có muốn tạo món ăn mới với các chỉ số mình vừa ước lượng không? (Trả lời “Có” hoặc bấm “Tạo món”)`);

  return lines.join("\n");
}

/** ===== Similar foods: token overlap scoring ===== */
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
    "mon",
    "an",
    "phan",
    "khau",
    "to",
    "bat",
    "chen",
    "dia",
    "hop",
    "mieng",
    "cai",
    "ly",
    "chai",
    "goi",
    "them",
    "it",
    "nhieu",
    "vua",
    "thap",
    "cao",
    "tuoi",
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

/* =========================
 * OPENAI HTTP HELPERS
 * ========================= */

function postJsonNode(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "http:" ? http : https;

    const req = lib.request(
      {
        method: "POST",
        hostname: u.hostname,
        port: u.port || (u.protocol === "http:" ? 80 : 443),
        path: u.pathname + (u.search || ""),
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
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
            return reject(
              new Error(`Invalid JSON response (${res.statusCode}): ${String(data).slice(0, 300)}`)
            );
          }
        });
      }
    );

    req.setTimeout(20000, () => req.destroy(new Error("Request timeout")));
    req.on("error", reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

// ✅ extract text cho Responses API (tránh json.output_text rỗng)
function extractResponsesText(json) {
  const direct = s(json?.output_text);
  if (direct) return direct;

  const chunks = [];
  for (const item of safeArr(json?.output)) {
    for (const c of safeArr(item?.content)) {
      if (c?.type === "output_text" && typeof c?.text === "string") chunks.push(c.text);
    }
  }
  return s(chunks.join("\n"));
}

async function callOpenAIResponses({ systemText, historyItems }) {
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

  const payload = { model: OPENAI_MODEL, input, temperature: 0.4 };

  const json = await postJsonNode(`${OPENAI_BASE}/v1/responses`, payload, {
    Authorization: `Bearer ${OPENAI_KEY}`,
  });

  const txt = extractResponsesText(json);
  if (!txt) throw new Error("Empty output from Responses API");
  return txt;
}

async function callOpenAIChatFallback({ systemText, historyItems }) {
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

  const payload = { model: OPENAI_MODEL, messages, temperature: 0.4 };

  const json = await postJsonNode(`${OPENAI_BASE}/v1/chat/completions`, payload, {
    Authorization: `Bearer ${OPENAI_KEY}`,
  });

  return s(json?.choices?.[0]?.message?.content) || "";
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

async function buildSuggestions({ userId, userText, detectedFoodName }) {
  const out = { foods: [], menus: [], plans: [] };

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

  // ===== MENUS (theo goal + kcal/ngày) =====
  const { goalKey, targetKcal } = await getUserGoalAndTargetKcal(userId);
  if (targetKcal) {
    const rec = await findSuggestMenusForUser({
      userId,
      goalKey,
      targetKcal,
      userText,
      limit: 3,
    });

    out.menus = safeArr(rec.items)
      .slice(0, 3)
      .map((m) => ({
        ...m,
        kcalRange: rec.range ? { min: rec.range.min, max: rec.range.max } : undefined,
        goalKey: goalKey || undefined,
      }));
  }

  const category = pickFromEnums(userText, SUGGEST_PLAN_CATEGORIES) || undefined;
  const level = pickFromEnums(userText, SUGGEST_PLAN_LEVELS) || undefined;
  const goal = pickFromEnums(userText, SUGGEST_PLAN_GOALS) || undefined;

  const planFilter = { status: "active" };
  if (category) planFilter.category = category;
  if (level) planFilter.level = level;
  if (goal) planFilter.goal = goal;

  const plans = await SuggestPlan.find(
    planFilter,
    { name: 1, imageUrl: 1, category: 1, level: 1, goal: 1, savedBy: 1, createdAt: 1 }
  )
    .sort({ createdAt: -1 })
    .limit(3)
    .lean()
    .catch(() => []);

  out.plans = safeArr(plans).map((p) => ({
    id: p._id,
    name: p.name,
    imageUrl: p.imageUrl,
    category: p.category,
    level: p.level,
    goal: p.goal,
    saved: safeArr(p.savedBy).some((u) => String(u) === String(userId)),
  }));

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
    const imageUrls = safeArr(req.body?.imageUrls).filter(
      (u) => typeof u === "string" && u.startsWith("http")
    );

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

    // ✅ YES/NO chỉ xử lý nếu có offerCreateFood gần nhất và còn "fresh"
    if (!imageUrls.length && (YES_RE.test(text) || NO_RE.test(text))) {
      const lastOffer = await AiMessage.findOne({
        user: userId,
        role: "assistant",
        "meta.offerCreateFood": true,
        "meta.foodDraft": { $exists: true },
      })
        .sort({ createdAt: -1 })
        .lean()
        .catch(() => null);

      const isRecent =
        lastOffer?.createdAt &&
        Date.now() - new Date(lastOffer.createdAt).getTime() < 2 * 60 * 60 * 1000; // 2 giờ

      if (lastOffer?.meta?.foodDraft && isRecent) {
        if (YES_RE.test(text)) {
          const assistantMessage = await AiMessage.create({
            user: userId,
            role: "assistant",
            text: "Ok ✅ Mình đã chuẩn bị dữ liệu. Mình sẽ mở trang Tạo món để bạn kiểm tra và nhấn Tạo.",
            imageUrls: [],
            meta: {
              action: "create_food",
              foodDraft: lastOffer.meta.foodDraft,
              hasSimilar: !!lastOffer.meta.hasSimilar,
              similarFoods: safeArr(lastOffer.meta.similarFoods),
              suggestions: lastOffer?.meta?.suggestions || undefined,
              suggestMenus: safeArr(lastOffer?.meta?.suggestions?.menus),
            },
          });

          return res.json({
            userMessage: toClientMsg(userMessage),
            assistantMessage: toClientMsg(assistantMessage),
            items: [toClientMsg(assistantMessage)],
            suggestions: lastOffer?.meta?.suggestions || undefined,
          });
        }

        if (NO_RE.test(text)) {
          const assistantMessage = await AiMessage.create({
            user: userId,
            role: "assistant",
            text: "Ok nha 👍 Nếu bạn muốn tạo món sau, cứ gửi lại ảnh hoặc nói “tạo món” nhé.",
            imageUrls: [],
            meta: { action: "dismiss_create_food" },
          });

          return res.json({
            userMessage: toClientMsg(userMessage),
            assistantMessage: toClientMsg(assistantMessage),
            items: [toClientMsg(assistantMessage)],
          });
        }
      }
      // nếu không có offer gần đây => rơi xuống flow bình thường (không return)
    }

    // =========================
    // MENU RECOMMEND (DB-first)
    // =========================
    if (!imageUrls.length && (intent === "menu_recommend" || GEN_MENU_RE.test(text))) {
      const { goalKey, goalLabel, targetKcal } = await getUserGoalAndTargetKcal(userId);

      // user yêu cầu "tạo thực đơn mới" => dùng OpenAI tạo nội dung (không lưu DB)
      if (GEN_MENU_RE.test(text)) {
        const sys = [
          "Bạn là FitMatch AI Coach.",
          "Hãy tạo một bộ THỰC ĐƠN GỢI Ý MỚI (không lưu DB) cho người dùng.",
          "Ngôn ngữ: Tiếng Việt, ngắn gọn, rõ ràng.",
          "Yêu cầu:",
          `- Mục tiêu: ${goalLabel || goalKey || "duy_tri"}`,
          `- Calo mục tiêu: ${targetKcal ? Math.round(targetKcal) : "không rõ"} kcal/ngày`,
          "- Tạo 3 ngày (Ngày 1-3), mỗi ngày 3 bữa (Sáng/Trưa/Tối).",
          "- Mỗi bữa liệt kê 2-4 món, ước tính kcal từng món và tổng kcal/ngày xấp xỉ mục tiêu.",
          "- Không cần nói về DB FitMatch.",
        ].join("\n");

        let genText = "";
        try {
          genText = await callOpenAIResponses({
            systemText: sys,
            historyItems: [{ role: "user", text, imageUrls: [] }],
          });
        } catch (e) {
          genText = await callOpenAIChatFallback({
            systemText: sys,
            historyItems: [{ role: "user", text, imageUrls: [] }],
          });
        }

        const assistantMessage = await AiMessage.create({
          user: userId,
          role: "assistant",
          text: s(genText) || "Mình chưa tạo được thực đơn mới, bạn thử lại giúp mình nhé.",
          imageUrls: [],
          meta: {
            intent: "menu_generate",
            action: "virtual_menu",
            goalKey: goalKey || undefined,
            targetKcal: targetKcal || undefined,
          },
        });

        return res.json({
          userMessage: toClientMsg(userMessage),
          assistantMessage: toClientMsg(assistantMessage),
          items: [toClientMsg(assistantMessage)],
        });
      }

      // DB recommend
      if (!targetKcal) {
        const replyMissing =
          "Mình chưa thấy **Calo mục tiêu** trong hồ sơ của bạn.\n" +
          "Bạn vào **Tài khoản → Hồ sơ** (hoặc Onboarding) để cập nhật, rồi quay lại nhắn: “Gợi ý thực đơn cho mình” nhé.";

        const assistantMessage = await AiMessage.create({
          user: userId,
          role: "assistant",
          text: replyMissing,
          imageUrls: [],
          meta: { intent, action: "menu_missing_target", goalKey: goalKey || undefined },
        });

        return res.json({
          userMessage: toClientMsg(userMessage),
          assistantMessage: toClientMsg(assistantMessage),
          items: [toClientMsg(assistantMessage)],
        });
      }

      const rec = await findSuggestMenusForUser({
        userId,
        goalKey,
        targetKcal,
        userText: text,
        limit: 6,
      });

      const reply = formatMenuRecommendReply({
        goalLabel,
        targetKcal,
        range: rec.range,
        items: rec.items,
      });

      // ✅ thêm meta.suggestMenus + kcalRange để FE render dễ
      const assistantMessage = await AiMessage.create({
        user: userId,
        role: "assistant",
        text: reply,
        imageUrls: [],
        meta: {
          intent,
          action: "recommend_menus",

          suggestMenus: rec.items || [],
          kcalRange: rec.range || undefined,
          targetKcal,
          goalKey: goalKey || undefined,
          goalLabel: goalLabel || undefined,

          menuRecommendations: {
            goalKey: goalKey || undefined,
            goalLabel: goalLabel || undefined,
            targetKcal,
            range: rec.range || undefined,
            items: rec.items || [],
          },

          // giữ cơ chế cũ
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

    // history (last 30 including this)
    const history = await AiMessage.find({ user: userId }).sort({ createdAt: -1 }).limit(30).lean();
    const historyChrono = history.reverse();

    const systemText =
      intent === "meal_scan"
        ? [
            "Bạn là FitMatch AI Coach.",
            "Người dùng gửi ẢNH MÓN ĂN. Nhiệm vụ: ước lượng dinh dưỡng dựa trên món TRONG ẢNH.",
            "Không nói 'tra mạng' hay trích nguồn web. Nếu khẩu phần không rõ, ước lượng hợp lý và ghi chú.",
            "",
            "CHỈ trả về JSON thuần (không markdown), đúng schema:",
            "{",
            '  "reply": "mô tả ngắn gọn 1-2 câu (KHÔNG cần dài)",',
            '  "detectedFoodName": "tên món trong ảnh (không cần chính xác 100%)",',
            '  "confidence": "low|medium|high",',
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
            '     "description": string',
            "  },",
            '  "notes": [string]',
            "}",
          ].join("\n")
        : [
            "Bạn là FitMatch AI Coach.",
            "Nhiệm vụ: hỗ trợ dinh dưỡng & luyện tập an toàn, thực tế.",
            "Không chẩn đoán bệnh. Nếu có vấn đề y tế, khuyên người dùng gặp bác sĩ.",
            "",
            "CHỈ trả về JSON thuần (không markdown) theo format:",
            "{",
            '  "reply": "câu trả lời để hiển thị",',
            '  "detectedFoodName": "nếu có ảnh món ăn thì ghi tên món (có thể rỗng)",',
            '  "estimated": { "kcal": number|null, "proteinG": number|null, "carbG": number|null, "fatG": number|null }',
            "}",
          ].join("\n");

    let outText = "";
    try {
      outText = await callOpenAIResponses({ systemText, historyItems: historyChrono });
    } catch (e) {
      console.warn("[ai.openai.responses] fallback ->", e?.message || e);
      outText = await callOpenAIChatFallback({ systemText, historyItems: historyChrono });
    }

    const parsed = tryParseJsonLoose(outText);
    const detectedFoodName = s(parsed?.detectedFoodName) || "";

    const suggestions = await buildSuggestions({ userId, userText: text, detectedFoodName });

    let reply = s(parsed?.reply) || s(outText) || "Mình chưa nhận được nội dung trả lời từ AI.";

    let foodDraft = null;
    let similarFoods = [];
    let hasSimilar = false;

    if (intent === "meal_scan") {
      foodDraft = buildFoodDraftFromParsed({
        parsed,
        imageUrls,
        fallbackName: detectedFoodName || text,
      });

      const queryName = foodDraft?.name || detectedFoodName || text;
      similarFoods = await findSimilarFoods({ userId, query: queryName, limit: 5 });
      hasSimilar = similarFoods.length > 0;

      reply = formatMealScanReply({
        parsedReply: s(parsed?.reply),
        foodDraft,
        similarFoods,
      });
    }

    const assistantMessage = await AiMessage.create({
      user: userId,
      role: "assistant",
      text: reply,
      imageUrls: [],
      meta: {
        intent,
        detectedFoodName: detectedFoodName || undefined,
        estimated: parsed?.estimated || undefined,

        suggestions,
        // ✅ để FE dễ render menus theo cơ chế mới
        suggestMenus: safeArr(suggestions?.menus),

        offerCreateFood: intent === "meal_scan",
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
    console.error("[ai.chat]", e?.message || e);
    if (!OPENAI_KEY) {
      return res.status(500).json({ message: "Chưa cấu hình OPENAI_API_KEY trên server" });
    }
    return res.status(500).json({ message: "AI server lỗi, vui lòng thử lại" });
  }
}
