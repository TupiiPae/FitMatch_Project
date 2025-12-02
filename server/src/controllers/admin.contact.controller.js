// server/src/controllers/admin.contact.controller.js
import mongoose from "mongoose";
import ContactMessage from "../models/ContactMessage.js";
import { responseOk, responseError } from "../utils/response.js";

const ALLOWED_STATUS = ["new", "processing", "done"];
const MAX_NOTE_LENGTH = 1000;

/**
 * GET /api/admin/contact-messages
 * query: q?, status?, limit?, skip?
 */
export async function listContactMessages(req, res) {
  try {
    const { q, status } = req.query;
    let { limit = 10, skip = 0 } = req.query;

    limit = Math.min(parseInt(limit, 10) || 10, 100);
    skip = Math.max(parseInt(skip, 10) || 0, 0);

    const filter = {};

    // Lọc theo trạng thái
    if (status && ALLOWED_STATUS.includes(status)) {
      filter.status = status;
    }

    // Tìm kiếm theo tên / email / phone / subject / mã contact (đuôi _id)
    if (q && q.trim()) {
      const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(safe, "i");

      filter.$or = [
        { name: rx },
        { email: rx },
        { phone: rx },
        { subject: rx },
        // Tìm theo chuỗi _id (dùng cho Mã Contact #xxxxxx)
        {
          $expr: {
            $regexMatch: {
              input: { $toString: "$_id" },
              regex: safe,
              options: "i",
            },
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      ContactMessage.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      ContactMessage.countDocuments(filter),
    ]);

    return res.json(
      responseOk({
        data: { items, total, limit, skip },
      })
    );
  } catch (err) {
    console.error("[admin.contact.list] error:", err);
    return res
      .status(500)
      .json(responseError("Không thể tải danh sách liên hệ"));
  }
}

/**
 * GET /api/admin/contact-messages/:id
 */
export async function getContactMessage(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json(responseError("Không tìm thấy liên hệ"));
    }

    const doc = await ContactMessage.findById(id);
    if (!doc) {
      return res.status(404).json(responseError("Không tìm thấy liên hệ"));
    }

    return res.json(responseOk({ data: doc }));
  } catch (err) {
    console.error("[admin.contact.get] error:", err);
    return res
      .status(500)
      .json(responseError("Không thể tải chi tiết liên hệ"));
  }
}

/**
 * PATCH /api/admin/contact-messages/:id
 * body: { status?, internalNote? }
 */
export async function updateContactMessage(req, res) {
  try {
    const { id } = req.params;
    let { status, internalNote } = req.body || {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json(responseError("Không tìm thấy liên hệ"));
    }

    const update = {};

    // Nếu có gửi status thì validate & cập nhật
    if (typeof status !== "undefined") {
      if (!ALLOWED_STATUS.includes(status)) {
        return res
          .status(400)
          .json(responseError("Trạng thái không hợp lệ"));
      }
      update.status = status;
    }

    // Nếu có gửi internalNote thì cắt về tối đa 1000 ký tự
    if (typeof internalNote !== "undefined") {
      if (internalNote === null) internalNote = "";
      if (typeof internalNote !== "string") {
        internalNote = String(internalNote ?? "");
      }
      internalNote = internalNote.slice(0, MAX_NOTE_LENGTH);
      update.internalNote = internalNote;
    }

    // Không có field nào cần cập nhật
    if (!Object.keys(update).length) {
      return res.json(
        responseOk({
          data: null,
          message: "Không có thay đổi để cập nhật",
        })
      );
    }

    const doc = await ContactMessage.findByIdAndUpdate(id, update, {
      new: true,
    });

    if (!doc) {
      return res.status(404).json(responseError("Không tìm thấy liên hệ"));
    }

    return res.json(responseOk({ data: doc }));
  } catch (err) {
    console.error("[admin.contact.update] error:", err);
    return res
      .status(500)
      .json(responseError("Không thể cập nhật liên hệ"));
  }
}

/**
 * DELETE /api/admin/contact-messages/:id
 */
export async function deleteContactMessage(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json(responseError("Không tìm thấy liên hệ"));
    }

    const doc = await ContactMessage.findByIdAndDelete(id);
    if (!doc) {
      return res.status(404).json(responseError("Không tìm thấy liên hệ"));
    }

    return res.json(responseOk({ data: { deletedId: id } }));
  } catch (err) {
    console.error("[admin.contact.delete] error:", err);
    return res
      .status(500)
      .json(responseError("Không thể xoá liên hệ"));
  }
}
