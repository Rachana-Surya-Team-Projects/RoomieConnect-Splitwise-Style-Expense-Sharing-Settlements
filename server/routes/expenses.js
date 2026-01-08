import express from "express";
import pool from "../db.js";

const router = express.Router();

/**
 * Utilities
 */
function toInt(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : NaN;
}

function dollarsToCents(amount) {
  // amount can be string/number dollars. Convert safely.
  const n = Number(amount);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

function splitEqual(amountCents, userIds) {
  const n = userIds.length;
  const base = Math.floor(amountCents / n);
  let rem = amountCents - base * n;
  return userIds.map((uid) => {
    const extra = rem > 0 ? 1 : 0;
    rem -= extra;
    return { user_id: uid, share_cents: base + extra };
  });
}

/**
 * GET expenses for a group (legacy route)
 */
router.get("/group/:groupId", async (req, res) => {
  const groupId = toInt(req.params.groupId);
  if (!Number.isFinite(groupId)) return res.status(400).json({ error: "Invalid groupId" });
  try {
    const { rows } = await pool.query(
      `
      SELECT e.id, e.group_id, e.description, e.amount_cents,
             e.paid_by, pu.name AS paid_by_name,
             e.created_by, cu.name AS created_by_name,
             e.created_at
      FROM expenses e
      LEFT JOIN users pu ON pu.id = e.paid_by
      LEFT JOIN users cu ON cu.id = e.created_by
      WHERE e.group_id = $1
      ORDER BY e.created_at DESC
      `,
      [groupId]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET expenses failed:", err);
    res.status(500).json({ error: "Failed to fetch expenses" });
  }
});

/**
 * GET splits for an expense
 */
router.get("/:expenseId/splits", async (req, res) => {
  const expenseId = toInt(req.params.expenseId);
  if (!Number.isFinite(expenseId)) return res.status(400).json({ error: "Invalid expenseId" });
  try {
    const { rows } = await pool.query(
      `
      SELECT s.id, s.expense_id, s.user_id, u.name AS user_name, s.share_cents
      FROM expense_splits s
      JOIN users u ON u.id = s.user_id
      WHERE s.expense_id = $1
      ORDER BY s.id ASC
      `,
      [expenseId]
    );
    res.json(rows);
  } catch (err) {
    console.error("GET splits failed:", err);
    res.status(500).json({ error: "Failed to fetch splits" });
  }
});

/**
 * POST create expense
 * Body:
 * {
 *  group_id, description,
 *  amount_cents OR amount (dollars),
 *  paid_by, created_by,
 *  participant_ids?: [user_id...]  (optional; defaults to all group members)
 *  splits?: [{user_id, share_cents}] (optional; if empty => equal split)
 * }
 */
router.post("/", async (req, res) => {
  const {
    group_id,
    description,
    amount_cents,
    amount,
    paid_by,
    created_by,
    participant_ids,
    splits,
  } = req.body || {};
  const groupId = toInt(group_id);
  const payerId = toInt(paid_by);
  const creatorId = toInt(created_by);
  const cents =
    Number.isFinite(toInt(amount_cents)) ? toInt(amount_cents) : dollarsToCents(amount);
  if (!Number.isFinite(groupId) || !description || !Number.isFinite(cents) || cents <= 0) {
    return res.status(400).json({ error: "Missing/invalid expense fields" });
  }
  try {
    // Decide participants
    let participants = Array.isArray(participant_ids) ? participant_ids.map(toInt).filter(Number.isFinite) : [];
    if (participants.length === 0) {
      const mem = await pool.query(`SELECT user_id FROM group_members WHERE group_id = $1 ORDER BY user_id ASC`, [groupId]);
      participants = mem.rows.map((r) => r.user_id);
    }
    if (participants.length === 0) return res.status(400).json({ error: "Group has no members to split with." });
    // Decide splits
    let finalSplits = [];
    if (Array.isArray(splits) && splits.length > 0) {
      finalSplits = splits
        .map((s) => ({ user_id: toInt(s.user_id), share_cents: toInt(s.share_cents) }))
        .filter((s) => Number.isFinite(s.user_id) && Number.isFinite(s.share_cents) && s.share_cents >= 0);
    } else {
      finalSplits = splitEqual(cents, participants);
    }
    // Validate: must cover exactly cents, and only for participants
    const partSet = new Set(participants);
    finalSplits = finalSplits.filter((s) => partSet.has(s.user_id));
    const sum = finalSplits.reduce((a, s) => a + s.share_cents, 0);
    if (sum !== cents) {
      return res.status(400).json({ error: `Split totals must equal amount. Got ${sum}, expected ${cents}.` });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const expRes = await client.query(
        `
        INSERT INTO expenses (group_id, description, amount_cents, paid_by, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [groupId, description, cents, Number.isFinite(payerId) ? payerId : creatorId, Number.isFinite(creatorId) ? creatorId : payerId]
      );
      const expense = expRes.rows[0];
      for (const s of finalSplits) {
        await client.query(
          `INSERT INTO expense_splits (expense_id, user_id, share_cents) VALUES ($1, $2, $3)`,
          [expense.id, s.user_id, s.share_cents]
        );
      }
      await client.query("COMMIT");
      res.json(expense);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("Create expense failed:", e);
      res.status(500).json({ error: "Failed to create expense" });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Create expense failed:", err);
    res.status(500).json({ error: "Failed to create expense" });
  }
});

/**
 * DELETE expense (also deletes splits via cascade)
 */
router.delete("/:expenseId", async (req, res) => {
  const expenseId = toInt(req.params.expenseId);
  if (!Number.isFinite(expenseId)) return res.status(400).json({ error: "Invalid expenseId" });
  try {
    await pool.query(`DELETE FROM expenses WHERE id = $1`, [expenseId]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Delete expense failed:", err);
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

/**
 * GET /expenses/:expenseId
 * Fetch a single expense with payer/creator names and amount in dollars.
 */
router.get("/:expenseId", async (req, res) => {
  const expenseId = toInt(req.params.expenseId);
  if (!Number.isFinite(expenseId)) return res.status(400).json({ error: 'Invalid expenseId' });
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.group_id, e.description, e.amount_cents, e.paid_by, pu.name AS paid_by_name,
              e.created_by, cu.name AS created_by_name, e.created_at
       FROM expenses e
       LEFT JOIN users pu ON pu.id = e.paid_by
       LEFT JOIN users cu ON cu.id = e.created_by
       WHERE e.id = $1`,
      [expenseId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Expense not found' });
    const r = rows[0];
    res.json({
      id: r.id,
      group_id: r.group_id,
      description: r.description,
      amount_cents: Number(r.amount_cents),
      amount: (Number(r.amount_cents) / 100).toFixed(2),
      paid_by: r.paid_by,
      paid_by_name: r.paid_by_name,
      created_by: r.created_by,
      created_by_name: r.created_by_name,
      created_at: r.created_at
    });
  } catch (err) {
    console.error('❌ Get expense failed:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * PUT /expenses/:expenseId
 * Update an existing expense and its splits. Requires amount and description; optional new splits.
 */
router.put("/:expenseId", async (req, res) => {
  const expenseId = toInt(req.params.expenseId);
  if (!Number.isFinite(expenseId)) return res.status(400).json({ error: 'Invalid expenseId' });
  const { description, amount, paid_by, participants, split_mode, splits } = req.body || {};
  const desc = (description || '').trim();
  const amt = Number(amount);
  const payerId = toInt(paid_by);
  if (!desc || !amt || amt <= 0 || !Number.isFinite(payerId)) {
    return res.status(400).json({ error: 'Missing or invalid fields' });
  }
  const cents = Math.round(amt * 100);
  // Determine participants
  let participantsList = Array.isArray(participants) ? participants.map(toInt).filter(Number.isFinite) : [];
  try {
    const { rows: expenseRows } = await pool.query(`SELECT group_id FROM expenses WHERE id=$1`, [expenseId]);
    if (expenseRows.length === 0) return res.status(404).json({ error: 'Expense not found' });
    const groupId = expenseRows[0].group_id;
    if (participantsList.length === 0) {
      const memRes = await pool.query(`SELECT user_id FROM group_members WHERE group_id=$1`, [groupId]);
      participantsList = memRes.rows.map((r) => r.user_id);
    }
    if (participantsList.length === 0) return res.status(400).json({ error: 'No participants' });
    // Build splits
    let finalSplits = [];
    if (Array.isArray(splits) && splits.length > 0) {
      if (split_mode === 'percent') {
        finalSplits = splits.map((s) => {
          const uid = toInt(s.user_id);
          const pct = Number(s.percent);
          if (!participantsList.includes(uid) || !pct || pct < 0) return null;
          return { user_id: uid, share_cents: Math.round(cents * pct / 100) };
        }).filter(Boolean);
      } else if (split_mode === 'shares') {
        const totalShares = splits.reduce((sum, s) => sum + Number(s.shares || 0), 0);
        finalSplits = splits.map((s) => {
          const uid = toInt(s.user_id);
          const shares = Number(s.shares || 0);
          if (!participantsList.includes(uid) || shares < 0) return null;
          const shareCents = totalShares > 0 ? Math.floor(cents * shares / totalShares) : 0;
          return { user_id: uid, share_cents: shareCents };
        }).filter(Boolean);
        const used = finalSplits.reduce((a, s) => a + s.share_cents, 0);
        let rem = cents - used;
        for (const s of finalSplits) {
          if (rem <= 0) break;
          s.share_cents += 1;
          rem -= 1;
        }
      } else {
        // unequal: provided as cents
        finalSplits = splits.map((s) => {
          const uid = toInt(s.user_id);
          const share = toInt(s.share_cents);
          if (!participantsList.includes(uid) || !Number.isFinite(share) || share < 0) return null;
          return { user_id: uid, share_cents: share };
        }).filter(Boolean);
      }
    }
    if (finalSplits.length === 0) {
      const n = participantsList.length;
      const base = Math.floor(cents / n);
      let rem = cents - base * n;
      finalSplits = participantsList.map((uid) => {
        const extra = rem > 0 ? 1 : 0;
        rem -= extra;
        return { user_id: uid, share_cents: base + extra };
      });
    }
    const sumCents = finalSplits.reduce((a, s) => a + s.share_cents, 0);
    if (sumCents !== cents) {
      return res.status(400).json({ error: `Split totals must equal amount. Got ${sumCents}, expected ${cents}.` });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE expenses SET description=$1, amount_cents=$2, paid_by=$3, created_by=$4 WHERE id=$5`,
        [desc, cents, payerId, payerId, expenseId]
      );
      // Delete old splits
      await client.query(`DELETE FROM expense_splits WHERE expense_id=$1`, [expenseId]);
      for (const s of finalSplits) {
        await client.query(
          `INSERT INTO expense_splits (expense_id, user_id, share_cents) VALUES ($1,$2,$3)`,
          [expenseId, s.user_id, s.share_cents]
        );
      }
      await client.query('COMMIT');
      res.json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Error updating expense:', err);
      res.status(500).json({ error: 'Server error' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Error updating expense:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;