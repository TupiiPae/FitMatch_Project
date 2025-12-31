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
import { responseOk } from "../utils/response.js";
import { uploadImageWithResize } from "../utils/cloudinary.js";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini"; // theo docs ví dụ :contentReference[oaicite:1]{index=1}
const OPENAI_BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com";

const safeArr = (v) => (Array.isArray(v) ? v : []);
const toClientMsg = (m) => {
  const o = m?.toObject ? m.toObject() : (m || {});
  const urls = safeArr(o.imageUrls).filter((u) => typeof u === "string" && u);
  return {
    ...o,
    content: s(o.text), // ✅ FE dùng content
    attachments: urls.map((u) => ({ type: "image", url: u })), // ✅ FE dùng attachments
  };
};

const s = (v) => String(v ?? "").trim();

function postJsonNode(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      {
        method: "POST",
        hostname: u.hostname,
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
          } catch (e) {
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

function getUserTargetKcal(userDoc) {
  const candidates = [
    userDoc?.profile?.caloTarget,
    userDoc?.profile?.kcalTarget,
    userDoc?.profile?.targetCalories,
    userDoc?.onboarding?.tdee,
    userDoc?.onboarding?.calorieTarget,
    userDoc?.onboarding?.targetKcal,
    userDoc?.targets?.kcal,
    userDoc?.kcalTarget,
  ];
  for (const v of candidates) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function kcalBin(targetKcal) {
  if (!Number.isFinite(targetKcal) || targetKcal <= 0) return null;
  const step = 200;
  const base = 2000;
  let low;
  if (targetKcal >= base) low = base + Math.floor((targetKcal - base) / step) * step;
  else low = Math.floor(targetKcal / step) * step;
  const high = low + step;
  return { low, high };
}

async function callOpenAIResponses({ systemText, historyItems }) {
  if (!OPENAI_KEY) throw new Error("Missing OPENAI_API_KEY");

  // Build input for Responses API (supports images via input_image). :contentReference[oaicite:2]{index=2}
  const input = [
    {
      role: "system",
      content: [{ type: "input_text", text: systemText }],
    },
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
    temperature: 0.4,
  };

  const json = await postJsonNode(`${OPENAI_BASE}/v1/responses`, payload, {
    Authorization: `Bearer ${OPENAI_KEY}`,
  });

  // docs show output_text :contentReference[oaicite:3]{index=3}
  const out = s(json?.output_text);
  return out || "";
}

async function callOpenAIChatFallback({ systemText, historyItems }) {
  // fallback to Chat Completions if needed
  const messages = [
    { role: "system", content: systemText },
    ...historyItems.map((m) => {
      if (safeArr(m.imageUrls).length) {
        // for compatibility: content array with image_url
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
  };

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
    // try extract first {...}
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

  // foods (match by detected name or user text)
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

  // menus by target kcal bin (if available)
  const me = await User.findById(userId).lean().catch(() => null);
  const targetKcal = getUserTargetKcal(me);
  const bin = kcalBin(targetKcal);

  if (bin) {
    const menus = await SuggestMenu.find(
      { totalKcal: { $gte: bin.low, $lte: bin.high } },
      { name: 1, imageUrl: 1, category: 1, numDays: 1, totalKcal: 1, savedBy: 1 }
    )
      .sort({ createdAt: -1 })
      .limit(3)
      .lean()
      .catch(() => []);

    out.menus = safeArr(menus).map((m) => ({
      id: m._id,
      name: m.name,
      imageUrl: m.imageUrl,
      category: m.category,
      numDays: m.numDays,
      totalKcal: m.totalKcal,
      saved: safeArr(m.savedBy).some((u) => String(u) === String(userId)),
      kcalRange: { min: bin.low, max: bin.high },
    }));
  }

  // plans by intent keywords
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
 * POST /api/ai/images  (multipart: image)
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

    // save user message
    const userMessage = await AiMessage.create({
      user: userId,
      role: "user",
      text,
      imageUrls,
      meta: { intent: inferIntent(text, imageUrls) },
    });

    // history (last 30 including this)
    const history = await AiMessage.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const historyChrono = history.reverse();

    const systemText =
      [
        "Bạn là FitMatch AI Coach.",
        "Nhiệm vụ: hỗ trợ dinh dưỡng & luyện tập an toàn, thực tế.",
        "Không chẩn đoán bệnh. Nếu có vấn đề y tế, khuyên người dùng gặp bác sĩ.",
        "",
        "QUAN TRỌNG: Hãy trả về JSON thuần (không markdown) theo format:",
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
    const reply = s(parsed?.reply) || s(outText) || "Mình chưa nhận được nội dung trả lời từ AI.";
    const detectedFoodName = s(parsed?.detectedFoodName) || "";

    const suggestions = await buildSuggestions({
      userId,
      userText: text,
      detectedFoodName,
    });

    // save assistant
    const assistantMessage = await AiMessage.create({
      user: userId,
      role: "assistant",
      text: reply,
      imageUrls: [],
      meta: {
        detectedFoodName: detectedFoodName || undefined,
        estimated: parsed?.estimated || undefined,
        suggestions,
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
