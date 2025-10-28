// ESM
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import Food from "../models/Food.js";

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("Missing MONGO_URI");
  await mongoose.connect(uri);

  const docs = [
    { name:"Ức gà áp chảo", massG:100, unit:"g", kcal:165, proteinG:31, fatG:3.6, carbG:0, sourceType:"cooked", status:"approved" },
    { name:"Cơm trắng", massG:100, unit:"g", kcal:130, proteinG:2.4, fatG:0.3, carbG:28, sourceType:"cooked", status:"approved" },
    { name:"Táo", massG:100, unit:"g", kcal:52, proteinG:0.3, fatG:0.2, carbG:14, fiberG:2.4, sugarG:10.4, sourceType:"fresh", status:"approved" },
    { name:"Sữa tươi không đường (Vinamilk)", massG:100, unit:"ml", kcal:66, proteinG:3.2, carbG:5, fatG:3.5, sugarG:5, saltG:0.12, sourceType:"packaged", status:"approved" }
  ];

  await Food.insertMany(docs);
  console.log("Seeded foods:", docs.length);
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
