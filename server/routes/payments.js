import express from "express";
import Stripe from "stripe";
import pool from "../db.js";

const router = express.Router();
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;

// create payment intent
router.post("/create-intent", async (req, res) => {
  try {
    if (!stripe) {
      return res.status(501).json({ error: "Stripe is not configured" });
    }
    const { amount_cents } = req.body;
    const intent = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: "usd",
    });
    res.json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Payment failed" });
  }
});

// webhook (optional)
router.post("/stripe/webhook", express.raw({ type: "application/json" }), (req, res) => {
  // for now, just log event
  console.log("Webhook event:", req.body);
  res.json({ received: true });
});

// ===============================
// Settle Up (internal payments)
// ===============================

// Create a settlement: from_user pays to_user
router.post("/settle", async (req, res) => {
  /*
   * Creates a manual settlement between two users in a group. We accept both
   * legacy field names (from_user_id, to_user_id, amount) and the new
   * preferred names (from_user, to_user, amount_cents). Amounts provided
   * in dollars will be converted to cents for storage in settlements.
   */
  const groupId = req.body.group_id;
  const fromUser = req.body.from_user || req.body.from_user_id;
  const toUser = req.body.to_user || req.body.to_user_id;
  let amountDollars = null;
  // Prefer explicit dollars; fallback to cents
  if (req.body.amount != null) {
    amountDollars = Number(req.body.amount);
  } else if (req.body.amount_cents != null) {
    amountDollars = Number(req.body.amount_cents) / 100;
  }
  const note = req.body.note || null;
  if (!groupId || !fromUser || !toUser || !amountDollars) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (Number(amountDollars) <= 0) {
    return res.status(400).json({ error: "Amount must be > 0" });
  }
  if (Number(fromUser) === Number(toUser)) {
    return res.status(400).json({ error: "Payer and receiver must be different" });
  }
  const amountCents = Math.round(amountDollars * 100);
  try {
    // Insert settlement only. Status defaults to 'completed'.
    const ins = await pool.query(
      `INSERT INTO settlements (group_id, from_user, to_user, amount_cents, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, group_id, from_user, to_user, amount_cents, note, status, created_at`,
      [groupId, fromUser, toUser, amountCents, note]
    );
    const row = ins.rows[0];
    res.json({
      id: row.id,
      group_id: row.group_id,
      from_user: row.from_user,
      to_user: row.to_user,
      amount_cents: row.amount_cents,
      amount: (row.amount_cents / 100).toFixed(2),
      note: row.note,
      status: row.status,
      created_at: row.created_at
    });
  } catch (err) {
    console.error("❌ Settle error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// List settlements for a group
router.get("/settle/group/:groupId", async (req, res) => {
  const { groupId } = req.params;
  try {
    const result = await pool.query(
      `SELECT s.id, s.group_id, s.from_user, fu.name as from_name,
              s.to_user, tu.name as to_name,
              s.amount_cents, s.note, s.status, s.created_at
       FROM settlements s
       LEFT JOIN users fu ON fu.id = s.from_user
       LEFT JOIN users tu ON tu.id = s.to_user
       WHERE s.group_id = $1
       ORDER BY s.created_at DESC`,
      [groupId]
    );
    const rows = result.rows.map((r) => ({
      ...r,
      amount: (r.amount_cents / 100).toFixed(2)
    }));
    res.json(rows);
  } catch (err) {
    console.error("❌ Get settlements error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /payments/transactions/group/:groupId
 * Transaction history (Stripe + recorded settlements) for a group.
 */
router.get("/transactions/group/:groupId", async (req, res) => {
  const { groupId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.group_id, g.name AS group_name,
              s.from_user, fu.name AS from_name,
              s.to_user, tu.name AS to_name,
              s.amount_cents, s.status, s.note,
              s.stripe_payment_intent_id,
              s.created_at
       FROM settlements s
       JOIN groups g ON g.id = s.group_id
       LEFT JOIN users fu ON fu.id = s.from_user
       LEFT JOIN users tu ON tu.id = s.to_user
       WHERE s.group_id = $1
       ORDER BY s.created_at DESC`,
      [groupId]
    );
    const result = rows.map((r) => ({
      id: r.id,
      group_id: r.group_id,
      group_name: r.group_name,
      provider: r.stripe_payment_intent_id ? 'stripe' : 'manual',
      from_user: r.from_user,
      from_name: r.from_name,
      to_user: r.to_user,
      to_name: r.to_name,
      amount_cents: Number(r.amount_cents),
      amount: (Number(r.amount_cents) / 100).toFixed(2),
      status: r.status || 'completed',
      note: r.note || '',
      created_at: r.created_at
    }));
    res.json(result);
  } catch (err) {
    console.error("❌ Get transactions error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * Stripe webhook handler (called from server.js with raw body).
 * Records successful Stripe payments into transactions and settlements.
 */
export async function stripeWebhookHandler(req, res) {
  try {
    if (!stripe) {
      return res.status(501).json({ error: "Stripe is not configured" });
    }
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      return res.status(501).json({ error: "Stripe webhook secret is not configured" });
    }
    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;
      const md = pi.metadata || {};
      const groupId = md.group_id ? Number(md.group_id) : null;
      const fromUser = md.from_user || md.from_user_id ? Number(md.from_user || md.from_user_id) : null;
      const toUser = md.to_user || md.to_user_id ? Number(md.to_user || md.to_user_id) : null;
      const note = md.note || "Stripe payment";
      const amountDollars = (pi.amount_received ?? pi.amount ?? 0) / 100;
      const currency = (pi.currency || "usd").toLowerCase();
      // Record settlement so balances reflect the payment. Store amount in cents.
      if (groupId && fromUser && toUser && amountDollars > 0) {
        const amountCents = Math.round(amountDollars * 100);
        await pool.query(
          `INSERT INTO settlements (group_id, from_user, to_user, amount_cents, note, stripe_payment_intent_id, status)
           VALUES ($1,$2,$3,$4,$5,$6,'succeeded')
           ON CONFLICT (stripe_payment_intent_id) DO NOTHING`,
          [groupId, fromUser, toUser, amountCents, `Stripe: ${note}`, pi.id]
        );
      }
    }
    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object;
      // Mark settlement as failed
      await pool.query(
        `UPDATE settlements
         SET status = 'failed'
         WHERE stripe_payment_intent_id = $1`,
        [pi.id]
      );
    }
    res.json({ received: true });
  } catch (err) {
    console.error("❌ Webhook handler error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

export default router;