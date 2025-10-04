import { Router } from 'express';
import { auth } from '../middleware/auth.js';

const router = Router();

router.get('/me', auth, async (req, res) => {
  res.json({ profile: { id: req.user.id } });
});

export default router;
