// server/src/controllers/admin.users.controller.js
import { User } from "../models/User.js";

export const adminBlockUser = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ message: "Vui lòng nhập lý do khóa" });
  }
  if (String(reason).length > 500) {
    return res.status(400).json({ message: "Lý do tối đa 500 ký tự" });
  }
  const updated = await User.findByIdAndUpdate(
    id,
    { $set: { blocked: true, blockedReason: String(reason).trim(), blockedAt: new Date() } },
    { new: true }
  ).select("_id username email blocked blockedReason blockedAt");
  if (!updated) return res.status(404).json({ message: "Không tìm thấy người dùng" });
  return res.json({ success: true });
};

export const adminUnblockUser = async (req, res) => {
  const { id } = req.params;
  const updated = await User.findByIdAndUpdate(
    id,
    { $set: { blocked: false }, $unset: { blockedReason: "", blockedAt: "" } },
    { new: true }
  ).select("_id username email blocked blockedReason blockedAt");
  if (!updated) return res.status(404).json({ message: "Không tìm thấy người dùng" });
  return res.json({ success: true });
};
