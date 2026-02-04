import express from "express";
import { auth } from "../middleware/auth.js";
import {
  confirmWebhook,
  createPayosPaymentLink,
  getPayosStatus,
  payosWebhook,
} from "../controllers/payos.controller.js";

const router = express.Router();

// user tạo link thanh toán
router.post("/create-link", auth, createPayosPaymentLink);
router.get("/status/:orderCode", auth, getPayosStatus);

// webhook payOS gọi về (KHÔNG auth)
router.post("/webhook", payosWebhook);

// optional: confirm webhook url (nên bảo vệ bằng admin key hoặc chỉ dùng dev)
router.post("/confirm-webhook", confirmWebhook);

export default router;
