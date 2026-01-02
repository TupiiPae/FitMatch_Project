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
import { uploadImageWithResize } from "../utils/cloudinary.js";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const OPENAI_BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com";

const safeArr = (v) => (Array.isArray(v) ? v : []);
const s = (v) => String(v ?? "").trim();

const toClientMsg = (m) => {
  const o = m?.toObject ? m.toObject() : (m || {});
  const urls = safeArr(o.imageUrls).filter((u) => typeof u === "string" && u);
  return {
    ...o,
    content: s(o.text),
    attachments: urls.map((u) => ({ type: "image", url: u })),
  };
};

const YES_RE = /^(có|co|ok|okay|yes|y|đồng\s*ý|dong\s*y|được|duoc|tạo|tao)\b/i;
const NO_RE  = /^(không|khong|no|n|thôi|thoi|hủy|huy)\b/i;

const escapeRegex = (x) => String(x || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function numOrNull(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function clampNum(n, min=0, max=10000){
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}
function round1(n){
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10) / 10;
}
function fmtNum(n){
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  // nếu là số nguyên thì không cần .0
  return Number.isInteger(x) ? String(x) : String(round1(x));
}

function buildFoodDraftFromParsed({ parsed, imageUrls, fallbackName }) {
  const detected =
    s(parsed?.detectedFoodName) ||
    s(parsed?.foodDraft?.name) ||
    s(fallbackName) ||
    "Món ăn từ ảnh";

  const fd = parsed?.foodDraft || {};
  const est = parsed?.estimated || {};

  const massG = clampNum(numOrNull(fd.massG), 1, 10000) ?? 100; // default 100g
  const unit  = fd.unit === "ml" ? "ml" : "g";
  const kcal  = clampNum(numOrNull(fd.kcal ?? est.kcal), 0, 10000) ?? null;

  return {
    name: detected,
    imageUrl: safeArr(imageUrls)[0] || "",
    portionName: s(fd.portionName) || "1 phần",
    massG,
    unit,
    kcal,
    proteinG: clampNum(numOrNull(fd.proteinG ?? est.proteinG), 0, 10000),
    carbG:    clampNum(numOrNull(fd.carbG ?? est.carbG), 0, 10000),
    fatG:     clampNum(numOrNull(fd.fatG ?? est.fatG), 0, 10000),
    saltG:    clampNum(numOrNull(fd.saltG), 0, 10000),
    sugarG:   clampNum(numOrNull(fd.sugarG), 0, 10000),
    fiberG:   clampNum(numOrNull(fd.fiberG), 0, 10000),
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

/** ===== Reply format dạng ý cho meal_scan ===== */
function formatMealScanReply({ parsedReply, foodDraft, similarFoods }) {
  const name = s(foodDraft?.name) || "món ăn trong ảnh";
  const portionLine = `${s(foodDraft?.portionName) || "1 phần"} (${fmtNum(foodDraft?.massG)}${foodDraft?.unit || "g"})`;

  const lines = [];
  // giữ lại 1 câu mô tả ngắn nếu AI có
  const p = s(parsedReply);
  if (p) {
    // lấy câu đầu tiên để tránh dài
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

  // note chung
  lines.push(`Giá trị dinh dưỡng có thể thay đổi tuỳ theo cách chế biến và khẩu phần thực tế.`);

  const hasSimilar = safeArr(similarFoods).length > 0;
  lines.push("");
  lines.push(hasSimilar
    ? `FitMatch đã có ${similarFoods.length} món tương tự trong danh sách.`
    : `Chưa thấy món tương tự trong danh sách món ăn của FitMatch.`
  );
  lines.push(`Bạn có muốn tạo món ăn mới với các chỉ số mình vừa ước lượng không? (Trả lời “Có” hoặc bấm “Tạo món”)`);

  return lines.join("\n");
}

/** ===== Similar foods: text search + scoring token overlap để sát hơn ===== */
const VN_STOP = new Set([
  "món","ăn","trong","hình","là","một","phần","ảnh","khoảng","ước","tính","cung","cấp",
  "với","và","có","cho","từ","theo","như","này","đó","fitmatch"
]);

function normalizeVN(str){
  return s(str)
    .toLowerCase()
    .replace(/[_~`!@#$%^&*()+={}\[\]|\\:;"'<>,.?/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function tokensVN(str){
  const tks = normalizeVN(str).split(" ").filter(Boolean);
  return tks.filter(x => x.length >= 2 && !VN_STOP.has(x));
}
function overlapCount(a, b){
  const setB = new Set(b);
  let c = 0;
  for (const x of a) if (setB.has(x)) c++;
  return c;
}

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

  // ===== helpers: normalize + tokenize + score =====
  const stripVn = (str) =>
    String(str || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "d");

  const STOP = new Set([
    "mon", "an", "phan", "khau", "phan", "to", "bat", "chen",
    "dia", "hop", "mieng", "cai", "ly", "chai", "goi",
    "them", "it", "nhieu", "vua", "thap", "cao", "tuoi"
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
    const jaccard = overlap / union;               // mức giao nhau
    const coverage = overlap / (qSet.size || 1);   // phủ token query

    // boost nếu có chứa cụm gần giống
    const qNorm = stripVn(q).toLowerCase();
    const nNorm = stripVn(name).toLowerCase();
    const phraseBoost = nNorm.includes(qNorm) || qNorm.includes(nNorm) ? 0.2 : 0;

    const score = jaccard * 0.65 + coverage * 0.35 + phraseBoost;
    return { score, overlap, qLen: qSet.size, cLen: cSet.size };
  };

  const passFilter = ({ overlap, qLen }) => {
    // Query dài (>=3 token) -> phải match ít nhất 2 token (tránh "bò" kéo "sữa bò")
    if (qLen >= 3) return overlap >= 2;
    // Query 2 token -> match >=1 token (vì nhiều món ngắn)
    if (qLen === 2) return overlap >= 1;
    // Query 1 token -> match >=1 token
    return overlap >= 1;
  };

  // ===== 1) get candidates (text search) =====
  let candidates = await Food.find(
    { $and: [{ $or: baseOr }, { $text: { $search: q } }] },
    { ...proj, score: { $meta: "textScore" } }
  )
    .sort({ score: { $meta: "textScore" }, updatedAt: -1 })
    .limit(Math.max(30, limit * 10))
    .lean()
    .catch(() => []);

  // ===== 2) fallback regex if no candidates / no text index =====
  if (!candidates?.length) {
    const tokensRaw = q
      .split(/\s+/)
      .map((x) => x.trim())
      .filter((x) => x.length >= 2)
      .slice(0, 6);

    if (!tokensRaw.length) return [];

    // OR regex để lấy candidate rộng, sau đó lọc bằng scoreByToken
    const re = new RegExp(tokensRaw.map(escapeRegex).join("|"), "i");

    candidates = await Food.find({ $and: [{ $or: baseOr }, { name: re }] }, proj)
      .sort({ updatedAt: -1 })
      .limit(Math.max(30, limit * 10))
      .lean()
      .catch(() => []);
  }

  // ===== 3) re-rank + filter by token similarity =====
  const ranked = safeArr(candidates)
    .map((f) => {
      const { score, overlap } = scoreByToken(f?.name);
      return { f, score, overlap };
    })
    .filter((x) => passFilter({ overlap: x.overlap, qLen: qSet.size }))
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

  return s(json?.output_text) || "";
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
      try { return JSON.parse(raw.slice(i, j + 1)); } catch {}
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

    // ===== Nếu user trả lời "Có" sau offerCreateFood -> trả action create_food luôn (không gọi OpenAI) =====
    if (!imageUrls.length && YES_RE.test(text)) {
      const lastOffer = await AiMessage.findOne({
        user: userId,
        role: "assistant",
        "meta.offerCreateFood": true,
        "meta.foodDraft": { $exists: true },
      })
        .sort({ createdAt: -1 })
        .lean()
        .catch(() => null);

      if (lastOffer?.meta?.foodDraft) {
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
          },
        });

        return res.json({
          userMessage: toClientMsg(userMessage),
          assistantMessage: toClientMsg(assistantMessage),
          items: [toClientMsg(assistantMessage)],
          suggestions: lastOffer?.meta?.suggestions || undefined,
        });
      }
    }

    // (optional) nếu user nói "Không" sau offer -> trả lời gọn
    if (!imageUrls.length && NO_RE.test(text)) {
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

    // history (last 30 including this)
    const history = await AiMessage.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

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

    // build suggestions như cũ
    const suggestions = await buildSuggestions({ userId, userText: text, detectedFoodName });

    let reply = s(parsed?.reply) || s(outText) || "Mình chưa nhận được nội dung trả lời từ AI.";

    // ===== meal_scan: build foodDraft + search DB similar + format reply dạng ý =====
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

    // save assistant
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
