import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const email = 'admin@fitmatch.io';
  const passwordHash = await bcrypt.hash('123456', 10);
  const exists = await User.findOne({ email });
  if (!exists) {
    await User.create({ email, passwordHash, name: 'Admin', role: 'admin' });
    console.log('Seeded admin');
  } else {
    console.log('Admin already exists');
  }
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
