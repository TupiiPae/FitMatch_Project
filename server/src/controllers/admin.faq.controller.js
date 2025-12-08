import mongoose from "mongoose";
import FaqCategory from "../models/FaqCategory.js";
import FaqQuestion from "../models/FaqQuestion.js";
import { responseOk } from "../utils/response.js";

const isValidObjectId = (id) => mongoose.isValidObjectId(id);

const parsePaging = (query) => {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const skip = Math.max(parseInt(query.skip, 10) || 0, 0);
  return { limit, skip };
};

const escapeRegex = (str = "") =>
  str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* =========================
 * CATEGORY
 * ========================= */

// GET /api/admin/faq/categories
export const listFaqCategoriesAdmin = async (req, res) => {
  const { q, status } = req.query;
  const { limit, skip } = parsePaging(req.query);

  const filter = {};
  if (status === "active") filter.isActive = true;
  if (status === "inactive") filter.isActive = false;

  if (q && q.trim()) {
    const rx = new RegExp(escapeRegex(q.trim()), "i");
    filter.$or = [{ name: rx }, { description: rx }];
  }

  const [items, total] = await Promise.all([
    FaqCategory.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FaqCategory.countDocuments(filter),
  ]);

  // ✅ Gửi response đúng chuẩn, KHÔNG trả object thuần nữa
  return res
    .status(200)
    .json(responseOk({ items, total, limit, skip }));
};

// POST /api/admin/faq/categories
export const createFaqCategoryAdmin = async (req, res) => {
  const { name, description } = req.body || {};
  const trimmedName = String(name || "").trim();
  const trimmedDesc = String(description || "").trim();

  if (!trimmedName) {
    return res
      .status(400)
      .json({ success: false, message: "Vui lòng nhập tên danh mục" });
  }
  if (trimmedName.length > 100) {
    return res
      .status(400)
      .json({ success: false, message: "Tên danh mục tối đa 100 ký tự" });
  }
  if (trimmedDesc.length > 500) {
    return res
      .status(400)
      .json({ success: false, message: "Mô tả tối đa 500 ký tự" });
  }

  const doc = await FaqCategory.create({
    name: trimmedName,
    description: trimmedDesc || undefined,
    isActive: true,
    createdBy: req.userId || undefined,
    updatedBy: req.userId || undefined,
  });

  const payload = doc.toObject ? doc.toObject() : doc;

  // ✅ 201 + wrapper responseOk
  return res
    .status(201)
    .json(responseOk(payload));
};

// PATCH /api/admin/faq/categories/:id
export const updateFaqCategoryAdmin = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res
      .status(400)
      .json({ success: false, message: "ID danh mục không hợp lệ" });
  }

  const cat = await FaqCategory.findById(id);
  if (!cat) {
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy danh mục FAQ" });
  }

  const { name, description, isActive } = req.body || {};
  let changedStatus = false;

  if (typeof name === "string") {
    const trimmed = name.trim();
    if (!trimmed) {
      return res
        .status(400)
        .json({ success: false, message: "Vui lòng nhập tên danh mục" });
    }
    if (trimmed.length > 100) {
      return res
        .status(400)
        .json({ success: false, message: "Tên danh mục tối đa 100 ký tự" });
    }
    if (trimmed !== cat.name) {
      cat.name = trimmed;
    }
  }

  if (typeof description === "string") {
    const trimmed = description.trim();
    if (trimmed.length > 500) {
      return res
        .status(400)
        .json({ success: false, message: "Mô tả tối đa 500 ký tự" });
    }
    cat.description = trimmed || undefined;
  }

  if (typeof isActive === "boolean" && isActive !== cat.isActive) {
    cat.isActive = isActive;
    changedStatus = true;
  }

  cat.updatedBy = req.userId || cat.updatedBy;
  await cat.save();

  if (changedStatus) {
    await FaqQuestion.updateMany(
      { category: cat._id },
      { $set: { isActive: cat.isActive } }
    );
  }

  const payload = cat.toObject ? cat.toObject() : cat;

  return res
    .status(200)
    .json(responseOk(payload));
};

// DELETE /api/admin/faq/categories/:id
export const deleteFaqCategoryAdmin = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res
      .status(400)
      .json({ success: false, message: "ID danh mục không hợp lệ" });
  }

  const cat = await FaqCategory.findById(id);
  if (!cat) {
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy danh mục FAQ" });
  }

  const countQuestions = await FaqQuestion.countDocuments({
    category: cat._id,
  });
  if (countQuestions > 0) {
    return res.status(400).json({
      success: false,
      message:
        "Không thể xoá danh mục vì vẫn còn câu hỏi thuộc danh mục này.",
    });
  }

  await FaqCategory.deleteOne({ _id: cat._id });

  return res
    .status(200)
    .json(responseOk({ deleted: true }));
};

/* =========================
 * QUESTIONS
 * ========================= */

