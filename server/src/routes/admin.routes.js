import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

router.get('/stats', auth, requireRole('admin'), async (req, res) => {
  res.json({ users: 0, scansToday: 0, mergesToday: 0 });
});

router.get('/users', auth, requireRole('admin'), async (req, res) => {
  res.json({ items: [] });
});

export default router;
