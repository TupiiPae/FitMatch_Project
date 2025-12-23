import express from "express";
import { auth } from "../middleware/auth.js";
import { getMessages, uploadChatImage } from "../controllers/chat.controller.js";
import { uploadChatImageSingle } from "../middleware/upload.js";

const r=express.Router();

r.get("/conversations/:id/messages",auth,getMessages);
r.post("/conversations/:id/images",auth,uploadChatImageSingle,uploadChatImage);

export default r;
