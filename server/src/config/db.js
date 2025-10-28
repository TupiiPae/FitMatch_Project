// server/src/config/db.js
import mongoose from "mongoose";

export const connectDB = async (uri) => {
  try {
    const connectUri = uri || process.env.MONGO_URI;
    if (!connectUri) throw new Error("❌ Thiếu MONGO_URI trong .env");

    mongoose.set("strictQuery", true);
    await mongoose.connect(connectUri);

    console.log("✅ MongoDB đã kết nối thành công!");
  } catch (err) {
    console.error("❌ Lỗi kết nối MongoDB:", err.message);
    process.exit(1);
  }
};
