import { Router } from "express";
import { auth } from "../middleware/auth.js";
import rateLimit from "../middleware/rateLimit.js";
import { uploadAiImageSingle } from "../middleware/upload.js";
import { listAiMessages, uploadAiImage, sendAiChat, clearAiMessages, getAiQuota } from "../controllers/ai.controller.js";

const r = Router();

r.use(auth);
r.use(rateLimit({ windowMs: 30 * 1000, max: 30 }));

r.get("/messages", listAiMessages);
r.post("/images", uploadAiImageSingle, uploadAiImage);
r.post("/chat", sendAiChat);
r.delete("/messages", clearAiMessages);
r.get("/quota", getAiQuota);


export default r;
