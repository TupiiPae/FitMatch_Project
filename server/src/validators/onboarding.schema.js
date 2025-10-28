import { z } from "zod";

// ====== Giới hạn ======
export const LIMITS = {
  HEIGHT_CM: { MIN: 100, MAX: 220 },
  CURRENT_WEIGHT_KG: { MIN: 30, MAX: 200 }, // cập nhật
  TARGET_WEIGHT_KG: { MIN: 20, MAX: 300 },  // giữ nguyên
  AGE: { MIN: 5, MAX: 120 },
  WEEKLY_KG: { MIN: 0.1, MAX: 1.0 },        // cập nhật: dương 0.1..1
};

export const TRAINING_LEVELS = ["level_1", "level_2", "level_3", "level_4"];
export const GOALS = ["giam_can", "duy_tri", "tang_can", "giam_mo", "tang_co"];

const DOB_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const dobRefine = (dobStr) => {
  if (typeof dobStr !== "string" || !DOB_REGEX.test(dobStr)) return false;
  const [y, m, d] = dobStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const valid =
    date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  if (!valid) return false;

  const today = new Date();
  if (date > today) return false;

  let age = today.getFullYear() - date.getFullYear();
  const md = today.getMonth() - date.getMonth();
  if (md < 0 || (md === 0 && today.getDate() < date.getDate())) age--;
  return age >= LIMITS.AGE.MIN && age <= LIMITS.AGE.MAX;
};

export const OnboardingInputSchema = z
  .object({
    tenGoi: z.string().trim().min(1).max(30),
    mucTieu: z.enum(GOALS),

    chieuCao: z
      .coerce.number()
      .min(LIMITS.HEIGHT_CM.MIN)
      .max(LIMITS.HEIGHT_CM.MAX),

    // CÂN HIỆN TẠI: 30..200
    canNangHienTai: z
      .coerce.number()
      .min(LIMITS.CURRENT_WEIGHT_KG.MIN)
      .max(LIMITS.CURRENT_WEIGHT_KG.MAX),

    // CÂN MỤC TIÊU: 20..300 (giữ nguyên)
    canNangMongMuon: z
      .coerce.number()
      .min(LIMITS.TARGET_WEIGHT_KG.MIN)
      .max(LIMITS.TARGET_WEIGHT_KG.MAX),

    // TUẦN: 0.1..1.0 (dương)
    mucTieuTuan: z
      .coerce.number()
      .min(LIMITS.WEEKLY_KG.MIN)
      .max(LIMITS.WEEKLY_KG.MAX),

    cuongDoLuyenTap: z.enum(TRAINING_LEVELS),
    gioiTinh: z.enum(["male", "female"]),
    ngaySinh: z.string().refine(dobRefine, "Ngày sinh không hợp lệ hoặc tuổi ngoài phạm vi"),
  })
  .superRefine((data, ctx) => {
    const { mucTieu, canNangHienTai, canNangMongMuon, mucTieuTuan } = data;

    if (mucTieu === "giam_can" || mucTieu === "giam_mo") {
      if (!(canNangMongMuon < canNangHienTai)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Với mục tiêu giảm, cân nặng mục tiêu phải NHỎ HƠN hiện tại",
          path: ["canNangMongMuon"],
        });
      }
      // Không còn check dấu âm: mucTieuTuan là độ lớn dương 0.1..1
    }

    if (mucTieu === "tang_can" || mucTieu === "tang_co") {
      if (!(canNangMongMuon > canNangHienTai)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Với mục tiêu tăng, cân nặng mục tiêu phải LỚN HƠN hiện tại",
          path: ["canNangMongMuon"],
        });
      }
    }

    if (mucTieu === "duy_tri") {
      const diff = Math.abs(canNangMongMuon - canNangHienTai);
      if (diff > 0.5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Với mục tiêu duy trì, cân nặng mục tiêu nên gần cân hiện tại (±0.5kg)",
          path: ["canNangMongMuon"],
        });
      }
      if (mucTieuTuan > 0.2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Với mục tiêu duy trì, 'mucTieuTuan' nên ≤ 0.2kg/tuần",
          path: ["mucTieuTuan"],
        });
      }
    }
  });
