// server/src/scripts/fixAdminIndexes.js
import "dotenv/config";
import mongoose from "mongoose";
import { Admin } from "../models/Admin.js";

const MONGO = process.env.MONGO || process.env.MONGO_URI;

async function run(){
  if (!MONGO) throw new Error("Thiếu MONGO hoặc MONGO_URI");
  await mongoose.connect(MONGO);
  console.log("Connected MongoDB");

  const before = await Admin.collection.indexes();
  console.log("Current indexes:", before);

  // Drop index email_1 nếu unique mà không sparse
  for (const idx of before) {
    if (idx.name === "email_1" && idx.unique && !idx.sparse) {
      console.log("🧹 Dropping problematic index:", idx.name);
      await Admin.collection.dropIndex(idx.name);
    }
  }

  // Tạo lại index theo schema
  await Admin.syncIndexes();
  console.log("Synced indexes");

  const after = await Admin.collection.indexes();
  console.log("New indexes:", after);

  await mongoose.disconnect();
  console.log("Disconnected");
}

run().catch(e => { console.error(e); process.exit(1); });
