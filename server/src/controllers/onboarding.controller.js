// server/src/controllers/onboarding.controller.js
import { Onboarding } from "../models/OnboardingProfile.js";
import { User } from "../models/User.js";
import { OnboardingInputSchema } from "../validators/onboarding.schema.js";
import { tinhBmi, tinhBmr } from "../utils/health.js";

export async function upsertOnboarding(req, res) {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Chưa xác thực người dùng" });
    }

    const duLieu = OnboardingInputSchema.parse(req.body);

    const bmi = tinhBmi(duLieu.canNangHienTai, duLieu.chieuCao);
    const bmr = tinhBmr({
      gioiTinh: duLieu.gioiTinh,
      canNangKg: duLieu.canNangHienTai,
      chieuCaoCm: duLieu.chieuCao,
      ngaySinh: duLieu.ngaySinh,
    });

    const $set = {
      tenGoi: duLieu.tenGoi,
      mucTieu: duLieu.mucTieu,
      chieuCao: duLieu.chieuCao,
      canNangHienTai: duLieu.canNangHienTai,
      canNangMongMuon: duLieu.canNangMongMuon,
      mucTieuTuan: duLieu.mucTieuTuan,
      cuongDoLuyenTap: duLieu.cuongDoLuyenTap,
      gioiTinh: duLieu.gioiTinh,
      ngaySinh: duLieu.ngaySinh,
      bmi,
      bmr,
      hoanTatOnboarding: true,
    };

    const $setOnInsert = {
      user: req.userId,
      phienBan: 1,
    };

    const doc = await Onboarding.findOneAndUpdate(
      { user: req.userId },
      { $set, $setOnInsert },
      { new: true, upsert: true }
    );

    // Đồng bộ snapshot sang User (tùy chọn)
    await User.findByIdAndUpdate(req.userId, {
      $set: {
        onboarded: true,
        "profile.nickname": duLieu.tenGoi,
        "profile.goal": duLieu.mucTieu,
        "profile.heightCm": duLieu.chieuCao,
        "profile.weightKg": duLieu.canNangHienTai,
        "profile.targetWeightKg": duLieu.canNangMongMuon,
        "profile.weeklyChangeKg": duLieu.mucTieuTuan,
        "profile.trainingIntensity": duLieu.cuongDoLuyenTap,
      },
    });

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
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Chưa xác thực người dùng" });
    }
    const doc = await Onboarding.findOne({ user: req.userId });
    if (!doc) {
      return res.status(404).json({ success: false, message: "Chưa có dữ liệu onboarding" });
    }
    return res.json({ success: true, data: doc });
  } catch (e) {
    console.error("getMyOnboarding lỗi:", e);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
}
