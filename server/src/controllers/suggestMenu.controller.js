// server/src/controllers/suggestMenu.controller.js
import SuggestMenu from "../models/SuggestMenu.js";
import Food from "../models/Food.js";
import { User } from "../models/User.js";
import { responseOk } from "../utils/response.js";
import { uploadImageWithResize, deleteFile } from "../utils/cloudinary.js";
import { logAdminAction } from "../utils/auditLog.js";

const CLOUD_FOLDER = "asset/folder/foods"; // dùng chung folder với Food

// ---- helper: map lỗi validate ----
function toValidationMap(err) {
  if (!err || err.name !== "ValidationError") return null;
  const out = {};
  for (const k of Object.keys(err.errors || {})) {
    const e = err.errors[k];
    const path = (e && e.path) || k;
    out[path] = e.message || "Dữ liệu không hợp lệ";
  }
  return out;
}

// ---- helper: nhận diện admin (lv1/lv2/legacy) ----
function isAdminRole(req) {
  const role = String(req.userRole || "");
  const level = Number(req.userLevel || 0);
  return (
    role === "admin" ||
    role.startsWith("admin_") || // "admin_lv1" | "admin_lv2"
    level >= 1
  );
}

// ---- helper: parse days từ body (string / object) ----
function parseDaysInput(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  return [];
}

/**
 * Chuẩn hoá days + tính tổng macro từ Food
 *
 * Input FE gửi:
 * days: [
 *   {
 *     title?: "Ngày 1",
 *     meals: [
 *       {
 *         title?: "Bữa 1",
 *         items: [
 *           { foodId: "xxx" },
 *           ...
 *         ]
 *       }
 *     ]
 *   }
 * ]
 */
async function buildDaysAndTotals(rawDays) {
  const daysInput = parseDaysInput(rawDays);
  const normalizedDays = [];
  const foodIdSet = new Set();

  daysInput.forEach((day, dIdx) => {
    const mealsInput = Array.isArray(day?.meals) ? day.meals : [];
    const meals = [];

    mealsInput.forEach((meal, mIdx) => {
      const itemsInput = Array.isArray(meal?.items) ? meal.items : [];
      const items = [];

      itemsInput.forEach((it) => {
        const foodId = it?.foodId || it?.food || it?.food?._id;
        if (!foodId) return;
        const idStr = String(foodId);
        items.push({ food: idStr }); // Mongoose sẽ cast string -> ObjectId
        foodIdSet.add(idStr);
      });

      if (items.length) {
        meals.push({
          title: meal?.title || `Bữa ${mIdx + 1}`,
          items,
        });
      }
    });

    if (meals.length) {
      normalizedDays.push({
        title: day?.title || `Ngày ${dIdx + 1}`,
        meals,
      });
    }
  });

  if (!normalizedDays.length) {
    return {
      days: [],
      numDays: 0,
      totalKcal: 0,
      totalProteinG: 0,
      totalCarbG: 0,
      totalFatG: 0,
    };
  }

  const foodIds = Array.from(foodIdSet);
  const foods = await Food.find({ _id: { $in: foodIds } })
    .select("name kcal proteinG carbG fatG")
    .lean();

  const foodMap = new Map(foods.map((f) => [String(f._id), f]));

  let totalKcal = 0;
  let totalProteinG = 0;
  let totalCarbG = 0;
  let totalFatG = 0;

  normalizedDays.forEach((day) => {
    day.meals.forEach((meal) => {
      meal.items.forEach((item) => {
        const f = foodMap.get(String(item.food));
        const kcal = Number(f?.kcal || 0);
        const p = Number(f?.proteinG || 0);
        const c = Number(f?.carbG || 0);
        const fat = Number(f?.fatG || 0);

        item.foodName = f?.name || "";
        item.kcal = kcal;
        item.proteinG = p;
        item.carbG = c;
        item.fatG = fat;

        totalKcal += kcal;
        totalProteinG += p;
        totalCarbG += c;
        totalFatG += fat;
      });
    });
  });

  return {
    days: normalizedDays,
    numDays: normalizedDays.length,
    totalKcal,
    totalProteinG,
    totalCarbG,
    totalFatG,
  };
}

