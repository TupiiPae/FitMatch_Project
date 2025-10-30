import fs from "fs";
import path from "path";
import sharp from "sharp";
import * as XLSX from "xlsx";
import unzipper from "unzipper";
import Food from "../models/Food.js";
import { FOOD_DIR } from "../middleware/upload.js";

const NAME_REGEX = /^[\p{L}\p{M}\s'’\-.,&()\/]+$/u;

const toNum = (v) => (v === "" || v == null ? null : (Number.isFinite(Number(v)) ? Number(v) : null));
const normUnit = (u) => (String(u || "").toLowerCase() === "ml" ? "ml" : "g");
const ensureDir = () => { try { fs.mkdirSync(FOOD_DIR, { recursive: true }); } catch {} };

const KEYMAP = new Map([
  ["Hình ảnh", "imageUrl"], ["Tên", "name"], ["Khẩu phần", "servingDesc"], ["Khối lượng", "massG"], ["Đơn vị", "unit"],
  ["Calorie", "kcal"], ["Đạm", "proteinG"], ["Đường bột", "carbG"], ["Chất béo", "fatG"], ["Muối", "saltG"],
  ["Đường", "sugarG"], ["Chất xơ", "fiberG"],
  // EN fallbacks
  ["imageUrl", "imageUrl"], ["name", "name"], ["servingDesc", "servingDesc"], ["massG", "massG"], ["unit", "unit"],
  ["kcal", "kcal"], ["proteinG", "proteinG"], ["carbG", "carbG"], ["fatG", "fatG"], ["saltG", "saltG"],
  ["sugarG", "sugarG"], ["fiberG", "fiberG"], ["imageFile", "imageFile"], ["description", "description"],
]);

function mapRowKeys(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const mk = KEYMAP.get(k) || k;
    out[mk] = typeof v === "string" ? v.trim() : v;
  }
  out.massG    = toNum(out.massG);
  out.kcal     = toNum(out.kcal);
  out.proteinG = toNum(out.proteinG);
  out.carbG    = toNum(out.carbG);
  out.fatG     = toNum(out.fatG);
  out.saltG    = toNum(out.saltG);
  out.sugarG   = toNum(out.sugarG);
  out.fiberG   = toNum(out.fiberG);
  out.unit     = normUnit(out.unit);
  return out;
}

function basicValidate(row) {
  const errs = [];
  if (!row.name || !NAME_REGEX.test(row.name)) errs.push("name");
  if (row.massG == null || row.massG <= 0) errs.push("massG");
  if (!row.unit || !["g", "ml"].includes(row.unit)) errs.push("unit");
  if (row.kcal == null || row.kcal < 0) errs.push("kcal");
  return errs;
}

async function parseCSV(buf) {
  const text = buf.toString("utf8").replace(/\r/g, "");
  const [headLine, ...lines] = text.split("\n").filter(Boolean);
  if (!headLine) return [];
  const headers = headLine.split(",").map((h) => h.trim());
  return lines.map((ln) => {
    const cols = ln.split(",").map((c) => c.trim());
    const o = {};
    headers.forEach((h, i) => (o[h] = cols[i] ?? ""));
    return o;
  });
}

