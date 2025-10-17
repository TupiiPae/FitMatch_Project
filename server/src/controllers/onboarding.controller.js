// server/src/controllers/onboarding.controller.js
import { OnboardingProfile } from "../models/OnboardingProfile.js";
import { User } from "../models/User.js";
import { OnboardingInputSchema } from "../validators/onboarding.schema.js";
import { tinhBmi, tinhBmr, tinhTdee, tinhCalorieTarget } from "../utils/health.js";

/** ---- SHAPER: trả dữ liệu gọn (_id, user, username, base, goals) ---- */
function shapeOnboarding(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    _id: o._id,
    user: o.user,
    username: o.usernameCache,
    base: o.base || {},
    goals: o.goals || [],
    // Nếu cần thêm: createdAt/updatedAt
    // createdAt: o.createdAt, updatedAt: o.updatedAt,
  };
}

/** ---- HELPER: migrate document kiểu cũ (flat fields) -> base/goals ---- */
async function ensureNewStructure(userId) {
  const doc = await OnboardingProfile.findOne({ user: userId });
  if (!doc) return null;

  // Nếu đã có base/goals thì thôi
  if (doc.base || Array.isArray(doc.goals)) return doc;

  // Migrate từ schema cũ (các field phẳng) sang base
  const base = {
    tenGoi: doc.tenGoi,
    mucTieu: doc.mucTieu,
    chieuCao: doc.chieuCao,
    canNangHienTai: doc.canNangHienTai,
    canNangMongMuon: doc.canNangMongMuon,
    mucTieuTuan: doc.mucTieuTuan,
    cuongDoLuyenTap: doc.cuongDoLuyenTap,
    gioiTinh: doc.gioiTinh,
    ngaySinh: doc.ngaySinh,
    bmi: doc.bmi,
    bmr: doc.bmr,
    tdee: doc.tdee,
    calorieTarget: doc.calorieTarget ?? undefined,
    hoanTatOnboarding: doc.hoanTatOnboarding ?? true,
    finalizedAt: doc.updatedAt || new Date(),
  };

  // Cache hiển thị
  const user = await User.findById(userId).select("username").lean();
  doc.usernameCache = user?.username || doc.usernameCache || undefined;
  doc.userIdCache = String(userId);

  doc.base = base;
  doc.goals = [];
  doc.phienBan = 2;

  // Xoá field cũ (không bắt buộc, chỉ để DB sạch)
  doc.set(
    {
      tenGoi: undefined,
      mucTieu: undefined,
      chieuCao: undefined,
      canNangHienTai: undefined,
      canNangMongMuon: undefined,
      mucTieuTuan: undefined,
      cuongDoLuyenTap: undefined,
      gioiTinh: undefined,
      ngaySinh: undefined,
      bmi: undefined,
      bmr: undefined,
      tdee: undefined,
      calorieTarget: undefined,
      hoanTatOnboarding: undefined,
    },
    { strict: false }
  );

  await doc.save();
  return doc;
}

/** ---- HELPER: tính derived + ước tính goal ---- */
function buildGoalSnapshot(input, userProfileSexDob) {
  const {
    chieuCao,
    canNangHienTai,
    canNangMongMuon,
    mucTieu,
    mucTieuTuan,
    cuongDoLuyenTap,
    bodyFat,
  } = input;

  const bmi =
    chieuCao && canNangHienTai ? tinhBmi(canNangHienTai, chieuCao) : undefined;

  let bmr, tdee, calorieTarget;
  if (userProfileSexDob?.sex && userProfileSexDob?.dob && chieuCao && canNangHienTai) {
    bmr = tinhBmr({
      gioiTinh: userProfileSexDob.sex,
      canNangKg: canNangHienTai,
      chieuCaoCm: chieuCao,
      ngaySinh: userProfileSexDob.dob,
    });
    tdee = tinhTdee(bmr, cuongDoLuyenTap || "level_1");
    calorieTarget = tinhCalorieTarget?.({ tdee, mucTieu, mucTieuTuan, bmr });
  }

  const diff = Math.abs((canNangMongMuon ?? canNangHienTai) - canNangHienTai);
  const weeks = Math.max(1, Math.ceil(diff / (mucTieuTuan || 0.5)));
  const startedAt = new Date();
  const estimatedFinishAt = new Date(startedAt.getTime() + weeks * 7 * 86400000);

  return {
    chieuCao,
    canNangHienTai,
    canNangMongMuon,
    mucTieu,
    mucTieuTuan,
    cuongDoLuyenTap,
    bodyFat,
    bmi,
    bmr,
    tdee,
    calorieTarget,
    estimatedWeeks: weeks,
    startedAt,
    estimatedFinishAt,
    status: "active",
  };
}

