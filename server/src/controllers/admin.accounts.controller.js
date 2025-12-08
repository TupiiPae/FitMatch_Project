import mongoose from "mongoose";
import { Admin } from "../models/Admin.js";

/**
 * GET /api/admin/admin-accounts
 * Trả về danh sách admin: level 1 nằm trên đầu, rồi đến level 2
 */
export async function listAdminAccounts(_req, res) {
  const items = await Admin.find({})
    .select("-password")
    .sort({ level: 1, createdAt: 1 }) // level:1 (cấp 1) trước, rồi theo thời gian tạo
    .lean();

  return res.json({
    items: items.map((x) => ({
      id: x._id.toString(),
      username: x.username,
      nickname: x.nickname,
      level: x.level,
      status: x.status,
      createdAt: x.createdAt,
      updatedAt: x.updatedAt,
    })),
    total: items.length,
  });
}

/**
 * POST /api/admin/admin-accounts
 * Body: { username, nickname, password? }  -> luôn tạo level = 2
 */
export async function createAdminAccount(req, res) {
  const { username, nickname, password } = req.body || {};
  if (!username || !nickname) {
    return res.status(400).json({ message: "Thiếu username hoặc nickname" });
  }

  const existed = await Admin.findOne({ username }).lean();
  if (existed) return res.status(409).json({ message: "Username đã tồn tại" });

  const doc = new Admin({
    username,
    nickname,
    password: password || "fitmatch@admin2",
    level: 2,            // chỉ tạo cấp 2
    status: "active",
  });
  await doc.save();

  return res.status(201).json({
    id: doc._id.toString(),
    username: doc.username,
    nickname: doc.nickname,
    level: doc.level,
    status: doc.status,
  });
}

/**
 * PATCH /api/admin/admin-accounts/:id
 * Body: { nickname?, status? }
 */
export async function updateAdminAccount(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "ID không hợp lệ" });
  }

  const { nickname, status } = req.body || {};
  const $set = {};
  if (nickname) $set.nickname = nickname;
  if (status) $set.status = status;

  const doc = await Admin.findByIdAndUpdate(
    id,
    { $set },
    { new: true, runValidators: true }
  ).select("-password");

  if (!doc) return res.status(404).json({ message: "Không tìm thấy" });

  return res.json({
    id: doc._id.toString(),
    username: doc.username,
    nickname: doc.nickname,
    level: doc.level,
    status: doc.status,
  });
}

/**
 * DELETE /api/admin/admin-accounts/:id
 * Không cho xoá chính mình
 */
export async function deleteAdminAccount(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "ID không hợp lệ" });
  }
  if (id === req.userId) {
    return res.status(400).json({ message: "Không thể xoá chính mình" });
  }

  const doc = await Admin.findByIdAndDelete(id).select("-password");
  if (!doc) return res.status(404).json({ message: "Không tìm thấy" });

  return res.json({ success: true });
}

/**
 * POST /api/admin/admin-accounts/:id/block
 */
export async function blockAdminAccount(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "ID không hợp lệ" });
  }
  const doc = await Admin.findByIdAndUpdate(
    id,
    { $set: { status: "locked" } },
    { new: true }
  ).select("-password");

  if (!doc) return res.status(404).json({ message: "Không tìm thấy" });

  return res.json({ id: doc._id.toString(), status: doc.status });
}

/**
 * POST /api/admin/admin-accounts/:id/unblock
 */
export async function unblockAdminAccount(req, res) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ message: "ID không hợp lệ" });
  }
  const doc = await Admin.findByIdAndUpdate(
    id,
    { $set: { status: "active" } },
    { new: true }
  ).select("-password");

  if (!doc) return res.status(404).json({ message: "Không tìm thấy" });

  return res.json({ id: doc._id.toString(), status: doc.status });
}