/* =========================
 * LIST & DETAIL
 * ========================= */

export async function listSuggestMenus(req, res) {
  const { q, limit = 30, skip = 0 } = req.query;

  const match = {};
  if (q) {
    // dùng text index nếu đã tạo, giống Food
    match.$text = { $search: q };
  }

  const proj = {
    name: 1,
    imageUrl: 1,
    category: 1,
    numDays: 1,
    totalKcal: 1,
    totalProteinG: 1,
    totalCarbG: 1,
    totalFatG: 1,
    createdAt: 1,
    updatedAt: 1,
    ...(q ? { score: { $meta: "textScore" } } : {}),
  };

  const sort = q ? { score: { $meta: "textScore" } } : { createdAt: -1 };

  const docs = await SuggestMenu.find(match)
    .sort(sort)
    .skip(Number(skip))
    .limit(Number(limit) + 1)
    .select(proj)
    .lean();

  const items = docs.slice(0, Number(limit));
  const hasMore = docs.length > Number(limit);

  res.json({
    items,
    hasMore,
    total: items.length,
    limit: Number(limit),
    skip: Number(skip),
  });
}

export async function getSuggestMenu(req, res) {
  const d = await SuggestMenu.findById(req.params.id)
    .populate({
      path: "days.meals.items.food",
      select:
        "name imageUrl portionName massG unit kcal proteinG carbG fatG",
    })
    .lean();

  if (!d) return res.status(404).json({ message: "Not found" });
  res.json(d);
}

/* =========================
 * CREATE
 * ========================= */

