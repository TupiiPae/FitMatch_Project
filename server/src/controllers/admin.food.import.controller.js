// server/src/controllers/admin.food.import.controller.js
import * as XLSX from "xlsx";
import Food from "../models/Food.js";
import { responseOk } from "../utils/response.js";

/** --------- Helpers --------- */
const keyMap = {
  // VN headers
  "Hình ảnh": "imageUrl",
  "Tên": "name",
  "Khẩu phần": "servingDesc",       // sẽ map -> portionName
  "Khối lượng": "massG",
  "Đơn vị": "unit",
  "Calorie": "kcal",
  "Đạm": "proteinG",
  "Đường bột": "carbG",
  "Chất béo": "fatG",
  "Muối": "saltG",
  "Đường": "sugarG",
  "Chất xơ": "fiberG",
  // EN keys
  imageUrl: "imageUrl",
  name: "name",
  servingDesc: "servingDesc",
  portionName: "portionName", // chấp nhận luôn
  massG: "massG",
  unit: "unit",
  kcal: "kcal",
  proteinG: "proteinG",
  carbG: "carbG",
  fatG: "fatG",
  saltG: "saltG",
  sugarG: "sugarG",
  fiberG: "fiberG",
  description: "description",
};

const isNum = (v) =>
  v !== undefined && v !== null && String(v).trim() !== "" && !Number.isNaN(Number(v));
const toNumOrUndef = (v) => (isNum(v) ? Number(v) : undefined);
const normUnit = (u) => (String(u || "").toLowerCase() === "ml" ? "ml" : "g");
const toStrOrUndef = (v) => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
};

/** Parse CSV text (simple) */
function parseCSV(text) {
  const rows = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (rows.length === 0) return [];
  const headers = rows[0].split(",").map((h) => h.trim());
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i].split(",");
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? "").trim();
    });
    out.push(obj);
  }
  return out;
}

/** Convert uploaded file (.csv / .xlsx) to array of row objects */
function bufferToRows(file) {
  const name = (file?.originalname || "").toLowerCase();
  const buf = file?.buffer;
  if (!buf) throw new Error("Thiếu file dữ liệu (file)");
  if (name.endsWith(".csv")) {
    const text = Buffer.from(buf).toString("utf8");
    return parseCSV(text);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws, { defval: "" });
  }
  throw new Error("Định dạng không hỗ trợ. Vui lòng dùng CSV hoặc XLSX");
}

/** Normalize one raw row */
function normalizeRow(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    const mapped = keyMap[k] || k;
    out[mapped] = v;
  }
  // map servingDesc -> portionName (ưu tiên portionName nếu có)
  if (out.portionName === undefined && out.servingDesc !== undefined) {
    out.portionName = out.servingDesc;
  }

  // chuẩn hoá kiểu dữ liệu
  const doc = {
    name: toStrOrUndef(out.name),
    imageUrl: toStrOrUndef(out.imageUrl),
    portionName: toStrOrUndef(out.portionName),
    massG: toNumOrUndef(out.massG),
    unit: normUnit(out.unit),
    kcal: toNumOrUndef(out.kcal),
    proteinG: toNumOrUndef(out.proteinG),
    carbG: toNumOrUndef(out.carbG),
    fatG: toNumOrUndef(out.fatG),
    saltG: toNumOrUndef(out.saltG),
    sugarG: toNumOrUndef(out.sugarG),
    fiberG: toNumOrUndef(out.fiberG),
    // optional free text
    description: toStrOrUndef(out.description),
  };

  return doc;
}

/** Validate minimal requirements (aligned with FoodSchema) */
function validateMinimal(doc) {
  const errs = [];
  if (!doc.name) errs.push("Thiếu tên món");
  if (!isNum(doc.massG)) errs.push("Thiếu/không hợp lệ khối lượng (massG)");
  if (!doc.unit || (doc.unit !== "g" && doc.unit !== "ml")) errs.push("Đơn vị chỉ 'g' hoặc 'ml'");
  if (!isNum(doc.kcal)) errs.push("Thiếu/không hợp lệ kcal");
  return errs;
}

/** Build upsert filter from options (default name+massG+unit) */
function buildUpsertFilter(doc, upsertBy) {
  const key = (upsertBy || "name+mass+unit").toLowerCase().trim();
  if (key === "name+mass+unit" || key === "name+massg+unit") {
    return { name: doc.name, massG: doc.massG, unit: doc.unit };
  }
  if (key === "name") return { name: doc.name };
  // fallback
  return { name: doc.name, massG: doc.massG, unit: doc.unit };
}

/** --------- Controllers --------- */