/** ---- API: Nhập lần đầu / finalize onboarding (ghi vào base + sync User.profile) ---- */
export async function upsertOnboarding(req, res) {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Chưa xác thực người dùng" });
    }

    const duLieu = OnboardingInputSchema.parse(req.body);

    // Tính derived
    const bmi = tinhBmi(duLieu.canNangHienTai, duLieu.chieuCao);
    const bmr = tinhBmr({
      gioiTinh: duLieu.gioiTinh,
      canNangKg: duLieu.canNangHienTai,
      chieuCaoCm: duLieu.chieuCao,
      ngaySinh: duLieu.ngaySinh,
    });
    const tdee = tinhTdee(bmr, duLieu.cuongDoLuyenTap);
    const calorieTarget = tinhCalorieTarget?.({
      tdee,
      mucTieu: duLieu.mucTieu,
      mucTieuTuan: duLieu.mucTieuTuan,
      bmr,
    });

    // Kiểm tra/migrate doc
    let doc = await ensureNewStructure(req.userId);

    // Nếu đã có doc và base đã finalize -> chặn sửa base, yêu cầu dùng /goal
    if (doc?.base?.finalizedAt) {
      return res.status(409).json({
        success: false,
        message: "Onboarding đã hoàn tất trước đó. Vui lòng dùng chức năng 'Thiết lập mục tiêu mới'.",
      });
    }

    // Nếu chưa có doc -> tạo rỗng trước
    if (!doc) {
      const u = await User.findById(req.userId).select("username").lean();
      doc = await OnboardingProfile.create({
        user: req.userId,
        usernameCache: u?.username,
        userIdCache: String(req.userId),
        phienBan: 2,
        goals: [],
      });
    }

    // Ghi base + finalize
    doc.base = {
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
      tdee,
      calorieTarget,
      hoanTatOnboarding: true,
      finalizedAt: new Date(),
    };
    await doc.save();

    // Sync sang User.profile và set onboarded
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
        "profile.sex": duLieu.gioiTinh,
        "profile.dob": duLieu.ngaySinh,
        "profile.bmi": +bmi?.toFixed?.(1) || bmi,
        "profile.bmr": Math.round(bmr),
        "profile.tdee": Math.round(tdee),
        ...(calorieTarget != null ? { "profile.calorieTarget": Math.round(calorieTarget) } : {}),
      },
    });

    return res.json({ success: true, data: shapeOnboarding(doc) });
  } catch (err) {
    if (err?.issues || err?.message?.includes("hợp lệ")) {
      return res.status(400).json({
        success: false,
        message: err.message || "Dữ liệu không hợp lệ",
        errors: err.issues,
      });
    }
    console.error("upsertOnboarding lỗi:", err);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
}

