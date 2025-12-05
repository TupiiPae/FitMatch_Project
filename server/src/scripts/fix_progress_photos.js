// Chạy: node server/scripts/fix_progress_photos.js
import mongoose from "mongoose";
import { User } from "./models/User.js";
import "dotenv/config.js";

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Đã kết nối MongoDB");

  const users = await User.find({
    "profile.progressPhotos": { $exists: true, $ne: [] }
  });

  console.log(`Found ${users.length} users with photos.`);

  for (const u of users) {
    let changed = false;

    for (const ph of u.profile.progressPhotos) {
      if (!ph._id) {
        ph._id = new mongoose.Types.ObjectId();
        changed = true;
      }
    }

    if (changed) {
      await u.save();
      console.log(`Updated user ${u._id}`);
    }
  }

  console.log("DONE.");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
