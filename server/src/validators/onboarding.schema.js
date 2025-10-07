import { z } from "zod";

export const OnboardingInputSchema = z.object({
  tenGoi: z.string().trim().min(1).max(30),
  mucTieu: z.enum(["giam_can", "duy_tri", "tang_can", "giam_mo", "tang_co"]),
  chieuCao: z.number().min(100).max(220),
  canNangHienTai: z.number().min(20).max(300),
  canNangMongMuon: z.number().min(20).max(300),
  mucTieuTuan: z.number(), // cho phép âm/dương
  cuongDoLuyenTap: z.string().trim().min(1).max(20), // linh hoạt 4 mức bạn đang dùng
  gioiTinh: z.enum(["male", "female"]),
  ngaySinh: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