export async function createSuggestMenu(req, res) {
  try {
    if (!isAdminRole(req)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const b = req.body || {};

    const name = String(b.name || "").trim();
    const category = String(b.category || "").trim();
    const descHtml =
      typeof b.descriptionHtml === "string" ? b.descriptionHtml : "";

    const plainDesc = descHtml.replace(/<[^>]*>/g, "").trim();

    if (!name) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập tên thực đơn gợi ý" });
    }
    if (name.length > 100) {
      return res
        .status(400)
        .json({ message: "Tên thực đơn tối đa 100 ký tự" });
    }
    if (!plainDesc) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập mô tả thực đơn" });
    }
    if (!category) {
      return res
        .status(400)
        .json({ message: "Vui lòng chọn loại thực đơn" });
    }

    // Ảnh: multipart (req.file) hoặc link (b.imageUrl) – giống Food
    let imageUrl = b.imageUrl || null;
    if (req.file) {
      try {
        imageUrl = await uploadImageWithResize(
          req.file.buffer,
          CLOUD_FOLDER,
          {
            width: 800,
            height: 800,
            fit: "inside",
            withoutEnlargement: true,
          },
          { quality: 82 }
        );
      } catch (e) {
        console.error("[suggestMenu.upload]", e?.message || e);
      }
    }

    if (!imageUrl) {
      return res
        .status(400)
        .json({ message: "Vui lòng chọn hình ảnh cho thực đơn" });
    }

    // Build days + tổng macro
    const {
      days,
      numDays,
      totalKcal,
      totalProteinG,
      totalCarbG,
      totalFatG,
    } = await buildDaysAndTotals(b.days);

    if (!days.length) {
      return res.status(400).json({
        message: "Thực đơn cần ít nhất 1 món ăn hợp lệ",
      });
    }

    const numDaysFromBody = Number(b.numDays);
    const finalNumDays =
      Number.isFinite(numDaysFromBody) && numDaysFromBody > 0
        ? numDaysFromBody
        : numDays;

    const doc = await SuggestMenu.create({
      name,
      imageUrl,
      descriptionHtml: descHtml.trim(),
      category,
      numDays: finalNumDays,
      days,
      totalKcal,
      totalProteinG,
      totalCarbG,
      totalFatG,
    });

    // 🔍 Audit log tạo Thực đơn gợi ý
    await logAdminAction(req, {
      resourceType: "suggestMenu",
      resourceId: doc._id,
      resourceName: doc.name,
      action: "create",
    });

    return res.status(201).json({ message: "Created", id: doc._id });
  } catch (err) {
    const map = toValidationMap(err);
    if (map)
      return res
        .status(422)
        .json({ message: "Dữ liệu không hợp lệ", errors: map });
    console.error("[createSuggestMenu]", err?.message || err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
}

/* =========================
 * UPDATE
 * ========================= */

export async function updateSuggestMenu(req, res) {
  try {
    if (!isAdminRole(req)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const doc = await SuggestMenu.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: "Not found" });

    const b = req.body || {};
    const set = {};

    if (b.name !== undefined) {
      const name = String(b.name || "").trim();
      if (!name) {
        return res
          .status(400)
          .json({ message: "Vui lòng nhập tên thực đơn gợi ý" });
      }
      if (name.length > 100) {
        return res
          .status(400)
          .json({ message: "Tên thực đơn tối đa 100 ký tự" });
      }
      set.name = name;
    }

    if (b.descriptionHtml !== undefined) {
      const descHtml =
        typeof b.descriptionHtml === "string" ? b.descriptionHtml : "";
      const plain = descHtml.replace(/<[^>]*>/g, "").trim();
      if (!plain) {
        return res
          .status(400)
          .json({ message: "Vui lòng nhập mô tả thực đơn" });
      }
      set.descriptionHtml = descHtml.trim();
    }

    if (b.category !== undefined) {
      const category = String(b.category || "").trim();
      if (!category) {
        return res
          .status(400)
          .json({ message: "Vui lòng chọn loại thực đơn" });
      }
      set.category = category;
    }

    if (b.numDays !== undefined) {
      const n = Number(b.numDays);
      if (!Number.isFinite(n) || n <= 0) {
        return res.status(400).json({
          message: "Số ngày của thực đơn phải là số dương",
        });
      }
      set.numDays = n;
    }

    // ImageUrl text (không xoá khi chuỗi rỗng)
    if (b.imageUrl !== undefined) {
      const v =
        typeof b.imageUrl === "string" ? b.imageUrl.trim() : b.imageUrl;
      if (v) set.imageUrl = v;
    }

    // Nếu upload ảnh mới: xoá ảnh Cloudinary cũ + upload ảnh mới
    if (req.file) {
      try {
        if (doc.imageUrl && doc.imageUrl.includes("cloudinary.com")) {
          await deleteFile(doc.imageUrl, "image").catch(() => {});
        }
        const newImageUrl = await uploadImageWithResize(
          req.file.buffer,
          CLOUD_FOLDER,
          {
            width: 800,
            height: 800,
            fit: "inside",
            withoutEnlargement: true,
          },
          { quality: 82 }
        );
        set.imageUrl = newImageUrl;
      } catch (e) {
        console.error("[suggestMenu.upload][update]", e?.message || e);
      }
    }

    // Cập nhật days + macro nếu FE gửi days
    if (b.days !== undefined) {
      const {
        days,
        numDays,
        totalKcal,
        totalProteinG,
        totalCarbG,
        totalFatG,
      } = await buildDaysAndTotals(b.days);

      if (!days.length) {
        return res.status(400).json({
          message: "Thực đơn cần ít nhất 1 món ăn hợp lệ",
        });
      }

      set.days = days;

      const n = Number(b.numDays);
      set.numDays = Number.isFinite(n) && n > 0 ? n : numDays;

      set.totalKcal = totalKcal;
      set.totalProteinG = totalProteinG;
      set.totalCarbG = totalCarbG;
      set.totalFatG = totalFatG;
    }

    await SuggestMenu.findByIdAndUpdate(
      doc._id,
      { $set: set },
      {
        runValidators: true,
      }
    );

    // 🔍 Audit log cập nhật Thực đơn gợi ý
    await logAdminAction(req, {
      resourceType: "suggestMenu",
      resourceId: doc._id,
      resourceName: set.name || doc.name,
      action: "update",
    });

    return res.json(responseOk());
  } catch (err) {
    const map = toValidationMap(err);
    if (map)
      return res
        .status(422)
        .json({ message: "Dữ liệu không hợp lệ", errors: map });
    console.error("[updateSuggestMenu]", err?.message || err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
}

/* =========================
 * DELETE
 * ========================= */

export async function deleteSuggestMenu(req, res) {
  try {
    if (!isAdminRole(req)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const doc = await SuggestMenu.findById(req.params.id).select(
      "imageUrl savedBy name"
    );
    if (!doc) return res.status(404).json({ message: "Not found" });

    // 🔒 Nếu thực đơn đang được user lưu → không cho xoá
    if (Array.isArray(doc.savedBy) && doc.savedBy.length > 0) {
      return res.status(400).json({
        message: `Thực đơn "${doc.name}" đang được ${doc.savedBy.length} người dùng lưu, nên không thể xoá.`,
        savedCount: doc.savedBy.length,
      });
    }

    // (Tuỳ chọn) nếu muốn xoá luôn ảnh Cloudinary:
    if (doc.imageUrl && doc.imageUrl.includes("cloudinary.com")) {
      try {
        await deleteFile(doc.imageUrl, "image");
      } catch (_) {}
    }

    await SuggestMenu.deleteOne({ _id: doc._id });

    // 🔍 Audit log xoá Thực đơn gợi ý
    await logAdminAction(req, {
      resourceType: "suggestMenu",
      resourceId: doc._id,
      resourceName: doc.name,
      action: "delete",
    });

    return res.json(responseOk());
  } catch (err) {
    console.error("[deleteSuggestMenu]", err?.message || err);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
}

/* =========================
 * USER SIDE
 * ========================= */

export async function listSuggestMenusUser(req, res) {
  const userId = req.userId;
  const { q, totalKcalMin, totalKcalMax, limit = 30, skip = 0 } = req.query;

  const match = {};
  const and = [];

  if (q) {
    match.$text = { $search: q };
  }

  if (totalKcalMin || totalKcalMax) {
    const r = {};
    if (totalKcalMin) r.$gte = Number(totalKcalMin);
    if (totalKcalMax) r.$lte = Number(totalKcalMax);
    and.push({ totalKcal: r });
  }

  if (and.length) match.$and = and;

  const docs = await SuggestMenu.find(match)
    .sort({ createdAt: -1 })
    .skip(Number(skip))
    .limit(Number(limit) + 1)
    .select({
      name: 1,
      imageUrl: 1,
      category: 1,
      numDays: 1,
      totalKcal: 1,
      totalProteinG: 1,
      totalCarbG: 1,
      totalFatG: 1,
      savedBy: 1,
      createdAt: 1,
      updatedAt: 1,
      ...(q ? { score: { $meta: "textScore" } } : {}),
    })
    .lean();

  const items = docs.slice(0, Number(limit)).map((d) => ({
    ...d,
    saved: userId
      ? (d.savedBy || []).some((u) => String(u) === String(userId))
      : false,
  }));

  const hasMore = docs.length > Number(limit);
  res.json({ items, hasMore, total: items.length });
}

export async function toggleSaveSuggestMenu(req, res) {
  const userId = req.userId;
  const id = req.params.id;

  const doc = await SuggestMenu.findById(id);
  if (!doc) return res.status(404).json({ message: "Not found" });

  const arr = doc.savedBy || [];
  const idx = arr.findIndex((u) => String(u) === String(userId));
  let saved;

  if (idx >= 0) {
    // đang lưu -> bỏ lưu
    doc.savedBy = arr.filter((u) => String(u) !== String(userId));
    saved = false;
  } else {
    // chưa lưu -> lưu
    doc.savedBy = [...arr, userId];
    saved = true;
  }

  await doc.save();
  res.json({ saved });
}
