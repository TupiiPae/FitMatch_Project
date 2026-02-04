// server/src/routes/admin.premium.routes.js
import express from "express";
import { auth } from "../middleware/auth.js";
import { requireAtLeast } from "../middleware/requireRole.js"; // giống file routes bạn đang dùng
import {
  adminListPremiumUsers,
  adminListPremiumTransactions,
  adminRevokePremium,
} from "../controllers/admin.premium.controller.js";

const router = express.Router();

router.get("/premium/users", auth, requireAtLeast("admin_lv2"), adminListPremiumUsers);
router.get("/premium/users/:id/transactions", auth, requireAtLeast("admin_lv2"), adminListPremiumTransactions);
router.post("/premium/users/:id/revoke", auth, requireAtLeast("admin_lv2"), adminRevokePremium);

export default router;
