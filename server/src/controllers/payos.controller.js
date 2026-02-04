// server/src/controllers/payos.controller.js
import PaymentTransaction from "../models/PaymentTransaction.js";
import { User } from "../models/User.js";
import {
  payosGet,
  payosPost,
  signCreatePaymentLink,
  signObjectAlphabetical,
} from "../utils/payos.js";

const uidFromReq = (req) => String(req?.userId || req?.user?._id || "");

// TODO: thay bảng giá của bạn
const PLANS = {
  premium_1m: { amount: 39000, months: 1, label: "Premium 1 tháng" },
  premium_3m: { amount: 99000, months: 3, label: "Premium 3 tháng" },
  premium_6m: { amount: 189000, months: 6, label: "Premium 6 tháng" },
  premium_12m: { amount: 349000, months: 12, label: "Premium 12 tháng" },
};

function addMonths(baseDate, months) {
  const d = new Date(baseDate);
  const m = Number(months) || 0;
  const day = d.getDate();
  d.setMonth(d.getMonth() + m);
  if (d.getDate() !== day) d.setDate(0); // fix overflow 31 + 1 month
  return d;
}

function genOrderCode() {
  // number, unique hơn Date.now()
  return Number(
    `${Date.now()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`
  );
}

export async function createPayosPaymentLink(req, res) {
  try {
    const uid = uidFromReq(req);
    if (!uid) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const { planCode } = req.body || {};
    const plan = PLANS[String(planCode || "")];
    if (!plan) return res.status(400).json({ ok: false, message: "Plan không hợp lệ" });

    const clientUrl = (process.env.CLIENT_USER_ORIGIN || "").replace(/\/+$/, "");
    if (!clientUrl) {
      return res.status(500).json({ ok: false, message: "Missing CLIENT_USER_ORIGIN" });
    }

    // tạo orderCode chống trùng
    let orderCode = genOrderCode();

    // description: nên ngắn (nhiều bank giới hạn)
    const description = `FM${String(orderCode).slice(-7)}`;

    const returnUrl = `${clientUrl}/payment/return?orderCode=${orderCode}`;
    const cancelUrl = `${clientUrl}/payment/cancel?orderCode=${orderCode}`;

    // signature theo docs
    const signature = signCreatePaymentLink({
      amount: plan.amount,
      cancelUrl,
      description,
      orderCode,
      returnUrl,
    });

    // Lưu PENDING trước (nếu hiếm khi trùng orderCode, thử lại 2 lần)
    let created = false;
    for (let i = 0; i < 3; i++) {
      try {
        await PaymentTransaction.create({
          user: uid,
          orderCode,
          amount: plan.amount,
          planCode: String(planCode),
          months: plan.months,
          status: "PENDING",
        });
        created = true;
        break;
      } catch (e) {
        // duplicate key -> tạo orderCode mới rồi thử lại
        if (String(e?.code) === "11000") {
          orderCode = genOrderCode();
          continue;
        }
        throw e;
      }
    }
    if (!created) {
      return res.status(500).json({ ok: false, message: "Không tạo được orderCode (duplicate)" });
    }

    const payload = {
      orderCode,
      amount: plan.amount,
      description,
      cancelUrl,
      returnUrl,
      items: [{ name: plan.label, quantity: 1, price: plan.amount }],
      signature,
    };

    // tạo link payos
    const rs = await payosPost("/v2/payment-requests", payload);
    const data = rs?.data || {};

    await PaymentTransaction.updateOne(
      { orderCode },
      {
        $set: {
          paymentLinkId: data.paymentLinkId,
          checkoutUrl: data.checkoutUrl,
          qrCode: data.qrCode,
        },
      }
    );

    return res.json({
      ok: true,
      orderCode,
      checkoutUrl: data.checkoutUrl,
      qrCode: data.qrCode,
    });
  } catch (e) {
    return res.status(e.status || 500).json({
      ok: false,
      message: e.message || "Create PayOS link failed",
      payload: e.payload,
    });
  }
}

