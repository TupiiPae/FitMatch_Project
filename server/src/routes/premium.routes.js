// server/src/routes/premium.routes.js
import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { getMyPremium, subscribePremium, cancelPremium } from "../controllers/premium.controller.js";

const r = Router();

r.use(auth);

r.get("/me", getMyPremium);
r.post("/subscribe", subscribePremium);
r.post("/cancel", cancelPremium);

export default r;