/** ---- API: Lấy Onboarding của tôi (tự migrate nếu cần) ---- */
export async function getMyOnboarding(req, res) {
  try {
    if (!req.userId) {
      return res.status(401).json({ success: false, message: "Chưa xác thực người dùng" });
    }

    // Tự migrate nếu là doc cũ
    let doc = await ensureNewStructure(req.userId);
    if (!doc) {
      return res.status(404).json({ success: false, message: "Chưa có dữ liệu onboarding" });
    }

    return res.json({ success: true, data: shapeOnboarding(doc) });
  } catch (e) {
    console.error("getMyOnboarding lỗi:", e);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
}

/** ---- API: Tạo goal snapshot mới + đồng bộ User.profile ---- */
export async function createGoal(req, res) {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Chưa xác thực người dùng" });

    // Nhận body rút gọn (theo FE gửi)
    const {
      chieuCao,
      canNangHienTai,
      canNangMongMuon,
      mucTieu,
      mucTieuTuan,
      cuongDoLuyenTap,
      bodyFat,
    } = req.body || {};

    // Validate cơ bản
    if (!(chieuCao && canNangHienTai && mucTieu && mucTieuTuan && cuongDoLuyenTap)) {
      return res.status(400).json({ success: false, message: "Thiếu dữ liệu bắt buộc" });
    }
    if (typeof mucTieuTuan !== "number" || mucTieuTuan <= 0 || mucTieuTuan > 1) {
      return res.status(400).json({ success: false, message: "mucTieuTuan phải trong 0.1–1.0" });
    }
    if (bodyFat != null && (bodyFat < 0 || bodyFat > 70)) {
      return res.status(400).json({ success: false, message: "bodyFat phải 0–70%" });
    }
    // Rule target
    if (canNangMongMuon != null) {
      if ((mucTieu === "giam_can" || mucTieu === "giam_mo") && !(canNangMongMuon < canNangHienTai)) {
        return res.status(400).json({ success: false, message: "Mục tiêu giảm nhưng cân nặng mục tiêu phải thấp hơn hiện tại" });
      }
      if ((mucTieu === "tang_can" || mucTieu === "tang_co") && !(canNangMongMuon > canNangHienTai)) {
        return res.status(400).json({ success: false, message: "Mục tiêu tăng nhưng cân nặng mục tiêu phải cao hơn hiện tại" });
      }
    }

    // Migrate nếu doc cũ
    let doc = await ensureNewStructure(userId);
    if (!doc) {
      // Nếu chưa có doc => tạo base trống + goals []
      const user = await User.findById(userId).select("username").lean();
      doc = await OnboardingProfile.create({
        user: userId,
        usernameCache: user?.username,
        userIdCache: String(userId),
        base: { hoanTatOnboarding: true, finalizedAt: new Date() },
        goals: [],
        phienBan: 2,
      });
    }

    // Build snapshot mới
    const me = await User.findById(userId).select("profile.sex profile.dob").lean();
    const snap = buildGoalSnapshot(
      {
        chieuCao,
        canNangHienTai,
        canNangMongMuon,
        mucTieu,
        mucTieuTuan,
        cuongDoLuyenTap,
        bodyFat,
      },
      { sex: me?.profile?.sex, dob: me?.profile?.dob }
    );

    // Archive goal active cũ (nếu muốn enforce 1 active)
    if (doc.goals?.length) {
      doc.goals.forEach((g) => {
        if (g.status === "active") g.status = "archived";
      });
    }

    // Push goal mới
    const seq = (doc.goals?.length || 0) + 1;
    doc.goals.push({ seq, label: `Goal${seq}`, ...snap });
    await doc.save();

    // Sync sang User.profile
    await User.findByIdAndUpdate(userId, {
      $set: {
        "profile.heightCm": chieuCao,
        "profile.weightKg": canNangHienTai,
        "profile.targetWeightKg": canNangMongMuon ?? undefined,
        "profile.goal": mucTieu,
        "profile.weeklyChangeKg": mucTieuTuan,
        "profile.trainingIntensity": cuongDoLuyenTap,
        ...(bodyFat != null ? { "profile.bodyFat": bodyFat } : {}),
        ...(snap.bmi != null ? { "profile.bmi": +snap.bmi?.toFixed?.(1) || snap.bmi } : {}),
        ...(snap.bmr != null ? { "profile.bmr": Math.round(snap.bmr) } : {}),
        ...(snap.tdee != null ? { "profile.tdee": Math.round(snap.tdee) } : {}),
        ...(snap.calorieTarget != null ? { "profile.calorieTarget": Math.round(snap.calorieTarget) } : {}),
        "profile.lastUpdatedFrom": "goal_snapshot",
      },
    });

    // Trả về goal mới nhất + doc gọn
    const latest = doc.goals[doc.goals.length - 1];
    return res.json({ success: true, goal: latest, data: shapeOnboarding(doc) });
  } catch (e) {
    console.error("createGoal lỗi:", e);
    return res.status(500).json({ success: false, message: "Lỗi máy chủ" });
  }
}
