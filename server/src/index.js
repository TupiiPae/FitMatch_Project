import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './db.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import userRoutes from './routes/user.routes.js';

const app = express();
app.use(express.json());
app.use(cors({
  origin: [process.env.CLIENT_USER_ORIGIN, process.env.CLIENT_ADMIN_ORIGIN],
  credentials: true
}));

app.get('/', (_, res) => res.send('FitMatch API v1'));
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);

const PORT = process.env.PORT || 5000;

connectDB(process.env.mongo || process.env.MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`🚀 API on http://localhost:${PORT}`)))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
