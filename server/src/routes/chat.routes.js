import express from "express";
import { auth } from "../middleware/auth.js";
import { getMessages } from "../controllers/chat.controller.js";

const r=express.Router();
r.get("/conversations/:id/messages",auth,getMessages);
export default r;
