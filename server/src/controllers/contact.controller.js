import ContactMessage from "../models/ContactMessage.js";
import { responseOk, responseError } from "../utils/response.js";

/**
 * POST /api/contact-messages
 * Body: { name, email, phone, subject, message? }
 */
export async function createContactMessage(req, res) {
  try {
    const { name, email, phone, subject, message } = req.body || {};
    const errors = {};

    // Tên
    if (!name || typeof name !== "string" || !name.trim()) {
      errors.name = "Vui lòng nhập tên";
    } else if (name.trim().length > 100) {
      errors.name = "Tên tối đa 100 ký tự";
    }

    // Email
    if (!email || typeof email !== "string" || !email.trim()) {
      errors.email = "Vui lòng nhập email";
    } else if (email.trim().length > 100) {
      errors.email = "Email tối đa 100 ký tự";
    } else if (!/^[^@\s]+@gmail\.com$/i.test(email.trim())) {
      errors.email = "Email phải có đuôi @gmail.com";
    }

    // Số điện thoại
    if (!phone || typeof phone !== "string" || !phone.trim()) {
      errors.phone = "Vui lòng nhập số điện thoại";
    } else if (!/^\d{1,11}$/.test(phone.trim())) {
      errors.phone =
        "Số điện thoại chỉ được nhập số, tối đa 11 chữ số";
    }

    // Tiêu đề
    if (!subject || typeof subject !== "string" || !subject.trim()) {
      errors.subject = "Vui lòng nhập tiêu đề";
    } else if (subject.trim().length > 100) {
      errors.subject = "Tiêu đề tối đa 100 ký tự";
    }

    // Lời nhắn (optional)
    if (message && String(message).length > 1000) {
      errors.message = "Lời nhắn tối đa 1000 ký tự";
    }

    if (Object.keys(errors).length > 0) {
      return res
        .status(400)
        .json(responseError("Dữ liệu không hợp lệ", { errors }));
    }

    const doc = await ContactMessage.create({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      subject: subject.trim(),
      message: (message || "").trim(),
    });

    return res.status(201).json(responseOk({ data: doc }));
  } catch (err) {
    console.error("[contact.create] error:", err);
    return res
      .status(500)
      .json(
        responseError("Không thể gửi liên hệ, vui lòng thử lại sau.")
      );
  }
}
