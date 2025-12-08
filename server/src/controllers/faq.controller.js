// server/src/controllers/faq.controller.js
import FaqCategory from "../models/FaqCategory.js";
import FaqQuestion from "../models/FaqQuestion.js";
import { ok } from "../utils/response.js";

// GET /api/faq
export const listFaqPublic = async (req, res) => {
  // Chỉ lấy danh mục & câu hỏi đang hoạt động
  const categories = await FaqCategory.find({ isActive: true })
    .sort({ createdAt: 1 }) // tạo trước nằm trên
    .lean();

  const catIds = categories.map((c) => c._id);

  const questions = await FaqQuestion.find({
    isActive: true,
    category: { $in: catIds },
  })
    .sort({ createdAt: 1 })
    .lean();

  const map = new Map();

  categories.forEach((cat) => {
    map.set(String(cat._id), {
      categoryId: cat._id,
      categoryName: cat.name,
      description: cat.description || "",
      questions: [],
    });
  });

  questions.forEach((q) => {
    const key = String(q.category);
    const group = map.get(key);
    if (group) {
      group.questions.push({
        _id: q._id,
        title: q.title,
        answerHtml: q.answerHtml,
      });
    }
  });

  const groups = Array.from(map.values());

  return ok(res, { groups });
};