/**
 * POST /api/admin/foods/import/validate
 * Body (multipart): file
 * Trả về: { success, total, valid, invalid, errors[] }
 */
export async function validateFoods(req, res) {
  try {
    const file = (req.files?.file && req.files.file[0]) || null;
    if (!file) return res.status(400).json({ success: false, message: "Thiếu file" });

    const rawRows = bufferToRows(file);
    const normalized = rawRows.map(normalizeRow);

    const errors = [];
    normalized.forEach((doc, i) => {
      const errs = validateMinimal(doc);
      if (errs.length) errors.push({ index: i + 2, // +2 vì header (1) + 1-based
        name: doc.name, messages: errs });
    });

    return res.json({
      success: true,
      total: normalized.length,
      valid: normalized.length - errors.length,
      invalid: errors.length,
      errors,
    });
  } catch (e) {
    console.error("[import.validate] ", e?.message || e);
    return res.status(500).json({ success: false, message: e?.message || "Lỗi validate" });
  }
}

/**
 * POST /api/admin/foods/import
 * Body (multipart): file, options.json (stringified) | fields options.*
 * Options: { fetchImages?:boolean, upsertBy?:string, status?: "approved"|"pending"|"rejected" }
 * Trả về: { success, inserted, updated, errors[] }
 */
export async function importFoods(req, res) {
  try {
    const adminId = req.userId;
    const file = (req.files?.file && req.files.file[0]) || null;
    if (!file) return res.status(400).json({ success: false, message: "Thiếu file" });

    // Parse options
    let opts = {};
    if (req.body?.options) {
      try { opts = JSON.parse(req.body.options); } catch {}
    }
    // Ngoài ra hỗ trợ options rời rạc: fetchImages, upsertBy, status
    if (req.body.fetchImages !== undefined) {
      opts.fetchImages = String(req.body.fetchImages).toLowerCase() === "true";
    }
    if (req.body.upsertBy) opts.upsertBy = String(req.body.upsertBy);
    if (req.body.status) opts.status = String(req.body.status);

    const upsertBy = opts.upsertBy || "name+mass+unit";
    const status = ["approved","pending","rejected"].includes(opts.status) ? opts.status : "approved";

    // Read + normalize
    const rawRows = bufferToRows(file);
    const normalized = rawRows.map(normalizeRow);

    // Validate minimal
    const rowErrors = [];
    normalized.forEach((doc, i) => {
      const errs = validateMinimal(doc);
      if (errs.length) rowErrors.push({ index: i + 2, name: doc.name, messages: errs });
    });

    // Nếu có lỗi dữ liệu → không import
    if (rowErrors.length) {
      return res.status(422).json({
        success: false,
        message: "Dữ liệu không hợp lệ",
        invalid: rowErrors.length,
        errors: rowErrors,
      });
    }

    // Build bulk operations (upsert)
    const ops = normalized.map((doc) => {
      // set fields (undefined sẽ không ghi)
      const set = {
        name: doc.name,
        imageUrl: doc.imageUrl,
        portionName: doc.portionName,
        massG: doc.massG,
        unit: doc.unit,
        kcal: doc.kcal,
        proteinG: doc.proteinG,
        carbG: doc.carbG,
        fatG: doc.fatG,
        saltG: doc.saltG,
        sugarG: doc.sugarG,
        fiberG: doc.fiberG,
        description: doc.description,
        // giữ nguyên status hiện có nếu là update; nhưng ở $set ta không ép status.
      };

      // setOnInsert cho bản ghi mới
      const setOnInsert = {
        createdByAdmin: adminId,
        sourceType: "admin_created",
        // nếu import yêu cầu auto-approve
        ...(status ? { status } : {}),
        ...(status === "approved"
          ? { approvedBy: adminId, approvedAt: new Date() }
          : {}),
      };

      // Filter upsert
      const filter = buildUpsertFilter(doc, upsertBy);

      return {
        updateOne: {
          filter,
          update: { $set: set, $setOnInsert: setOnInsert },
          upsert: true,
        },
      };
    });

    const result = await Food.bulkWrite(ops, { ordered: false });

    const inserted = result?.upsertedCount || 0;
    // updatedCount không có sẵn, phải tính từ modifiedCount
    const updated = result?.modifiedCount || 0;

    return res.json({
      success: true,
      inserted,
      updated,
      totalRows: normalized.length,
      ...(rowErrors.length ? { rowErrors } : {}),
    });
  } catch (e) {
    console.error("[importFoods] ", e?.message || e);
    return res.status(500).json({ success: false, message: e?.message || "Lỗi import" });
  }
}
