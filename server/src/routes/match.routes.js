// server/src/routes/match.routes.js
import express from "express";
import { auth } from "../middleware/auth.js";
import { findNearbyUsers } from "../controllers/match.controller.js";
const r = express.Router();
r.get("/users/near", auth, findNearbyUsers);
export default r;
