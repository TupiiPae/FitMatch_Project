// server/src/controllers/user.controller.js
import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { OnboardingProfile } from "../models/OnboardingProfile.js"; // để xoá kèm khi delete account
import { tinhBmi, tinhBmr, tinhTdee } from "../utils/health.js";

// Gom logic dựng lại BMI/BMR/TDEE khi đủ dữ liệu nền
function computeDerived(profile) {
  if (!profile) return {};

  const {
    weightKg,
    heightCm,
    sex,
    dob,
    trainingIntensity,
  } = profile;

  // Cần tối thiểu các field này để tính
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

    // TDEE cần trainingIntensity; nếu chưa có thì mặc định level_1
    const tdee = tinhTdee(bmr, trainingIntensity || "level_1");
    return { bmi, bmr, tdee };
  }

  return {};
}

// GET /api/user/me
export const getMe = async (req, res) => {
  const me = await User.findById(req.userId)
    .select("_id username email role onboarded profile")
    .lean();

  if (!me) return res.status(404).json({ message: "Không tìm thấy người dùng" });

  // Lazy backfill: nếu thiếu bất kỳ bmi/bmr/tdee mà có đủ dữ liệu nền → tính và lưu
  const needBackfill =
    !!me.profile &&
    (
      me.profile?.bmi == null ||
      me.profile?.bmr == null ||
      me.profile?.tdee == null
    );

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
        // phản ánh trên response hiện tại
        me.profile = { ...me.profile, ...derived };
      }
    } catch (e) {
      // không chặn response nếu backfill lỗi; chỉ log
      console.error("Backfill BMI/BMR/TDEE lỗi:", e?.message || e);
    }
  }

  res.json({ user: { id: me._id, ...me } });
};

// PATCH /api/user/onboarding
// Chỉ cho phép cập nhật các trường nền; BMI/BMR/TDEE sẽ được tính lại tự động
export const patchOnboarding = async (req, res) => {
  // Các trường nền user có thể sửa
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

  // KHÔNG cho phép set trực tiếp các trường tính toán
  const forbidden = ["profile.bmi", "profile.bmr", "profile.tdee"];

  // Lọc input
  const $set = {};
  for (const [k, v] of Object.entries(req.body || {})) {
    if (forbidden.includes(k)) continue;
    if (allowed.includes(k)) $set[k] = v;
  }
  if (!Object.keys($set).length) {
    return res.status(400).json({ message: "Không có trường hợp lệ" });
  }

  // Lấy hồ sơ hiện tại để tính toán sau khi merge
  const current = await User.findById(req.userId)
    .select("_id profile")
    .lean();

  if (!current) return res.status(404).json({ message: "Không tìm thấy người dùng" });

  // Tạo bản profile sau cập nhật (merge nông)
  const mergedProfile = {
    ...(current.profile || {}),
    // spread sâu theo prefix "profile."
    ...Object.keys($set).reduce((acc, k) => {
      // k là "profile.xxx"
      const key = k.replace(/^profile\./, "");
      acc[key] = $set[k];
      return acc;
    }, {}),
  };

  const baseTdee = (derived.tdee != null ? derived.tdee : (mergedProfile.tdee));
const baseBmr  = (derived.bmr  != null ? derived.bmr  : (mergedProfile.bmr));

let calorieTarget;
try {
  if (typeof baseTdee === "number" && baseTdee > 0) {
    calorieTarget = tinhCalorieTarget({
      tdee: baseTdee,
      mucTieu: mergedProfile.goal,
      mucTieuTuan: mergedProfile.weeklyChangeKg,
      bmr: baseBmr,
    });
  }
} catch (_) {
  // bỏ qua nếu chưa đủ dữ liệu
}

  // Tính lại các trường dẫn xuất
  let derived = {};
  try {
    derived = computeDerived(mergedProfile);
  } catch (e) {
    return res.status(400).json({ message: e?.message || "Dữ liệu không hợp lệ" });
  }

  // Gộp set cuối cùng
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

// POST /api/user/onboarding/finalize
export const finalizeOnboarding = async (req, res) => {
  await User.findByIdAndUpdate(req.userId, { $set: { onboarded: true } });
  res.json({ success: true });
};

/**
 * PATCH /api/user/account
 * - Cập nhật email (root) + các field profile cơ bản: nickname, sex, dob, trainingIntensity
 * - Nếu thay đổi các field nền liên quan (sex, dob) → tính lại BMI/BMR/TDEE (dựa vào computeDerived)
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

    const forbidden = ["profile.bmi", "profile.bmr", "profile.tdee", "password", "role", "username"];

    const $set = {};
    for (const [k, v] of Object.entries(req.body || {})) {
      if (forbidden.includes(k)) continue;
      if (allowedRoot.includes(k) || allowedProfile.includes(k)) {
        $set[k] = v;
      }
    }

    if (!Object.keys($set).length) {
      return res.status(400).json({ message: "Không có trường hợp lệ để cập nhật" });
    }

    // Lấy current user
    const current = await User.findById(req.userId).select("_id email profile").lean();
    if (!current) return res.status(404).json({ message: "Không tìm thấy người dùng" });

    // Nếu đổi email → kiểm tra trùng
    if ($set.email && $set.email !== current.email) {
      const existed = await User.findOne({ email: $set.email }).select("_id").lean();
      if (existed) return res.status(409).json({ message: "Email đã được sử dụng" });
    }

    // Tạo mergedProfile để tính lại derived nếu cần
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

    // Tính lại BMI/BMR/TDEE (nếu đủ dữ liệu nền)
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
    ).select("_id username email role onboarded profile");

    return res.json({ success: true, user: updated });
  } catch (e) {
    console.error("updateAccount lỗi:", e?.message || e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};

/**
 * POST /api/user/change-password
 * body: { currentPassword, newPassword }
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Thiếu currentPassword hoặc newPassword" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "Mật khẩu mới phải có ít nhất 6 ký tự" });
    }

    // Lấy user kèm password (password select: false ở schema)
    const user = await User.findById(req.userId).select("+password");
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng" });

    // So khớp mật khẩu hiện tại
    const match = await bcrypt.compare(currentPassword, user.password || "");
    if (!match) return res.status(400).json({ message: "Mật khẩu hiện tại không đúng" });

    // Hash mật khẩu mới
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

/**
 * DELETE /api/user
 * - Xoá tài khoản (và dữ liệu liên quan).
 * - Có thể yêu cầu body { currentPassword } nếu muốn tăng an toàn (tuỳ chọn).
 */
export const deleteAccount = async (req, res) => {
  try {
    // (Tuỳ chọn) kiểm tra currentPassword trước khi xoá
    // const { currentPassword } = req.body || {};
    // if (!currentPassword) return res.status(400).json({ message: "Thiếu currentPassword" });
    // const userWithPass = await User.findById(req.userId).select("+password");
    // const ok = await bcrypt.compare(currentPassword, userWithPass.password || "");
    // if (!ok) return res.status(400).json({ message: "Mật khẩu không đúng" });

    // Xoá các dữ liệu liên quan
    await OnboardingProfile.findOneAndDelete({ user: req.userId });

    // Xoá user
    await User.findByIdAndDelete(req.userId);

    return res.json({ success: true, message: "Tài khoản đã được xoá" });
  } catch (e) {
    console.error("deleteAccount lỗi:", e?.message || e);
    return res.status(500).json({ message: "Lỗi máy chủ" });
  }
};
