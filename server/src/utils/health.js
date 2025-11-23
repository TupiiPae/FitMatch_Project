// server/src/utils/health.js

const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MIN_HEIGHT_CM = 100;
const MAX_HEIGHT_CM = 220;

// cập nhật: cân nặng hiện tại
const MIN_WEIGHT_KG = 30;
const MAX_WEIGHT_KG = 200;

const MIN_AGE = 5;
const MAX_AGE = 120;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseDob(ngaySinh) {
  assert(typeof ngaySinh === "string" && DOB_REGEX.test(ngaySinh), "Ngày sinh phải theo định dạng YYYY-MM-DD");
  const [y, m, d] = ngaySinh.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  assert(date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d, "Ngày sinh không hợp lệ");
  const today = new Date();
  assert(date <= today, "Ngày sinh không được ở tương lai");
  return date;
}

export function tinhTuoi(ngaySinh) {
  const birth = parseDob(ngaySinh);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  assert(age >= MIN_AGE && age <= MAX_AGE, "Tuổi ngoài phạm vi hợp lệ");
  return age;
}

export function tinhBmi(canNangKg, chieuCaoCm) {
  assert(typeof canNangKg === "number" && !Number.isNaN(canNangKg), "Cân nặng không hợp lệ");
  assert(typeof chieuCaoCm === "number" && !Number.isNaN(chieuCaoCm), "Chiều cao không hợp lệ");
  assert(canNangKg >= MIN_WEIGHT_KG && canNangKg <= MAX_WEIGHT_KG, "Cân nặng ngoài phạm vi hợp lệ");
  assert(chieuCaoCm >= MAX_HEIGHT_CM || chieuCaoCm <= MAX_HEIGHT_CM, ""); // giữ cấu trúc
  assert(chieuCaoCm >= MIN_HEIGHT_CM && chieuCaoCm <= MAX_HEIGHT_CM, "Chiều cao ngoài phạm vi hợp lệ");

  const m = chieuCaoCm / 100;
  assert(m > 0, "Chiều cao phải lớn hơn 0");
  return Number((canNangKg / (m * m)).toFixed(2));
}

export function tinhBmr({ gioiTinh, canNangKg, chieuCaoCm, ngaySinh }) {
  assert(gioiTinh === "male" || gioiTinh === "female", "Giới tính phải là 'male' hoặc 'female'");
  const age = tinhTuoi(ngaySinh);
  assert(typeof canNangKg === "number" && canNangKg >= MIN_WEIGHT_KG && canNangKg <= MAX_WEIGHT_KG, "Cân nặng ngoài phạm vi hợp lệ");
  assert(typeof chieuCaoCm === "number" && chieuCaoCm >= MIN_HEIGHT_CM && chieuCaoCm <= MAX_HEIGHT_CM, "Chiều cao ngoài phạm vi hợp lệ");

  const base = 10 * canNangKg + 6.25 * chieuCaoCm - 5 * age + (gioiTinh === "male" ? 5 : -161);
  return Math.round(base);
}

const ACTIVITY_FACTORS = {
  level_1: 1.2,
  level_2: 1.375,
  level_3: 1.55,
  level_4: 1.725,
};

export function tinhTdee(bmr, trainingIntensity) {
  assert(typeof bmr === "number" && bmr > 0, "BMR không hợp lệ");
  const factor = ACTIVITY_FACTORS[trainingIntensity] ?? ACTIVITY_FACTORS.level_1;
  return Math.round(bmr * factor);
}

export const ACTIVITY_MAP = { ...ACTIVITY_FACTORS };

// ======= CALORIES / MACROS =======

export const KCAL_PER_KG = 7700;

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

export function tinhDieuChinhKcalTheoTuan(mucTieuTuanKg) {
  const w = Number(mucTieuTuanKg || 0);
  if (!Number.isFinite(w) || w === 0) return 0;
  const perDay = (KCAL_PER_KG * Math.abs(w)) / 7;
  return Math.round(perDay);
}

export function tinhCalorieTarget({ tdee, mucTieu, mucTieuTuan, bmr }) {
  assert(typeof tdee === "number" && tdee > 0, "TDEE không hợp lệ để tính calorieTarget");

  const adj = tinhDieuChinhKcalTheoTuan(mucTieuTuan);
  let raw;
  switch (mucTieu) {
    case "giam_can":
    case "giam_mo":
      raw = tdee - adj;
      break;
    case "tang_can":
    case "tang_co":
      raw = tdee + adj;
      break;
    case "duy_tri":
    default:
      raw = tdee;
      break;
  }

  let minSafe = 800;
  if (typeof bmr === "number" && bmr > 0) {
    minSafe = Math.max(minSafe, Math.round(bmr * 0.8));
  }
  const target = clamp(Math.round(raw), minSafe, 8000);
  return target;
}

