import { Onboarding } from "../models/onboarding.model.js";
import { User } from "../models/User.js";
import { OnboardingInputSchema } from "../validators/onboarding.schema.js";
import { tinhBmi, tinhBmr } from "../utils/healthUtils.js";

export async function upsertOnboarding(req, res) {
  try {
    // auth.js của bạn đặt userId ở req.userId
    if (!req.userId) return res.status(401).json({ success: false, message: "Chưa xác thực người dùng" });

    const body = OnboardingInputSchema.parse(req.body);

    const bmi = tinhBmi(body.canNangHienTai, body.chieuCao);
    const bmr = tinhBmr({
      gioiTinh: body.gioiTinh,
      canNangKg: body.canNangHienTai,
      chieuCaoCm: body.chieuCao,
      ngaySinh: body.ngaySinh,
    });

    const payload = {
      ...body,
      bmi,
      bmr,
      hoanTatOnboarding: true,
      user: req.userId,
    };

    const doc = await Onboarding.findOneAndUpdate(
      { user: req.userId },
      { $set: payload, $setOnInsert: { user: req.userId } },
      { new: true, upsert: true }
    );

    // Đồng bộ snapshot tối thiểu sang User.profile + onboarded
    const userUpdate = {
      onboarded: true,
      "profile.nickname": body.tenGoi,
      "profile.goal": body.mucTieu,
      "profile.heightCm": body.chieuCao,
      "profile.weightKg": body.canNangHienTai,
      "profile.targetWeightKg": body.canNangMongMuon,
      "profile.weeklyChangeKg": body.mucTieuTuan,
      "profile.trainingIntensity": body.cuongDoLuyenTap,
      // giữ User.profile không thêm sex/dob nếu bạn không muốn — có thể bổ sung nếu cần:
      // "profile.sex": body.gioiTinh,
      // "profile.dob": body.ngaySinh,
    };
    await User.findByIdAndUpdate(req.userId, { $set: userUpdate });

    return res.json({ success: true, data: doc });
  } catch (err) {
    if (err?.issues) {
      return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ", errors: err.issues });
    }
    console.error("upsertOnboarding lỗi:", err);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
}

export async function getMyOnboarding(req, res) {
  try {
    if (!req.userId) return res.status(401).json({ success: false, message: "Chưa xác thực người dùng" });
    const doc = await Onboarding.findOne({ user: req.userId });
    if (!doc) return res.status(404).json({ success: false, message: "Chưa có dữ liệu onboarding" });
    return res.json({ success: true, data: doc });
  } catch (e) {
    console.error("getMyOnboarding lỗi:", e);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
}
