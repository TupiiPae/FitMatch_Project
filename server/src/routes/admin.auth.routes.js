import { Router } from "express";
import { adminLogin } from "../controllers/admin.auth.controller.js";
import rl from "../middleware/rateLimit.js";

const router = Router();

router.post("/login", rl({ windowMs: 15*60*1000, max: 50 }), adminLogin);

export default router;
