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
