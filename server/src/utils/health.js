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

// 1 kg mỡ ~ 7700 kcal
export const KCAL_PER_KG = 7700;

// Chuẩn hoá & ràng buộc giá trị
function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

/**
 * Tính mức điều chỉnh kcal mỗi ngày dựa trên mục tiêu thay đổi cân nặng theo tuần.
 * ví dụ mục tiêu -0.5 kg/tuần => daily_adjust ~ -550 kcal/ngày
 */
export function tinhDieuChinhKcalTheoTuan(mucTieuTuanKg) {
  const w = Number(mucTieuTuanKg || 0);
  if (!Number.isFinite(w) || w === 0) return 0;
  const perDay = (KCAL_PER_KG * Math.abs(w)) / 7; // kcal/ngày
  // Trả ra giá trị dương (để cộng/trừ theo mục tiêu cụ thể)
  return Math.round(perDay);
}

/**
 * Tính Calorie Target (mức calo nạp vào mỗi ngày) từ TDEE + mục tiêu.
 * - mucTieu: "giam_can" | "duy_tri" | "tang_can" | "giam_mo" | "tang_co"
 * - mucTieuTuan: kg/tuần (dấu của hướng thay đổi do mucTieu quyết định)
 * - bmr: tuỳ chọn, để không cho target thấp quá bmr*0.8 (có thể chỉnh)
 * - trả về số nguyên (kcal/ngày), luôn trong [800..8000]
 */
export function tinhCalorieTarget({ tdee, mucTieu, mucTieuTuan, bmr }) {
  // Kiểm tra đầu vào
  assert(typeof tdee === "number" && tdee > 0, "TDEE không hợp lệ để tính calorieTarget");

  const adj = tinhDieuChinhKcalTheoTuan(mucTieuTuan);
  let raw;
  switch (mucTieu) {
    case "giam_can":
    case "giam_mo":
      raw = tdee - adj; // deficit
      break;
    case "tang_can":
    case "tang_co":
      raw = tdee + adj; // surplus
      break;
    case "duy_tri":
    default:
      raw = tdee;
      break;
  }

  // Giới hạn an toàn
  let minSafe = 800;
  if (typeof bmr === "number" && bmr > 0) {
    // không để thấp hơn ~80% BMR (tuỳ chỉnh nếu cần)
    minSafe = Math.max(minSafe, Math.round(bmr * 0.8));
  }
  const target = clamp(Math.round(raw), minSafe, 8000);
  return target;
}

/**
 * Từ calorieTarget và % macro → quy đổi ra gram.
 * - macroProtein/macroCarb/macroFat là % (tổng 100)
 * - 1g: protein=4kcal, carb=4kcal, fat=9kcal
 */
export function tinhMacroGram({ calorieTarget, macroProtein = 20, macroCarb = 50, macroFat = 30 }) {
  assert(typeof calorieTarget === "number" && calorieTarget > 0, "calorieTarget không hợp lệ");
  const totalPct = (macroProtein || 0) + (macroCarb || 0) + (macroFat || 0);
  assert(totalPct > 0, "Tổng % macro phải > 0");

  // Chuẩn hoá về tổng 100
  const k = 100 / totalPct;
  const pPct = macroProtein * k, cPct = macroCarb * k, fPct = macroFat * k;

  const pGram = Math.round((calorieTarget * (pPct / 100)) / 4);
  const cGram = Math.round((calorieTarget * (cPct / 100)) / 4);
  const fGram = Math.round((calorieTarget * (fPct / 100)) / 9);

  return { proteinGram: pGram, carbGram: cGram, fatGram: fGram };
}

