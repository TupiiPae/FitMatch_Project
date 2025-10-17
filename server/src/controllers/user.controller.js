// server/src/controllers/user.controller.js
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { OnboardingProfile } from "../models/OnboardingProfile.js"; // khớp model bạn vừa chốt
import {
  tinhBmi,
  tinhBmr,
  tinhTdee,
  // có thể bạn đã thêm hàm này; nếu chưa, guard bên dưới sẽ tránh lỗi
  tinhCalorieTarget as _tinhCalorieTarget,
} from "../utils/health.js";

const tinhCalorieTarget = _tinhCalorieTarget;

/** Tính lại BMI/BMR/TDEE khi đủ dữ liệu nền */
function computeDerived(profile) {
  if (!profile) return {};

  const { weightKg, heightCm, sex, dob, trainingIntensity } = profile;

  if (
    typeof weightKg === "number" &&
    typeof heightCm === "number" &&
    sex &&
    dob
  ) {
    const bmi = tinhBmi(weightKg, heightCm);
    const bmr = tinhBmr({
      gioiTinh: sex,
      canNangKg: weightKg,
      chieuCaoCm: heightCm,
      ngaySinh: dob,
    });
    const tdee = tinhTdee(bmr, trainingIntensity || "level_1");
    return { bmi, bmr, tdee };
  }

  return {};
}

/** GET /api/user/me */
export const getMe = async (req, res) => {
  const me = await User.findById(req.userId)
    .select("_id username email role onboarded profile createdAt")
    .lean();

  if (!me) return res.status(404).json({ message: "Không tìm thấy người dùng" });

  // Backfill nếu thiếu chỉ số tính toán
  const needBackfill =
    !!me.profile &&
    (me.profile?.bmi == null ||
      me.profile?.bmr == null ||
      me.profile?.tdee == null);

  if (needBackfill) {
    try {
      const derived = computeDerived(me.profile);
      if (Object.keys(derived).length) {
        await User.findByIdAndUpdate(
          me._id,
          {
            $set: {
              "profile.bmi": derived.bmi,
              "profile.bmr": derived.bmr,
              "profile.tdee": derived.tdee,
            },
          },
          { runValidators: true }
        );
        me.profile = { ...me.profile, ...derived };
      }
    } catch (e) {
      console.error("Backfill BMI/BMR/TDEE lỗi:", e?.message || e);
    }
  }

  res.json({ user: { id: me._id, ...me } });
};

/** PATCH /api/user/onboarding
 *  — chỉ cho phép cập nhật trường nền; tự tính lại chỉ số dẫn xuất
 */
export const patchOnboarding = async (req, res) => {
  const allowed = [
    "profile.nickname",
    "profile.goal",
    "profile.heightCm",
    "profile.weightKg",
    "profile.targetWeightKg",
    "profile.weeklyChangeKg",
    "profile.trainingIntensity", // level_1..4
    "profile.sex",
    "profile.dob",
  ];
  const forbidden = [
    "profile.bmi",
    "profile.bmr",
    "profile.tdee",
    "profile.calorieTarget",
  ];

  // Lọc input
  const $set = {};
  for (const [k, v] of Object.entries(req.body || {})) {
    if (forbidden.includes(k)) continue;
    if (allowed.includes(k)) $set[k] = v;
  }
  if (!Object.keys($set).length) {
    return res.status(400).json({ message: "Không có trường hợp lệ" });
  }

  // 🔧 CHUẨN HOÁ weeklyChangeKg: luôn dương 0.1..1
  if ($set["profile.weeklyChangeKg"] != null) {
    const w = Number($set["profile.weeklyChangeKg"]);
    if (Number.isFinite(w)) {
      $set["profile.weeklyChangeKg"] = Math.abs(w);
    } else {
      return res.status(400).json({ message: "weeklyChangeKg phải là số" });
    }
  }

  const current = await User.findById(req.userId)
    .select("_id profile")
    .lean();
  if (!current) return res.status(404).json({ message: "Không tìm thấy người dùng" });

  // Merge profile
  const mergedProfile = {
    ...(current.profile || {}),
    ...Object.keys($set).reduce((acc, k) => {
      const key = k.replace(/^profile\./, "");
      acc[key] = $set[k];
      return acc;
    }, {}),
  };

  // Tính lại dẫn xuất (bmi/bmr/tdee)
  let derived = {};
  try {
    derived = computeDerived(mergedProfile);
  } catch (e) {
    return res.status(400).json({ message: e?.message || "Dữ liệu không hợp lệ" });
  }

  // (Tuỳ chọn) tính calorieTarget nếu có hàm và đủ dữ liệu
  let calorieTarget;
  try {
    const baseTdee =
      typeof derived.tdee === "number" ? derived.tdee : mergedProfile.tdee;
    const baseBmr =
      typeof derived.bmr === "number" ? derived.bmr : mergedProfile.bmr;

    if (
      typeof tinhCalorieTarget === "function" &&
      typeof baseTdee === "number" &&
      baseTdee > 0
    ) {
      calorieTarget = tinhCalorieTarget({
        tdee: baseTdee,
        mucTieu: mergedProfile.goal,
        mucTieuTuan: mergedProfile.weeklyChangeKg,
        bmr: baseBmr,
      });
    }
  } catch {
    // thiếu dữ liệu thì bỏ qua
  }

  // Gộp set cuối
  const finalSet = {
    ...$set,
    ...(derived.bmi != null ? { "profile.bmi": derived.bmi } : {}),
    ...(derived.bmr != null ? { "profile.bmr": derived.bmr } : {}),
    ...(derived.tdee != null ? { "profile.tdee": derived.tdee } : {}),
    ...(calorieTarget != null ? { "profile.calorieTarget": calorieTarget } : {}),
  };

  const updated = await User.findByIdAndUpdate(
    req.userId,
    { $set: finalSet },
    { new: true, runValidators: true }
  ).select("_id onboarded profile");

  res.json({ success: true, user: updated });
};

