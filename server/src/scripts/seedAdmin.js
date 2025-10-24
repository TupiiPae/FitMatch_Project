// server/src/scripts/seedAdmin.js
import "dotenv/config";
import mongoose from "mongoose";
import { Admin } from "../models/Admin.js";

const MONGO = process.env.MONGO || process.env.MONGO_URI;

async function ensureAdmin({ username, password, level = 2, status = "active" }) {
  const existed = await Admin.findOne({ username }).select("_id").lean();
  if (existed) {
    console.log(`✔ Admin '${username}' đã tồn tại`);
    return;
  }
  await Admin.create({ username, password, level, status });
  console.log(`🎯 Seeded admin lv${level}: ${username}`);
}

async function run() {
  try {
    if (!MONGO) throw new Error("Thiếu biến môi trường MONGO hoặc MONGO_URI");
    await mongoose.connect(MONGO);
    console.log("✅ MongoDB connected");

    // Cấp 1 (duy nhất)
    await ensureAdmin({
      username: "admin_lv1",
      password: "123456",
      level: 1,
    });

    // Cấp 2
    await ensureAdmin({
      username: "admin_lv2",
      password: "123456",
      level: 2,
    });

  } catch (e) {
    console.error("❌ Seed error:", e?.message || e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected");
  }
}

run();
