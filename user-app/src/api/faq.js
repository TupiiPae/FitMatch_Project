// user-app/src/api/faq.js
import api from "../lib/api";

/**
 * Lấy danh sách FAQ public, đã group theo danh mục.
 * Trả về: [{ categoryId, categoryName, description, questions: [{_id,title,answerHtml}] }]
 */
export async function getFaqPublic() {
  const res = await api.get("/api/faq");
  const payload = res.data?.data ?? res.data;
  return payload?.groups || [];
}
