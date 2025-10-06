// server/src/controllers/user.controller.js
import { User } from "../models/User.js";

export const getMe = async (req, res) => {
  const me = await User.findById(req.userId)
    .select("_id username email role onboarded profile") // tránh trả về thừa
    .lean();

  if (!me) return res.status(404).json({ message: "Không tìm thấy người dùng" });
  res.json({ user: { id: me._id, ...me } });
};

// PATCH /api/user/onboarding
export const patchOnboarding = async (req, res) => {
  const allowed = [
    "profile.nickname",
    "profile.goal",
    "profile.heightCm",
    "profile.weightKg",
    "profile.targetWeightKg",
    "profile.weeklyChangeKg",
    "profile.trainingIntensity",
  ];

  const $set = {};
  for (const [k, v] of Object.entries(req.body || {})) {
    if (allowed.includes(k)) $set[k] = v;
  }
  if (!Object.keys($set).length) {
    return res.status(400).json({ message: "Không có trường hợp lệ" });
  }

  const updated = await User.findByIdAndUpdate(
    req.userId,
    { $set },
    { new: true, runValidators: true } // ✅ bật validator min/max trong schema
  ).select("_id onboarded profile");

  res.json({ success: true, user: updated });
};

// POST /api/user/onboarding/finalize
export const finalizeOnboarding = async (req, res) => {
  // (Tuỳ chọn) kiểm tra đủ dữ liệu tối thiểu trước khi set onboarded
  // const u = await User.findById(req.userId).select("profile");
  // if (!u?.profile?.nickname || !u?.profile?.goal) return res.status(400).json({ message: "Thiếu dữ liệu" });

  await User.findByIdAndUpdate(req.userId, { $set: { onboarded: true } });
  res.json({ success: true });
};