/** POST /api/user/onboarding/finalize */
export const finalizeOnboarding = async (_req, res) => {
  await User.findByIdAndUpdate(_req.userId, { $set: { onboarded: true } });
  res.json({ success: true });
};

/** PATCH /api/user/account
 *  — cập nhật email + mục tiêu (calorieTarget/macro…) + profile cơ bản
 *  — nếu thay đổi field nền → tính lại bmi/bmr/tdee
 */
export const updateAccount = async (req, res) => {
  try {
    const allowedRoot = ["email"];
    const allowedProfile = [
      "profile.nickname",
      "profile.sex",
      "profile.dob",
      "profile.trainingIntensity",
      "profile.calorieTarget",
      "profile.macroProtein",
      "profile.macroCarb",
      "profile.macroFat",
    ];
    const forbidden = [
      "profile.bmi",
      "profile.bmr",
      "profile.tdee",
      "password",
      "role",
      "username",
    ];

    const $set = {};
    for (const [k, v] of Object.entries(req.body || {})) {
      if (forbidden.includes(k)) continue;
      if (allowedRoot.includes(k) || allowedProfile.includes(k)) $set[k] = v;
    }
    if (!Object.keys($set).length) {
      return res.status(400).json({ message: "Không có trường hợp lệ để cập nhật" });
    }

    const current = await User.findById(req.userId)
      .select("_id email profile")
      .lean();
    if (!current) return res.status(404).json({ message: "Không tìm thấy người dùng" });

    if ($set.email && $set.email !== current.email) {
      const existed = await User.findOne({ email: $set.email })
        .select("_id")
        .lean();
      if (existed) return res.status(409).json({ message: "Email đã được sử dụng" });
    }

    const mergedProfile = {
      ...(current.profile || {}),
      ...Object.keys($set).reduce((acc, k) => {
        if (k.startsWith("profile.")) {
          const key = k.replace(/^profile\./, "");
          acc[key] = $set[k];
        }
        return acc;
      }, {}),
    };

    const derived = computeDerived(mergedProfile);

    const finalSet = {
      ...$set,
      ...(derived.bmi != null ? { "profile.bmi": derived.bmi } : {}),
      ...(derived.bmr != null ? { "profile.bmr": derived.bmr } : {}),
      ...(derived.tdee != null ? { "profile.tdee": derived.tdee } : {}),
    };

    const updated = await User.findByIdAndUpdate(
      req.userId,
      { $set: finalSet },
      { new: true, runValidators: true }
    ).select("_id username email role onboarded profile createdAt");

    return res.json({ success: true, user: updated });
  } catch (e) {
    console.error("updateAccount lỗi:", e?.message || e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

/** POST /api/user/change-password */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Thiếu currentPassword hoặc newPassword" });
    }
    if (String(newPassword).length < 6) {
      return res
        .status(400)
        .json({ message: "Mật khẩu mới phải có ít nhất 6 ký tự" });
    }

    const user = await User.findById(req.userId).select("+password");
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });

    const match = await bcrypt.compare(currentPassword, user.password || "");
    if (!match)
      return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(String(newPassword), salt);

    user.password = hashed;
    await user.save();

    return res.json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (e) {
    console.error("changePassword lỗi:", e?.message || e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

/** DELETE /api/user
 *  — Xoá tài khoản và dữ liệu liên quan (onboarding)
 */
export const deleteAccount = async (req, res) => {
  try {
    // Xoá bản ghi onboarding nếu có
    await OnboardingProfile.findOneAndDelete({ user: req.userId });

    // Xoá user
    await User.findByIdAndDelete(req.userId);

    return res.json({ success: true, message: "Tài khoản đã được xoá" });
  } catch (e) {
    console.error("deleteAccount lỗi:", e?.message || e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};
