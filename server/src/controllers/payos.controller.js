// server/src/controllers/payos.controller.js
import PaymentTransaction from "../models/PaymentTransaction.js";
import { User } from "../models/User.js";
import PremiumPlan from "../models/PremiumPlan.js";
import {
  payosGet,
  payosPost,
  signCreatePaymentLink,
  signObjectAlphabetical,
} from "../utils/payos.js";

const uidFromReq = (req) => String(req?.userId || req?.user?._id || "");

const pick = (...v) => v.find((x) => x !== undefined && x !== null && x !== "");
const up = (v) => String(v || "").trim().toUpperCase();

function isRemotePaid(remote) {
  // PayOS response có thể khác nhau tuỳ endpoint/version => check “mềm”
  const st = up(pick(remote?.status, remote?.data?.status, remote?.paymentStatus, remote?.data?.paymentStatus));
  const code = up(pick(remote?.code, remote?.data?.code, remote?.data?.responseCode));
  if (st === "PAID" || st === "SUCCESS" || st === "COMPLETED") return true;
  if (code === "00") return true;

  const amount = Number(pick(remote?.amount, remote?.data?.amount));
  const amountPaid = Number(pick(remote?.amountPaid, remote?.data?.amountPaid, remote?.data?.paidAmount));
  if (Number.isFinite(amount) && Number.isFinite(amountPaid) && amountPaid >= amount && st && st !== "CANCELLED") return true;

  return false;
}

async function applyPremiumFromTx({ tx, provider = "payos", extraData = null }) {
  const user = await User.findById(tx.user).select("premium").catch(() => null);
  if (user) {
    const now = new Date();
    const curExp = user?.premium?.expiresAt ? new Date(user.premium.expiresAt) : null;
    const base = curExp && curExp.getTime() > now.getTime() ? curExp : now;
    const nextExp = addMonths(base, tx.months);

    user.premium = {
      tier: "premium",
      planCode: tx.planCode,          // ✅ lưu đúng gói đã mua
      months: Number(tx.months) || 0,
      startedAt: user?.premium?.startedAt || now,
      expiresAt: nextExp,
      provider,
    };

    await user.save();
  }

  // update transaction (idempotent)
  await PaymentTransaction.updateOne(
    { _id: tx._id, status: { $ne: "PAID" } },
    { $set: { status: "PAID", paidAt: new Date(), webhookData: extraData } }
  ).catch(() => {});

  return true;
}

/** tạo orderCode dạng 9 chữ số (an toàn cho nhiều cổng) + chống trùng bằng retry DB */
function genOrderCode9() {
  const tail6 = String(Date.now()).slice(-6); // 6 digits
  const r3 = String(Math.floor(Math.random() * 1000)).padStart(3, "0"); // 3 digits
  return Number(`${tail6}${r3}`); // 9 digits
}

function addMonths(baseDate, months) {
  const d = new Date(baseDate);
  const m = Number(months) || 0;
  const day = d.getDate();
  d.setMonth(d.getMonth() + m);
  if (d.getDate() !== day) d.setDate(0);
  return d;
}

async function ensurePlans() {
  await PremiumPlan.ensureDefaults().catch(() => {});
}

async function getActivePlanByCode(code) {
  const c = String(code || "").trim();
  if (!c) return null;
  return PremiumPlan.findOne({ code: c, isActive: true }).lean().catch(() => null);
}

