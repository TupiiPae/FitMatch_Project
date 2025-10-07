export function tinhBmi(canNangKg, chieuCaoCm) {
  const m = chieuCaoCm / 100;
  return Number((canNangKg / (m * m)).toFixed(2));
}

export function tinhTuoi(ngaySinh) {
  const [y, m, d] = ngaySinh.split("-").map(Number);
  const today = new Date();
  const birth = new Date(y, m - 1, d);
  let age = today.getFullYear() - birth.getFullYear();
  const md = today.getMonth() - birth.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function tinhBmr({ gioiTinh, canNangKg, chieuCaoCm, ngaySinh }) {
  const age = tinhTuoi(ngaySinh);
  const base = 10 * canNangKg + 6.25 * chieuCaoCm - 5 * age + (gioiTinh === "male" ? 5 : -161);
  return Math.round(base);
}
