// server/src/utils/health.js

// ====== Hằng số & util chung ======
const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MIN_HEIGHT_CM = 100;
const MAX_HEIGHT_CM = 220;
const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 300;
const MIN_AGE = 5;    // giới hạn hợp lý cho app fitness
const MAX_AGE = 120;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseDob(ngaySinh) {
  assert(typeof ngaySinh === "string" && DOB_REGEX.test(ngaySinh), "Ngày sinh phải theo định dạng YYYY-MM-DD");
  const [y, m, d] = ngaySinh.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  // Kiểm tra hợp lệ (ví dụ 2024-02-30 là invalid)
  assert(date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d, "Ngày sinh không hợp lệ");
  // Không cho phép ngày sinh trong tương lai
  const today = new Date();
  assert(date <= today, "Ngày sinh không được ở tương lai");
  return date;
}

// ====== Tính tuổi chính xác theo ngày ======
export function tinhTuoi(ngaySinh) {
  const birth = parseDob(ngaySinh);
  const today = new Date();

  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

  assert(age >= MIN_AGE && age <= MAX_AGE, "Tuổi ngoài phạm vi hợp lệ");
  return age;
}

// ====== BMI (kg/m^2), làm tròn 2 chữ số ======
export function tinhBmi(canNangKg, chieuCaoCm) {
  assert(typeof canNangKg === "number" && !Number.isNaN(canNangKg), "Cân nặng không hợp lệ");
  assert(typeof chieuCaoCm === "number" && !Number.isNaN(chieuCaoCm), "Chiều cao không hợp lệ");
  assert(canNangKg >= MIN_WEIGHT_KG && canNangKg <= MAX_WEIGHT_KG, "Cân nặng ngoài phạm vi hợp lệ");
  assert(chieuCaoCm >= MIN_HEIGHT_CM && chieuCaoCm <= MAX_HEIGHT_CM, "Chiều cao ngoài phạm vi hợp lệ");

  const m = chieuCaoCm / 100;
  assert(m > 0, "Chiều cao phải lớn hơn 0");

  const bmi = canNangKg / (m * m);
  return Number(bmi.toFixed(2));
}

// ====== BMR (Mifflin–St Jeor), làm tròn số nguyên ======
export function tinhBmr({ gioiTinh, canNangKg, chieuCaoCm, ngaySinh }) {
  assert(gioiTinh === "male" || gioiTinh === "female", "Giới tính phải là 'male' hoặc 'female'");
  const age = tinhTuoi(ngaySinh);

  assert(typeof canNangKg === "number" && canNangKg >= MIN_WEIGHT_KG && canNangKg <= MAX_WEIGHT_KG, "Cân nặng ngoài phạm vi hợp lệ");
  assert(typeof chieuCaoCm === "number" && chieuCaoCm >= MIN_HEIGHT_CM && chieuCaoCm <= MAX_HEIGHT_CM, "Chiều cao ngoài phạm vi hợp lệ");

  const base = 10 * canNangKg + 6.25 * chieuCaoCm - 5 * age + (gioiTinh === "male" ? 5 : -161);
  return Math.round(base);
}

// ====== TDEE (BMR * hệ số hoạt động) – khớp trainingIntensity level_1..4 ======
const ACTIVITY_FACTORS = {
  level_1: 1.2,   // ít vận động
  level_2: 1.375, // nhẹ: 1-3 buổi/tuần
  level_3: 1.55,  // vừa: 3-5 buổi/tuần
  level_4: 1.725, // nặng: 6-7 buổi/tuần
};

export function tinhTdee(bmr, trainingIntensity) {
  assert(typeof bmr === "number" && bmr > 0, "BMR không hợp lệ");
  const factor = ACTIVITY_FACTORS[trainingIntensity] ?? ACTIVITY_FACTORS.level_1;
  return Math.round(bmr * factor);
}

// (Tuỳ chọn) export hệ số để dùng ở chỗ khác (ví dụ hiển thị UI)
export const ACTIVITY_MAP = { ...ACTIVITY_FACTORS };
