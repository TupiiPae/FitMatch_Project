// server/src/routes/admin.premium.routes.js
import express from "express";
import { auth } from "../middleware/auth.js";
import { requireAtLeast } from "../middleware/requireRole.js";
import {
  adminListPremiumUsers,
  adminListPremiumTransactions,
  adminRevokePremium,

  adminListPremiumPlans,
  adminCreatePremiumPlan,
  adminUpdatePremiumPlan,
  adminDeletePremiumPlan,
} from "../controllers/admin.premium.controller.js";

const router = express.Router();

// Users premium
router.get("/premium/users", auth, requireAtLeast("admin_lv2"), adminListPremiumUsers);
router.get("/premium/users/:id/transactions", auth, requireAtLeast("admin_lv2"), adminListPremiumTransactions);
router.post("/premium/users/:id/revoke", auth, requireAtLeast("admin_lv2"), adminRevokePremium);

// Plans config (tất cả admin)
router.get("/premium/plans", auth, requireAtLeast("admin_lv2"), adminListPremiumPlans);
router.post("/premium/plans", auth, requireAtLeast("admin_lv2"), adminCreatePremiumPlan);
router.patch("/premium/plans/:id", auth, requireAtLeast("admin_lv2"), adminUpdatePremiumPlan);
router.delete("/premium/plans/:id", auth, requireAtLeast("admin_lv2"), adminDeletePremiumPlan);

export default router;
