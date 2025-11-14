// src/lib/validators.js

/** ================== COMMON REGEX / HELPERS ================== */
const USERNAME_REGEX = /^[a-zA-Z0-9]{4,200}$/;              // chỉ chữ & số, 4..200
const EMAIL_GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i; // @gmail.com
const NAME_LETTERS_ONLY = /^[\p{L}\s]+$/u;                   // chỉ chữ & khoảng trắng

const isFiniteNum = (n) => Number.isFinite(n);
const inRange = (n, min, max) => isFiniteNum(n) && n >= min && n <= max;

/** ================== USER / AUTH ================== */
export function validateUsername(v) {
  const s = (v ?? "").trim();
  if (!s) return "Vui lòng nhập tên tài khoản";
  if (s.length < 4) return "Tên tài khoản tối thiểu 4 ký tự";
  if (s.length > 200) return "Tên tài khoản tối đa 200 ký tự";
  if (!USERNAME_REGEX.test(s)) return "Tên tài khoản chỉ gồm chữ và số";
  return "";
}

export function validateEmailGmail(v) {
  const s = (v ?? "").trim();
  if (!s) return "Vui lòng nhập email";
  if (s.length > 100) return "Email tối đa 100 ký tự";
  if (!EMAIL_GMAIL_REGEX.test(s)) return "Email phải có đuôi @gmail.com";
  return "";
}

export function validatePassword(v) {
  const s = String(v ?? "");
  if (!s) return "Vui lòng nhập mật khẩu";
  if (s.length < 6) return "Mật khẩu tối thiểu 6 ký tự";
  if (s.length > 200) return "Mật khẩu tối đa 200 ký tự";
  return "";
}

export function validateConfirm(pass, confirm) {
  if (!confirm) return "Vui lòng xác nhận mật khẩu";
  if (String(confirm) !== String(pass)) return "Mật khẩu xác nhận không khớp";
  return "";
}

/** ================== ACCOUNT (phone, nickname) ================== */
export function validatePhone(v) {
  const s = String(v ?? "").trim();
  if (!s) return ""; // không bắt buộc
  if (!/^\d+$/.test(s)) return "Số điện thoại chỉ gồm chữ số";
  if (s.length > 11) return "Số điện thoại tối đa 11 chữ số";
  if (s.startsWith("-") || Number(s) <= 0) return "Số điện thoại phải là số nguyên dương";
  return "";
}

export function validateNickname(v, { required = true } = {}) {
  const s = String(v ?? "");
  if (!s && !required) return "";
  if (!s) return "Vui lòng nhập biệt danh";
  if (s.length > 30) return "Biệt danh tối đa 30 ký tự";
  // Nickname user: cho phép ký tự đặc biệt; Admin: không cho → dùng option khác khi cần
  return "";
}

export function validateAdminNickname(v) {
  const s = String(v ?? "").trim();
  if (!s) return "Vui lòng nhập Nickname";
  if (s.length > 30) return "Nickname tối đa 30 ký tự";
  if (!/^[\p{L}\d\s]+$/u.test(s)) return "Nickname chỉ gồm chữ, số và khoảng trắng";
  return "";
}

/** ================== FOOD ================== */
export const foodValidators = {
  name(s) {
    const v = String(s || "").trim();
    if (!v) return "Tên món là bắt buộc";
    if (v.length > 50) return "Tên món tối đa 50 ký tự";
    if (!NAME_LETTERS_ONLY.test(v)) return "Tên món chỉ gồm chữ và khoảng trắng (không số, không ký tự đặc biệt)";
    return "";
  },
  massG(s) {
    const st = String(s ?? "").trim();
    if (st === "") return "Khối lượng là bắt buộc";
    const n = Number(st);
    if (!inRange(n, 0.0000001, 10000)) return "Khối lượng phải > 0 và ≤ 10000";
    return "";
  },
  kcal(s) {
    const st = String(s ?? "").trim();
    if (st === "") return "Năng lượng (cal) là bắt buộc";
    const n = Number(st);
    if (!inRange(n, 0, 10000)) return "Năng lượng phải ≥ 0 và ≤ 10000";
    return "";
  },
  optionalNumber(s) {
    const st = String(s ?? "").trim();
    if (st === "") return "";
    const n = Number(st);
    if (!inRange(n, 0, 10000)) return "Giá trị phải từ 0 đến 10000";
    return "";
  },
  validateAll(form) {
    const errs = {
      name: foodValidators.name(form?.name),
      massG: foodValidators.massG(form?.massG),
      kcal: foodValidators.kcal(form?.kcal),
      proteinG: foodValidators.optionalNumber(form?.proteinG),
      carbG: foodValidators.optionalNumber(form?.carbG),
      fatG: foodValidators.optionalNumber(form?.fatG),
      saltG: foodValidators.optionalNumber(form?.saltG),
      sugarG: foodValidators.optionalNumber(form?.sugarG),
      fiberG: foodValidators.optionalNumber(form?.fiberG),
      global: "",
    };
    return errs;
  },
};