export function tinhMacroGram({ calorieTarget, macroProtein = 20, macroCarb = 50, macroFat = 30 }) {
  assert(typeof calorieTarget === "number" && calorieTarget > 0, "calorieTarget không hợp lệ");
  const totalPct = (macroProtein || 0) + (macroCarb || 0) + (macroFat || 0);
  assert(totalPct > 0, "Tổng % macro phải > 0");

  const k = 100 / totalPct;
  const pPct = macroProtein * k, cPct = macroCarb * k, fPct = macroFat * k;

  const pGram = Math.round((calorieTarget * (pPct / 100)) / 4);
  const cGram = Math.round((calorieTarget * (cPct / 100)) / 4);
  const fGram = Math.round((calorieTarget * (fPct / 100)) / 9);

  return { proteinGram: pGram, carbGram: cGram, fatGram: fGram };
}

export function tinhMacroMucTieu({ mucTieu = "duy_tri", canNangKg, calorieTarget, tdee }) {
  assert(typeof canNangKg === "number" && canNangKg >= MIN_WEIGHT_KG && canNangKg <= MAX_WEIGHT_KG, "Cân nặng ngoài phạm vi hợp lệ");
  let cal = Number.isFinite(calorieTarget) && calorieTarget > 0
    ? Math.round(calorieTarget)
    : (Number.isFinite(tdee) && tdee > 0 ? Math.round(tdee) : 2000);

  let pPerKg, fPerKg;
  switch (mucTieu) {
    case "giam_can":
    case "giam_mo":
      pPerKg = 2.4; fPerKg = 0.8;
      break;
    case "tang_can":
    case "tang_co":
      pPerKg = 2.2; fPerKg = 1.0;
      break;
    case "duy_tri":
    default:
      pPerKg = 2.0; fPerKg = 0.8;
      break;
  }

  const proteinG = Math.max(0, Math.round(canNangKg * pPerKg));
  const fatG     = Math.max(0, Math.round(canNangKg * fPerKg));

  const kcalFromProtein = proteinG * 4;
  const kcalFromFat     = fatG * 9;
  const kcalLeft        = Math.max(0, cal - (kcalFromProtein + kcalFromFat));
  const carbG           = Math.max(0, Math.round(kcalLeft / 4));

  const saltG  = 5;
  const sugarG = Math.round((cal * 0.10) / 4);
  const fiberG = Math.round(14 * (cal / 1000));

  const macroProtein = Math.round((kcalFromProtein / cal) * 100);
  const macroFat     = Math.round((kcalFromFat     / cal) * 100);
  const macroCarb    = Math.max(0, 100 - macroProtein - macroFat);

  return {
    kcal: cal,
    proteinG, fatG, carbG,
    saltG, sugarG, fiberG,
    macroProtein, macroCarb, macroFat,
  };
}

export function tinhMacroMucTieuTuProfile(profile = {}) {
  const {
    goal: mucTieu = "duy_tri",
    weightKg: canNangKg,
    calorieTarget,
    tdee,
  } = profile || {};

  return tinhMacroMucTieu({ mucTieu, canNangKg, calorieTarget, tdee });
}

/* ==================== Check: TÍNH CALORIE CHO WORKOUT ==================== */

/** Tổng reps của 1 mảng set */
export function sumRepsFromSets(sets = []) {
  return (Array.isArray(sets) ? sets : []).reduce((s, st) => s + (Number(st?.reps || 0) || 0), 0);
}

/**
 * Thời gian 1 block (phút)
 * Công thức: ((Tổng reps * 3s) + (max(sets-1,0) * 60s)) / 60
  Thời gian tập = (Tổng số rep x 3 giây)
  Thời gian nghỉ = (Số hiệp - 1) x 60 giây
  Tổng thời gian (phút) = (Thời gian tập + Thời gian nghỉ) / 60
 */
export function blockMinutesFromSets(sets = []) {
  const reps = sumRepsFromSets(sets);
  const nSets = Array.isArray(sets) ? sets.length : 0;
  const workSec = reps * 3;
  const restSec = Math.max(0, nSets - 1) * 60;
  return (workSec + restSec) / 60;
}

/*** Cong thuc tuong doi --------------------------------------------
 * Kcal theo MET (caloriePerRep ~ MET):
 * (MET * 3.5 * weightKg (user) * minutes) / 200
  Calo Đốt Cháy = (MET × 3.5 × Cân nặng (user-kg) × Thời gian (phút)) / 200
 */
export function kcalByMETMinutes(met = 0, weightKg = 0, minutes = 0) {
  const m = Math.max(0, Number(met || 0));
  const w = Number(weightKg || 0);
  const t = Math.max(0, Number(minutes || 0));
  if (!w) return 0;
  return (m * 3.5 * w * t) / 200;
}





/**
 * items[] cần có { caloriePerRep, sets[] }
 * weightKg: cân nặng hiện tại (kg)
 */
export function calcPlanKcalByMET(items = [], weightKg = 70) {
  let total = 0;
  for (const it of (items || [])) {
    const minutes = blockMinutesFromSets(it?.sets || []);
    const met = Number(it?.caloriePerRep || 0);
    total += kcalByMETMinutes(met, weightKg, minutes);
  }
  return Math.round(total);
}
