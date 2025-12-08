import express from "express";
import { adminAuth } from "../middleware/adminAuth.js";
import {
  listContactMessages,
  getContactMessage,
  updateContactMessage,
  deleteContactMessage,
} from "../controllers/admin.contact.controller.js";

const router = express.Router();

// Bắt buộc admin login
router.use(adminAuth);

router.get("/contact-messages", listContactMessages);
router.get("/contact-messages/:id", getContactMessage);
router.patch("/contact-messages/:id", updateContactMessage);
router.delete("/contact-messages/:id", deleteContactMessage);

export default router;
