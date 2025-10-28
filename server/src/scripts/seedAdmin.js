// server/src/scripts/seedAdmin.js
import "dotenv/config";
import mongoose from "mongoose";
import { Admin } from "../models/Admin.js";

const MONGO = process.env.MONGO || process.env.MONGO_URI;

// XÓA TẤT CẢ ADMIN CŨ rồi tạo lại 3 tài khoản mới như yêu cầu
async function recreateAllAdmins() {
  console.log("🧹 Xoá toàn bộ admin cũ...");
  const del = await Admin.deleteMany({});
  console.log(`   Đã xoá ${del.deletedCount} admin.`);

  const toCreate = [
    // Cấp 1 (duy nhất)
    { username: "FitmatchRoot", nickname: "Admin",      password: "fitmatch@admin1", level: 1, status: "active" },

    // Cấp 2
    { username: "Tupii",         nickname: "Tupii",      password: "fitmatch@admin2", level: 2, status: "active" },
    { username: "NhatThien",     nickname: "Nhật Thiên", password: "fitmatch@admin2", level: 2, status: "active" },
  ];

  for (const a of toCreate) {
    await Admin.create(a);
    console.log(`🎯 Seeded admin lv${a.level}: ${a.username} (${a.nickname})`);
  }

  // Kiểm tra ràng buộc duy nhất level=1
  const lv1Count = await Admin.countDocuments({ level: 1 });
  if (lv1Count !== 1) {
    throw new Error(`Phải có đúng 1 admin level=1, hiện có: ${lv1Count}`);
  }
}

async function run() {
  try {
    if (!MONGO) throw new Error("Thiếu biến môi trường MONGO hoặc MONGO_URI");
    await mongoose.connect(MONGO);
    console.log("✅ MongoDB connected");

    await recreateAllAdmins();
  } catch (e) {
    console.error("❌ Seed error:", e?.message || e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected");
  }
}

run();
