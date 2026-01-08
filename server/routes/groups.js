// server/routes/groups.js
import express from "express";
import pool from "../db.js";
import crypto from "crypto";

// Helpers to coerce values
function toInt(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : NaN;
}

// Convert dollars (string or number) to integer cents
function dollarsToCents(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100);
}

const router = express.Router();

/**
 * GET /groups?user_id=123
 * Fetch all groups for a user
 */
router.get("/", async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) return res.status(400).json({ error: "user_id is required" });
  try {
    const result = await pool.query(
      `
      SELECT g.id, g.name, g.join_code, g.created_at, g.created_by,
             u.name as owner_name
      FROM groups g
      JOIN group_members gm ON g.id = gm.group_id
      LEFT JOIN users u ON g.created_by = u.id
      WHERE gm.user_id = $1
      ORDER BY g.created_at DESC
      `,
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching groups:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /groups/:id
 * Fetch single group details + members
 */
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    // fetch group info + owner
    const groupResult = await pool.query(
      `
      SELECT g.id, g.name, g.join_code, g.created_at, g.created_by,
             u.name as owner_name
      FROM groups g
      LEFT JOIN users u ON g.created_by = u.id
      WHERE g.id = $1
      `,
      [id]
    );
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: "Group not found" });
    }
    const group = groupResult.rows[0];
    // fetch members
    const membersResult = await pool.query(
      `
      SELECT u.id, u.name, u.email
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = $1
      ORDER BY u.name
      `,
      [id]
    );
    group.members = membersResult.rows;
    res.json(group);
  } catch (err) {
    console.error("❌ Error fetching group:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /groups
 * Create new group
 */
router.post("/", async (req, res) => {
  const { name, owner_id } = req.body;
  if (!name || !owner_id) {
    return res.status(400).json({ error: "Group name and owner_id required" });
  }
  const joinCode = crypto.randomBytes(3).toString("hex"); // 6-char code
  try {
    const groupResult = await pool.query(
      `INSERT INTO groups (name, created_by, join_code)
       VALUES ($1, $2, $3)
       RETURNING id, name, join_code, created_at, created_by`,
      [name, owner_id, joinCode]
    );
    const group = groupResult.rows[0];
    // add owner as member
    await pool.query(
      `INSERT INTO group_members (group_id, user_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [group.id, owner_id]
    );
    res.status(201).json(group);
  } catch (err) {
    console.error("❌ Error creating group:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /groups/join
 * Join group via code
 */
router.post("/join", async (req, res) => {
  const { code, user_id } = req.body;
  if (!code || !user_id) {
    return res.status(400).json({ error: "Group code and user_id required" });
  }
  try {
    const groupResult = await pool.query(
      `SELECT id, name, join_code, created_at, created_by
       FROM groups WHERE join_code = $1 LIMIT 1`,
      [code]
    );
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: "Invalid group code" });
    }
    const group = groupResult.rows[0];
    await pool.query(
      `INSERT INTO group_members (group_id, user_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [group.id, user_id]
    );
    res.status(201).json(group);
  } catch (err) {
    console.error("❌ Error joining group:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /groups/:id
 * Only creator can delete
 */
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.query;
  try {
    const check = await pool.query(`SELECT created_by FROM groups WHERE id=$1`, [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: "Group not found" });
    if (check.rows[0].created_by !== parseInt(user_id)) {
      return res.status(403).json({ error: "Only group creator can delete this group" });
    }
    await pool.query(`DELETE FROM groups WHERE id=$1`, [id]);
    res.json({ message: "Group deleted" });
  } catch (err) {
    console.error("❌ Error deleting group:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /groups/:id/expenses
 * Return all expenses for a group with amounts converted to dollars and payer names.
 */
router.get("/:id/expenses", async (req, res) => {
  const groupId = toInt(req.params.id);
  if (!Number.isFinite(groupId)) return res.status(400).json({ error: "Invalid group id" });
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.group_id, e.description,
              e.amount_cents,
              e.paid_by, pu.name AS paid_by_name,
              e.created_by, cu.name AS created_by_name,
              e.created_at
       FROM expenses e
       LEFT JOIN users pu ON pu.id = e.paid_by
       LEFT JOIN users cu ON cu.id = e.created_by
       WHERE e.group_id = $1
       ORDER BY e.created_at DESC`,
      [groupId]
    );
    const result = rows.map((r) => ({
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
    }));
    res.json(result);
  } catch (err) {
    console.error("❌ Error fetching group expenses:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /groups/:id/balances
 * Compute net balances for each member of the group.
 */
router.get("/:id/balances", async (req, res) => {
  const groupId = toInt(req.params.id);
  if (!Number.isFinite(groupId)) return res.status(400).json({ error: "Invalid group id" });
  try {
    const { rows } = await pool.query(
      `WITH mem AS (
         SELECT u.id, u.name
         FROM group_members gm
         JOIN users u ON gm.user_id=u.id
         WHERE gm.group_id=$1
       ),
       credits AS (
         SELECT paid_by AS user_id, SUM(amount_cents)::bigint AS paid_cents
         FROM expenses
         WHERE group_id=$1
         GROUP BY paid_by
       ),
       debts AS (
         SELECT s.user_id, SUM(s.share_cents)::bigint AS share_cents
         FROM expense_splits s
         JOIN expenses e ON e.id = s.expense_id
         WHERE e.group_id=$1
         GROUP BY s.user_id
       ),
       settle_to AS (
         -- Sum of settlements received (to_user). Receiving money reduces what others owe you,
         -- so it should decrease net balance. We'll subtract this later.
         SELECT to_user AS user_id, SUM(amount_cents)::bigint AS settle_to_cents
         FROM settlements
         WHERE group_id=$1
         GROUP BY to_user
       ),
       settle_from AS (
         -- Sum of settlements paid (from_user). Paying money reduces what you owe others,
         -- so it should increase net balance. We'll add this later.
         SELECT from_user AS user_id, SUM(amount_cents)::bigint AS settle_from_cents
         FROM settlements
         WHERE group_id=$1
         GROUP BY from_user
       )
       SELECT m.id AS user_id, m.name,
              COALESCE(credits.paid_cents,0)
              - COALESCE(debts.share_cents,0)
              + COALESCE(settle_from.settle_from_cents,0)
              - COALESCE(settle_to.settle_to_cents,0) AS net_cents
       FROM mem m
       LEFT JOIN credits ON credits.user_id = m.id
       LEFT JOIN debts ON debts.user_id = m.id
       LEFT JOIN settle_to ON settle_to.user_id = m.id
       LEFT JOIN settle_from ON settle_from.user_id = m.id
      `,
      [groupId]
    );
    const result = rows.map((r) => ({
      user_id: r.user_id,
      name: r.name,
      amount_cents: Number(r.net_cents),
      amount: (Number(r.net_cents) / 100).toFixed(2)
    }));
    res.json(result);
  } catch (err) {
    console.error("❌ Error computing balances:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /groups/:id/transactions
 * Returns transaction history for a group derived from settlements.  Each record
 * includes provider (manual|stripe), from/to user names, note, status and
 * amount (in cents) with created timestamp.
 */
router.get("/:id/transactions", async (req, res) => {
  const groupId = toInt(req.params.id);
  if (!Number.isFinite(groupId)) return res.status(400).json({ error: "Invalid group id" });
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
       ORDER BY s.created_at DESC
      `,
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
    console.error("❌ Error fetching group transactions:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /groups/:id/expenses
 * Create a new expense in the group. Supports various split modes.
 */
router.post("/:id/expenses", async (req, res) => {
  const groupId = toInt(req.params.id);
  if (!Number.isFinite(groupId)) return res.status(400).json({ error: "Invalid group id" });
  const {
    description,
    amount,
    created_by,
    members,
    split_mode,
    splits
  } = req.body || {};
  const desc = (description || '').trim();
  const creatorId = toInt(created_by);
  const amt = Number(amount);
  if (!desc || !creatorId || !amt || amt <= 0) {
    return res.status(400).json({ error: 'Missing or invalid fields' });
  }
  // Fetch members list for default splitting
  let participants = Array.isArray(members) ? members.map(toInt).filter(Number.isFinite) : [];
  try {
    if (participants.length === 0) {
      const memRes = await pool.query(`SELECT user_id FROM group_members WHERE group_id=$1`, [groupId]);
      participants = memRes.rows.map((r) => r.user_id);
    }
    if (participants.length === 0) return res.status(400).json({ error: 'No participants' });
    const cents = Math.round(amt * 100);
    // Build splits
    let finalSplits = [];
    if (Array.isArray(splits) && splits.length > 0) {
      if (split_mode === 'percent') {
        finalSplits = splits.map((s) => {
          const uid = toInt(s.user_id);
          const pct = Number(s.percent);
          if (!participants.includes(uid) || !pct || pct < 0) return null;
          return { user_id: uid, share_cents: Math.round(cents * pct / 100) };
        }).filter(Boolean);
      } else if (split_mode === 'shares') {
        const totalShares = splits.reduce((sum, s) => sum + Number(s.shares || 0), 0);
        finalSplits = splits.map((s) => {
          const uid = toInt(s.user_id);
          const shares = Number(s.shares || 0);
          if (!participants.includes(uid) || shares < 0) return null;
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
          if (!participants.includes(uid) || !Number.isFinite(share) || share < 0) return null;
          return { user_id: uid, share_cents: share };
        }).filter(Boolean);
      }
    }
    if (finalSplits.length === 0) {
      const n = participants.length;
      const base = Math.floor(cents / n);
      let rem = cents - base * n;
      finalSplits = participants.map((uid) => {
        const extra = rem > 0 ? 1 : 0;
        rem -= extra;
        return { user_id: uid, share_cents: base + extra };
      });
    }
    const sumCents = finalSplits.reduce((a, s) => a + s.share_cents, 0);
    if (sumCents !== cents) {
      return res.status(400).json({ error: `Split totals must equal amount. Got ${sumCents}, expected ${cents}.` });
    }
    // Insert expense and splits within transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const expRes = await client.query(
        `INSERT INTO expenses (group_id, description, amount_cents, paid_by, created_by)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING *`,
        [groupId, desc, cents, creatorId, creatorId]
      );
      const expense = expRes.rows[0];
      for (const s of finalSplits) {
        await client.query(
          `INSERT INTO expense_splits (expense_id, user_id, share_cents) VALUES ($1,$2,$3)`,
          [expense.id, s.user_id, s.share_cents]
        );
      }
      await client.query('COMMIT');
      res.json({
        id: expense.id,
        group_id: expense.group_id,
        description: expense.description,
        amount_cents: expense.amount_cents,
        amount: (expense.amount_cents / 100).toFixed(2),
        paid_by: expense.paid_by,
        created_by: expense.created_by,
        created_at: expense.created_at
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ Error creating expense:', err);
      res.status(500).json({ error: 'Server error' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('❌ Error creating expense:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;