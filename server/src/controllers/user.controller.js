// server/src/controllers/user.controller.js
import { User } from "../models/User.js";
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
    "profile.trainingIntensity", // level_1..4 (khuyến nghị)
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
  // (Tuỳ chọn) đảm bảo đủ dữ liệu tối thiểu trước khi finalize
  // const u = await User.findById(req.userId).select("profile");
  // if (!u?.profile?.nickname || !u?.profile?.goal) return res.status(400).json({ message: "Thiếu dữ liệu" });

  await User.findByIdAndUpdate(req.userId, { $set: { onboarded: true } });
  res.json({ success: true });
};
