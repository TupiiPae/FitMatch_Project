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

export const KCAL_PER_KG = 7700; // 1 kg mỡ ~ 7700 kcal

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

export function tinhDieuChinhKcalTheoTuan(mucTieuTuanKg) {
  const w = Number(mucTieuTuanKg || 0);
  if (!Number.isFinite(w) || w === 0) return 0;
  const perDay = (KCAL_PER_KG * Math.abs(w)) / 7; // kcal/ngày
  return Math.round(perDay);
}

export function tinhCalorieTarget({ tdee, mucTieu, mucTieuTuan, bmr }) {
  assert(typeof tdee === "number" && tdee > 0, "TDEE không hợp lệ để tính calorieTarget");
  const adj = tinhDieuChinhKcalTheoTuan(mucTieuTuan);
  let raw;
  switch (mucTieu) {
    case "giam_can":
    case "giam_mo":
      raw = tdee - adj; break;
    case "tang_can":
    case "tang_co":
      raw = tdee + adj; break;
    case "duy_tri":
    default:
      raw = tdee; break;
  }
  let minSafe = 800;
  if (typeof bmr === "number" && bmr > 0) minSafe = Math.max(minSafe, Math.round(bmr * 0.8));
  return clamp(Math.round(raw), minSafe, 8000);
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
    case "giam_mo": pPerKg = 2.4; fPerKg = 0.8; break;
    case "tang_can":
    case "tang_co": pPerKg = 2.2; fPerKg = 1.0; break;
    case "duy_tri":
    default:        pPerKg = 2.0; fPerKg = 0.8; break;
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

  return { kcal: cal, proteinG, fatG, carbG, saltG, sugarG, fiberG, macroProtein, macroCarb, macroFat };
}

export function tinhMacroMucTieuTuProfile(profile = {}) {
  const { goal: mucTieu = "duy_tri", weightKg: canNangKg, calorieTarget, tdee } = profile || {};
  return tinhMacroMucTieu({ mucTieu, canNangKg, calorieTarget, tdee });
}

/* ================================================================
 *       TÍNH CALO CHO BÀI TẬP (Strength | Cardio | Sport)
 *  Công thức chung:
 *    Calories = ( MET(caloriePerRep) × 3.5 × cân_nặng(kg) × thời_gian(phút) ) / 200
 *  Trong đó, thời_gian(phút) cho từng bài:
 *    thời_gian = (thời_gian_tập + thời_gian_nghỉ) / 60
 *    - thời_gian_tập   = tổng_reps * 3 (giây)
 *    - thời_gian_nghỉ  = (số_set - 1) * 60 (giây)
 *  Lưu ý: áp dụng giống nhau cho Strength, Cardio, Sport.
 * ================================================================ */

/** Tổng reps của 1 block (một bài), từ mảng sets */
function _sumReps(sets) {
  if (!Array.isArray(sets)) return 0;
  return sets.reduce((s, st) => s + (Number(st?.reps || 0) || 0), 0);
}

/** Tính thời gian (giây) cho 1 block: {workSec, restSec, totalSec} */
export function tinhThoiGianBlock_Giay(block) {
  const setsCount = Array.isArray(block?.sets) ? block.sets.length : 0;
  const repsTotal = _sumReps(block?.sets);
  const workSec = repsTotal * 3;                       // 3 giây / rep
  const restSec = Math.max(0, setsCount - 1) * 60;     // 60 giây giữa các set
  return { workSec, restSec, totalSec: workSec + restSec, setsCount, repsTotal };
}

/** Đổi sang phút cho 1 block */
export function tinhThoiGianBlock_Phut(block) {
  const { totalSec } = tinhThoiGianBlock_Giay(block);
  return totalSec / 60;
}

/** MET × 3.5 × kg × phút / 200 */
export function tinhKcalTheoMET(caloriePerRep, canNangKg, minutes) {
  const m = Math.max(0, Number(caloriePerRep || 0));
  const w = Number(canNangKg || 0);
  const t = Math.max(0, Number(minutes || 0));
  assert(w >= MIN_WEIGHT_KG && w <= MAX_WEIGHT_KG, "Cân nặng ngoài phạm vi hợp lệ");
  return (m * 3.5 * w * t) / 200;
}

/**
 * Tính tổng kcal của cả lịch tập theo công thức thời gian.
 * items: [{ exercise:{ caloriePerRep, type }, sets:[{reps,restSec?}, ...] }, ...]
 * canNangKg: cân nặng hiện tại của user
 */
export function tinhTongKcalLichTap_TheoThoiGian({ items = [], canNangKg }) {
  assert(Array.isArray(items), "items phải là mảng");
  assert(typeof canNangKg === "number", "Thiếu canNangKg");

  let totalKcal = 0;
  let totalMinutes = 0;
  let totalReps = 0;
  let totalSets = 0;

  for (const it of items) {
    const cpr = Number(it?.exercise?.caloriePerRep ?? it?.exCaloriePerRep ?? 0) || 0;

    const tgBlockMin = tinhThoiGianBlock_Phut(it);
    const kcalBlock  = tinhKcalTheoMET(cpr, canNangKg, tgBlockMin);

    const { repsTotal, setsCount } = (() => {
      const { repsTotal, setsCount } = tinhThoiGianBlock_Giay(it);
      return { repsTotal, setsCount };
    })();

    totalMinutes += tgBlockMin;
    totalKcal    += kcalBlock;
    totalReps    += repsTotal;
    totalSets    += setsCount;
  }

  return {
    totalMinutes: Number(totalMinutes.toFixed(2)),
    totalReps,
    totalSets,
    totalKcal: Math.round(totalKcal), // làm tròn để hiển thị
  };
}

// ====== (Tuỳ chọn) Giữ lại tên cũ nhưng CHUYỂN sang gọi theo thời gian ======
// export function tinhTongKcalLichTap(params) {
//   return tinhTongKcalLichTap_TheoThoiGian(params);
// }