async function parseXLSX(buf) {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

async function openZip(buf) {
  const dir = await unzipper.Open.buffer(buf);
  // Tìm file CSV/XLSX
  let sheetEntry = dir.files.find((f) => /(^|\/)(foods\.csv)$/i.test(f.path))
                 || dir.files.find((f) => /\.(csv|xlsx|xls)$/i.test(f.path));
  if (!sheetEntry) throw new Error("ZIP không chứa file CSV/XLSX");
  const sheetBuf = await sheetEntry.buffer();

  // Gom images/*
  const images = new Map();
  for (const f of dir.files) {
    if (/^images\//i.test(f.path) && !f.path.endsWith("/")) {
      images.set(f.path.replace(/\\/g, "/"), await f.buffer());
    }
  }
  return { sheetBuf, sheetName: sheetEntry.path, images };
}

async function saveImageFromBuffer(userId, buf) {
  ensureDir();
  const fn = `${userId || "admin"}-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
  const out = path.join(FOOD_DIR, fn);
  await sharp(buf)
    .rotate()
    .resize(1024, 1024, { fit: "inside" })
    .webp({ quality: 85 })
    .toFile(out);
  return `/uploads/foods/${fn}`;
}

async function maybeFetch(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const ab = await r.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

// ---- main: import (ghi DB) ----
export async function importFoods(req, res) {
  try {
    const adminId = req.userId;
    const file = req.files?.file?.[0];
    const archive = req.files?.archive?.[0];
    const options = (req.body?.options && JSON.parse(req.body.options)) || {};
    const upsertBy = String(options.upsertBy || "name+mass+unit").toLowerCase();
    const fetchImages = Boolean(options.fetchImages);
    const status = ["approved", "pending", "rejected"].includes(options.status) ? options.status : "approved";

    if (!file && !archive) {
      return res.status(400).json({ message: "Thiếu file CSV/XLSX hoặc ZIP" });
    }

    // Lấy rows + imagesMap (nếu ZIP)
    let rowsRaw = [];
    let images = new Map();
    if (archive) {
      const { sheetBuf, sheetName, images: imgs } = await openZip(archive.buffer);
      images = imgs;
      if (/\.(xlsx|xls)$/i.test(sheetName)) rowsRaw = await parseXLSX(sheetBuf);
      else rowsRaw = await parseCSV(sheetBuf);
    } else if (file) {
      if (/\.(xlsx|xls)$/i.test(file.originalname)) rowsRaw = await parseXLSX(file.buffer);
      else rowsRaw = await parseCSV(file.buffer);
    }

    const normalized = rowsRaw.map(mapRowKeys);
    const errors = [];
    let inserted = 0, updated = 0;

    for (let i = 0; i < normalized.length; i++) {
      const r = normalized[i];
      const errs = basicValidate(r);
      if (errs.length) {
        errors.push({ index: i, fields: errs });
        continue;
      }

      // Ảnh: ưu tiên imageFile trong ZIP, sau đó imageUrl (+fetch)
      let imageUrl = r.imageUrl || null;
      if (r.imageFile) {
        const imgBuf = images.get(String(r.imageFile).replace(/\\/g, "/"));
        if (imgBuf) {
          imageUrl = await saveImageFromBuffer(adminId, imgBuf);
        } else {
          // imageFile không tồn tại trong ZIP -> giữ nguyên/null
        }
      } else if (r.imageUrl && fetchImages) {
        const buf = await maybeFetch(r.imageUrl);
        if (buf) imageUrl = await saveImageFromBuffer(adminId, buf);
      }

      // upsert key
      const q = {};
      if (upsertBy.includes("name")) q.name = r.name;
      if (upsertBy.includes("mass")) q.massG = r.massG;
      if (upsertBy.includes("unit")) q.unit = r.unit;

      const set = {
        name: r.name,
        portionName: r.servingDesc || undefined,
        massG: r.massG,
        unit: r.unit,
        kcal: r.kcal,
        proteinG: r.proteinG,
        carbG: r.carbG,
        fatG: r.fatG,
        saltG: r.saltG,
        sugarG: r.sugarG,
        fiberG: r.fiberG,
        imageUrl: imageUrl || undefined,
        sourceType: "admin_imported",
        createdByAdmin: adminId,
      };

      // status & approvals
      if (status === "approved") {
        set.status = "approved";
        set.approvedAt = new Date();
        set.approvedBy = adminId;
      } else if (status === "pending") {
        set.status = "pending";
        set.approvedAt = undefined;
        set.approvedBy = undefined;
      } else {
        set.status = "rejected";
      }

      // Thử upsert
      const existed = await Food.findOne(q).select("_id").lean();
      try {
        if (existed) {
          await Food.findByIdAndUpdate(existed._id, { $set: set }, { runValidators: true });
          updated += 1;
        } else {
          await Food.create(set);
          inserted += 1;
        }
      } catch (e) {
        errors.push({ index: i, message: e?.message || "DB error" });
      }
    }

    return res.json({ success: true, inserted, updated, failed: errors.length, errors });
  } catch (e) {
    console.error("[admin.importFoods]", e);
    return res.status(500).json({ message: "Import lỗi", error: e?.message || String(e) });
  }
}

// ---- optional: validate-only (dry run, không ghi DB) ----
export async function validateFoods(req, res) {
  try {
    const file = req.files?.file?.[0];
    const archive = req.files?.archive?.[0];
    if (!file && !archive) {
      return res.status(400).json({ message: "Thiếu file CSV/XLSX hoặc ZIP" });
    }
    let rowsRaw = [];
    if (archive) {
      const { sheetBuf } = await openZip(archive.buffer);
      if (!sheetBuf) return res.status(400).json({ message: "ZIP thiếu sheet" });
      rowsRaw = /\.(xlsx|xls)$/i.test("x." + sheetBuf.byteLength) ? await parseXLSX(sheetBuf) : await parseCSV(sheetBuf); // fallback
    } else {
      if (/\.(xlsx|xls)$/i.test(file.originalname)) rowsRaw = await parseXLSX(file.buffer);
      else rowsRaw = await parseCSV(file.buffer);
    }
    const normalized = rowsRaw.map(mapRowKeys);
    const errors = [];
    normalized.forEach((r, i) => {
      const es = basicValidate(r);
      if (es.length) errors.push({ index: i, fields: es });
    });
    if (errors.length) return res.json({ success: false, errors, count: normalized.length });
    return res.json({ success: true, count: normalized.length });
  } catch (e) {
    return res.status(500).json({ message: "Validate lỗi", error: e?.message || String(e) });
  }
}