export async function getPayosStatus(req, res) {
  try {
    const uid = uidFromReq(req);
    if (!uid) return res.status(401).json({ ok: false, message: "Unauthorized" });

    const orderCode = Number(req.params.orderCode);
    if (!Number.isFinite(orderCode)) {
      return res.status(400).json({ ok: false, message: "orderCode không hợp lệ" });
    }

    const tx = await PaymentTransaction.findOne({ orderCode, user: uid }).lean();
    if (!tx) return res.status(404).json({ ok: false, message: "Không tìm thấy giao dịch" });

    // optional: sync remote
    let remote = null;
    try {
      const r = await payosGet(`/v2/payment-requests/${orderCode}`);
      remote = r?.data || null;
    } catch (err) {
      // không fail cả API nếu remote lỗi
      remote = null;
    }

    return res.json({ ok: true, local: tx, remote });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || "Get status failed" });
  }
}

// Webhook PayOS gọi về server bạn (KHÔNG auth) -> verify signature
export async function payosWebhook(req, res) {
  try {
    const body = req.body || {};
    const signature = String(body.signature || "");
    const data = body.data || {};

    // verify signature dựa trên data
    const expected = signObjectAlphabetical(data);
    if (!signature || signature !== expected) {
      return res.status(400).json({ ok: false, message: "Invalid signature" });
    }

    const orderCode = Number(data.orderCode);
    const amount = Number(data.amount);

    if (!Number.isFinite(orderCode) || !Number.isFinite(amount)) {
      return res.status(400).json({ ok: false, message: "Invalid webhook data" });
    }

    const tx = await PaymentTransaction.findOne({ orderCode });
    if (!tx) return res.status(200).json({ ok: true }); // tránh PayOS retry spam

    // lưu webhookData để audit
    // chống giả mạo: check amount khớp
    if (Number(tx.amount) !== amount) {
      await PaymentTransaction.updateOne(
        { orderCode },
        { $set: { webhookData: body } }
      );
      return res.status(400).json({ ok: false, message: "Amount mismatch" });
    }

    // success: theo bạn đang dùng logic (code "00" + success true)
    const isOk =
      body.success === true &&
      String(data.code || body.code || "") === "00";

    if (!isOk) {
      await PaymentTransaction.updateOne(
        { orderCode },
        { $set: { status: "CANCELLED", webhookData: body } }
      );
      return res.status(200).json({ ok: true });
    }

    // idempotent
    if (tx.status === "PAID") {
      await PaymentTransaction.updateOne(
        { orderCode },
        { $set: { webhookData: body } }
      );
      return res.status(200).json({ ok: true });
    }

    // nâng premium đúng theo schema user.premium
    const user = await User.findById(tx.user).select("premium").catch(() => null);
    if (user) {
      const now = new Date();
      const curExp = user?.premium?.expiresAt ? new Date(user.premium.expiresAt) : null;
      const base = curExp && curExp.getTime() > now.getTime() ? curExp : now;
      const nextExp = addMonths(base, tx.months);

      user.premium = {
        tier: "premium",
        months: tx.months,
        startedAt: user?.premium?.startedAt || now,
        expiresAt: nextExp,
        provider: "payos",
      };

      await user.save();
    }

    await PaymentTransaction.updateOne(
      { orderCode },
      {
        $set: {
          status: "PAID",
          paidAt: new Date(),
          webhookData: body,
        },
      }
    );

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e.message || "Webhook failed" });
  }
}

// (Optional) confirm-webhook để PayOS test URL webhook và lưu vào kênh thanh toán
export async function confirmWebhook(req, res) {
  try {
    const { webhookUrl } = req.body || {};
    if (!webhookUrl) return res.status(400).json({ ok: false, message: "Missing webhookUrl" });

    const rs = await payosPost("/confirm-webhook", { webhookUrl });
    return res.json({ ok: true, data: rs?.data || null });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, message: e.message || "Confirm webhook failed" });
  }
}