export async function createPayosPaymentLink(req, res) {
  try {
    const uid = uidFromReq(req);
    if (!uid) return res.status(401).json({ ok: false, message: "Unauthorized" });

    await ensurePlans();

    const planCode = String(req.body?.planCode || "").trim();
    if (!planCode) return res.status(400).json({ ok: false, message: "Thiếu planCode" });

    const plan = await getActivePlanByCode(planCode);
    if (!plan) return res.status(400).json({ ok: false, message: "Gói không hợp lệ hoặc đã tắt" });

    const amount = Number(plan.price);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, message: "Giá gói không hợp lệ" });
    }

    const clientUrl = String(process.env.CLIENT_USER_ORIGIN || "").replace(/\/+$/, "");
    if (!clientUrl) {
      return res.status(500).json({
        ok: false,
        message: "Missing CLIENT_USER_ORIGIN ",
      });
    }

    // tạo orderCode chống trùng
    let orderCode = genOrderCode9();

    // description nên ngắn (PayOS khuyến nghị ngắn)
    const description = `FM${String(orderCode).padStart(9, "0").slice(-7)}`;

    const returnUrl = `${clientUrl}/payment/return?orderCode=${orderCode}`;
    const cancelUrl = `${clientUrl}/payment/cancel?orderCode=${orderCode}`;

    const signature = signCreatePaymentLink({
      amount,
      cancelUrl,
      description,
      orderCode,
      returnUrl,
    });

    // Lưu PENDING trước (retry nếu trùng orderCode)
    let created = false;
    for (let i = 0; i < 5; i++) {
      try {
        await PaymentTransaction.create({
          user: uid,
          orderCode,
          amount,
          planCode: String(plan.code),
          months: Number(plan.months),
          status: "PENDING",
        });
        created = true;
        break;
      } catch (e) {
        if (String(e?.code) === "11000") {
          orderCode = genOrderCode9();
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
      amount,
      description,
      cancelUrl,
      returnUrl,
      items: [{ name: plan.name || plan.code, quantity: 1, price: amount }],
      signature,
    };

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
      plan: { code: plan.code, months: plan.months, price: plan.price, currency: plan.currency },
    });
  } catch (e) {
    // Ưu tiên trả rõ status nếu utils/payos.js có attach
    const status = e?.status || e?.response?.status || 500;
    return res.status(status).json({
      ok: false,
      message: e?.message || "Create PayOS link failed",
      payload: e?.payload || e?.response?.data,
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

    let tx = await PaymentTransaction.findOne({ orderCode, user: uid }).lean();
    if (!tx) return res.status(404).json({ ok: false, message: "Không tìm thấy giao dịch" });

    let remote = null;
    try {
      const r = await payosGet(`/v2/payment-requests/${orderCode}`);
      remote = r?.data || null;
    } catch {
      remote = null;
    }

    // ✅ RECONCILE: remote đã PAID nhưng local chưa PAID => kích hoạt premium ngay
    if (remote && tx.status !== "PAID" && isRemotePaid(remote)) {
      // kiểm tra amount để an toàn
      const remoteAmount = Number(pick(remote?.amount, remote?.data?.amount));
      if (Number.isFinite(remoteAmount) && Number(tx.amount) !== remoteAmount) {
        await PaymentTransaction.updateOne({ orderCode }, { $set: { webhookData: { source: "status_poll", remote } } });
        return res.status(400).json({ ok: false, message: "Amount mismatch (reconcile)" });
      }

      await applyPremiumFromTx({
        tx,
        provider: "payos_status_poll",
        extraData: { source: "status_poll", remote },
      });

      // reload local tx after update
      tx = await PaymentTransaction.findOne({ orderCode, user: uid }).lean();
    }

    return res.json({ ok: true, local: tx, remote });
  } catch (e) {
    const status = e?.status || e?.response?.status || 500;
    return res.status(status).json({ ok: false, message: e?.message || "Get status failed" });
  }
}


// Webhook PayOS gọi về server (KHÔNG auth)
export async function payosWebhook(req, res) {
  try {
    const body = req.body || {};
    const signature = String(body.signature || "");
    const data = body.data || {};

    // Verify signature theo docs PayOS: signature = HMAC_SHA256(queryStrSorted, checksumKey)
    // Ở codebase bạn đang dùng signObjectAlphabetical(data) (nên đảm bảo utils/payos.js đã dùng checksumKey + HMAC)
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
    if (!tx) return res.status(200).json({ ok: true });

    if (Number(tx.amount) !== amount) {
      await PaymentTransaction.updateOne({ orderCode }, { $set: { webhookData: body } });
      return res.status(400).json({ ok: false, message: "Amount mismatch" });
    }

    const isOk = body.success === true && String(data.code || body.code || "") === "00";
    if (!isOk) {
      await PaymentTransaction.updateOne(
        { orderCode },
        { $set: { status: "CANCELLED", webhookData: body } }
      );
      return res.status(200).json({ ok: true });
    }

    if (tx.status === "PAID") {
      await PaymentTransaction.updateOne({ orderCode }, { $set: { webhookData: body } });
      return res.status(200).json({ ok: true });
    }

    const user = await User.findById(tx.user).select("premium").catch(() => null);
    if (user) {
      const now = new Date();
      const curExp = user?.premium?.expiresAt ? new Date(user.premium.expiresAt) : null;
      const base = curExp && curExp.getTime() > now.getTime() ? curExp : now;
      const nextExp = addMonths(base, tx.months);

      user.premium = {
        tier: "premium",
        planCode: tx.planCode,
        months: tx.months,
        startedAt: user?.premium?.startedAt || now,
        expiresAt: nextExp,
        provider: "payos",
      };

      await user.save();
    }

    await PaymentTransaction.updateOne(
      { orderCode },
      { $set: { status: "PAID", paidAt: new Date(), webhookData: body } }
    );

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, message: e?.message || "Webhook failed" });
  }
}

export async function confirmWebhook(req, res) {
  try {
    const { webhookUrl } = req.body || {};
    if (!webhookUrl) return res.status(400).json({ ok: false, message: "Missing webhookUrl" });

    const rs = await payosPost("/confirm-webhook", { webhookUrl });
    return res.json({ ok: true, data: rs?.data || null });
  } catch (e) {
    const status = e?.status || e?.response?.status || 500;
    return res.status(status).json({ ok: false, message: e?.message || "Confirm webhook failed" });
  }
}
