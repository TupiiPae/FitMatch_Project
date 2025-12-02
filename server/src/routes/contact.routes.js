import express from "express";
import { createContactMessage } from "../controllers/contact.controller.js";

const router = express.Router();

// POST /api/contact-messages
router.post("/contact-messages", createContactMessage);

export default router;