// GET /api/admin/faq/questions
export const listFaqQuestionsAdmin = async (req, res) => {
  const { q, status, categoryId } = req.query;
  const { limit, skip } = parsePaging(req.query);

  const filter = {};

  if (status === "active") filter.isActive = true;
  if (status === "inactive") filter.isActive = false;

  if (categoryId && isValidObjectId(categoryId)) {
    filter.category = new mongoose.Types.ObjectId(categoryId);
  }

  let orConds = [];

  if (q && q.trim()) {
    const rx = new RegExp(escapeRegex(q.trim()), "i");

    orConds.push({ title: rx }, { answerHtml: rx });

    const catIds = await FaqCategory.find({ name: rx })
      .select("_id")
      .lean();
    if (catIds.length) {
      orConds.push({
        category: { $in: catIds.map((c) => c._id) },
      });
    }
  }

  if (orConds.length) {
    filter.$or = orConds;
  }

  const [itemsRaw, total] = await Promise.all([
    FaqQuestion.find(filter)
      .populate({ path: "category", select: "name isActive" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FaqQuestion.countDocuments(filter),
  ]);

  const items = itemsRaw.map((qDoc) => {
    const cat = qDoc.category || {};
    return {
      ...qDoc,
      categoryId: cat._id || qDoc.category,
      categoryName: cat.name || null,
      categoryStatus:
        typeof cat.isActive === "boolean"
          ? cat.isActive
            ? "active"
            : "inactive"
          : null,
    };
  });

  return res
    .status(200)
    .json(responseOk({ items, total, limit, skip }));
};

// POST /api/admin/faq/questions
export const createFaqQuestionAdmin = async (req, res) => {
  const { title, answerHtml, categoryId, isActive } = req.body || {};

  const trimmedTitle = String(title || "").trim();
  const trimmedHtml = String(answerHtml || "").trim();
  const catId = categoryId;

  if (!trimmedTitle) {
    return res
      .status(400)
      .json({ success: false, message: "Vui lòng nhập tiêu đề câu hỏi" });
  }
  if (trimmedTitle.length > 300) {
    return res
      .status(400)
      .json({ success: false, message: "Tiêu đề tối đa 300 ký tự" });
  }
  if (!trimmedHtml) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng nhập nội dung câu trả lời",
    });
  }
  if (!catId || !isValidObjectId(catId)) {
    return res
      .status(400)
      .json({ success: false, message: "Danh mục không hợp lệ" });
  }

  const cat = await FaqCategory.findById(catId);
  if (!cat) {
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy danh mục FAQ" });
  }

  const finalIsActive =
    typeof isActive === "boolean" ? isActive && cat.isActive : cat.isActive;

  const doc = await FaqQuestion.create({
    title: trimmedTitle,
    answerHtml: trimmedHtml,
    category: cat._id,
    isActive: finalIsActive,
    createdBy: req.userId || undefined,
    updatedBy: req.userId || undefined,
  });

  const result = {
    ...(doc.toObject ? doc.toObject() : doc),
    categoryId: cat._id,
    categoryName: cat.name,
    categoryStatus: cat.isActive ? "active" : "inactive",
  };

  return res
    .status(201)
    .json(responseOk(result));
};

// PATCH /api/admin/faq/questions/:id
export const updateFaqQuestionAdmin = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res
      .status(400)
      .json({ success: false, message: "ID câu hỏi không hợp lệ" });
  }

  const question = await FaqQuestion.findById(id).populate({
    path: "category",
    select: "name isActive",
  });

  if (!question) {
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy câu hỏi FAQ" });
  }

  const { title, answerHtml, categoryId, isActive } = req.body || {};

  if (typeof title === "string") {
    const trimmed = title.trim();
    if (!trimmed) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập tiêu đề câu hỏi",
      });
    }
    if (trimmed.length > 300) {
      return res.status(400).json({
        success: false,
        message: "Tiêu đề tối đa 300 ký tự",
      });
    }
    question.title = trimmed;
  }

  if (typeof answerHtml === "string") {
    const trimmed = answerHtml.trim();
    if (!trimmed) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập nội dung câu trả lời",
      });
    }
    question.answerHtml = trimmed;
  }

  if (categoryId && categoryId !== String(question.category?._id)) {
    if (!isValidObjectId(categoryId)) {
      return res
        .status(400)
        .json({ success: false, message: "Danh mục không hợp lệ" });
    }
    const newCat = await FaqCategory.findById(categoryId);
    if (!newCat) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy danh mục FAQ" });
    }
    if (isActive === true && !newCat.isActive) {
      return res.status(400).json({
        success: false,
        message:
          "Không thể bật hoạt động cho câu hỏi vì danh mục mới đang TẮT hoạt động.",
      });
    }
    question.category = newCat._id;
    question.categoryName = newCat.name;
  }

  if (typeof isActive === "boolean") {
    const cat =
      question.category && question.category.isActive != null
        ? question.category
        : await FaqCategory.findById(question.category);

    if (isActive && cat && !cat.isActive) {
      return res.status(400).json({
        success: false,
        message:
          "Không thể bật hoạt động cho câu hỏi này vì danh mục đang TẮT hoạt động. Vui lòng bật lại danh mục trước.",
      });
    }
    question.isActive = isActive;
  }

  question.updatedBy = req.userId || question.updatedBy;
  await question.save();

  const cat =
    question.category && question.category.name
      ? question.category
      : await FaqCategory.findById(question.category).lean();

  const result = {
    ...(question.toObject ? question.toObject() : question),
    categoryId: cat?._id || question.category,
    categoryName: cat?.name || null,
    categoryStatus:
      typeof cat?.isActive === "boolean"
        ? cat.isActive
          ? "active"
          : "inactive"
        : null,
  };

  return res
    .status(200)
    .json(responseOk(result));
};

// DELETE /api/admin/faq/questions/:id
export const deleteFaqQuestionAdmin = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res
      .status(400)
      .json({ success: false, message: "ID câu hỏi không hợp lệ" });
  }

  const question = await FaqQuestion.findById(id);
  if (!question) {
    return res
      .status(404)
      .json({ success: false, message: "Không tìm thấy câu hỏi FAQ" });
  }

  await FaqQuestion.deleteOne({ _id: question._id });

  return res
    .status(200)
    .json(responseOk({ deleted: true }));
};
