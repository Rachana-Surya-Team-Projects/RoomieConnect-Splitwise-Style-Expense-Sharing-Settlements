import express from "express";
import pool from "../db.js";

const router = express.Router();

function toInt(n) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.trunc(x) : NaN;
}

// Helper: groups where user is a member
async function getUserGroupIds(userId) {
  const { rows } = await pool.query(`SELECT group_id FROM group_members WHERE user_id = $1`, [userId]);
  return rows.map((r) => r.group_id);
}

/**
 * GET /api/dashboard/user/:userId
 * Returns dashboard summary + recent activity
 */
router.get("/user/:userId", async (req, res) => {
  const userId = toInt(req.params.userId);
  if (!Number.isFinite(userId)) return res.status(400).json({ error: "Invalid userId" });

  try {
    const groupIds = await getUserGroupIds(userId);
    if (groupIds.length === 0) {
      return res.json({
        monthSpentCents: 0,
        monthExpenseCount: 0,
        allTimeSpentCents: 0,
        monthlySpend: [],
        recentExpenses: [],
        recentSettlements: [],
      });
    }

    // This month spend = sum of your split shares in current month across all groups
    const monthRes = await pool.query(
      `
      SELECT
        COALESCE(SUM(s.share_cents), 0) AS month_spent_cents,
        COALESCE(COUNT(DISTINCT e.id), 0) AS month_expense_count
      FROM expense_splits s
      JOIN expenses e ON e.id = s.expense_id
      WHERE s.user_id = $1
        AND e.group_id = ANY($2::int[])
        AND date_trunc('month', e.created_at) = date_trunc('month', NOW())
      `,
      [userId, groupIds]
    );

    const allTimeRes = await pool.query(
      `
      SELECT COALESCE(SUM(s.share_cents), 0) AS all_time_spent_cents
      FROM expense_splits s
      JOIN expenses e ON e.id = s.expense_id
      WHERE s.user_id = $1 AND e.group_id = ANY($2::int[])
      `,
      [userId, groupIds]
    );

    // Monthly spend last 6 months
    const monthlyRes = await pool.query(
      `
      SELECT to_char(date_trunc('month', e.created_at), 'YYYY-MM') AS month,
             SUM(s.share_cents)::bigint AS spent_cents
      FROM expense_splits s
      JOIN expenses e ON e.id = s.expense_id
      WHERE s.user_id = $1
        AND e.group_id = ANY($2::int[])
        AND e.created_at >= (date_trunc('month', NOW()) - INTERVAL '5 months')
      GROUP BY 1
      ORDER BY 1 ASC
      `,
      [userId, groupIds]
    );

    // Recent expenses (last 10 you are part of)
    const recentExpRes = await pool.query(
      `
      SELECT e.id, e.group_id, g.name AS group_name,
             e.description, e.amount_cents, e.paid_by, pu.name AS paid_by_name,
             e.created_at,
             s.share_cents AS your_share_cents
      FROM expense_splits s
      JOIN expenses e ON e.id = s.expense_id
      JOIN groups g ON g.id = e.group_id
      LEFT JOIN users pu ON pu.id = e.paid_by
      WHERE s.user_id = $1 AND e.group_id = ANY($2::int[])
      ORDER BY e.created_at DESC
      LIMIT 10
      `,
      [userId, groupIds]
    );

    // Recent settlements (last 10 involving you)
    const recentSetRes = await pool.query(
      `
      SELECT st.id, st.group_id, g.name AS group_name,
             st.from_user, fu.name AS from_name,
             st.to_user, tu.name AS to_name,
             st.amount_cents, st.status, st.note, st.stripe_payment_intent_id,
             st.created_at
      FROM settlements st
      JOIN groups g ON g.id = st.group_id
      LEFT JOIN users fu ON fu.id = st.from_user
      LEFT JOIN users tu ON tu.id = st.to_user
      WHERE st.group_id = ANY($2::int[])
        AND (st.from_user = $1 OR st.to_user = $1)
      ORDER BY st.created_at DESC
      LIMIT 10
      `,
      [userId, groupIds]
    );

    // KPIs (dollars) and counts
    const monthSpentCents = Number(monthRes.rows[0]?.month_spent_cents || 0);
    const monthExpenseCount = Number(monthRes.rows[0]?.month_expense_count || 0);
    const allTimeSpentCents = Number(allTimeRes.rows[0]?.all_time_spent_cents || 0);
    // Monthly spend last six months (convert to dollars)
    const monthly = monthlyRes.rows.map((r) => ({ month: r.month, total: Number(r.spent_cents) / 100 }));
    // Top groups this month by your spending
    const topGroupsQuery = await pool.query(
      `SELECT e.group_id, g.name, SUM(s.share_cents)::bigint AS spent_cents
       FROM expense_splits s
       JOIN expenses e ON e.id = s.expense_id
       JOIN groups g ON g.id = e.group_id
       WHERE s.user_id = $1
         AND date_trunc('month', e.created_at) = date_trunc('month', NOW())
       GROUP BY e.group_id, g.name
       ORDER BY spent_cents DESC
       LIMIT 5`,
      [userId]
    );
    const topGroups = topGroupsQuery.rows.map((r) => ({ id: r.group_id, name: r.name, total: Number(r.spent_cents) / 100 }));
    // Recent expenses: convert to expected shape with amount in dollars
    const recentExpensesList = recentExpRes.rows.map((r) => ({
      id: r.id,
      group_id: r.group_id,
      group_name: r.group_name,
      description: r.description,
      amount: Number(r.amount_cents) / 100,
      amount_cents: Number(r.amount_cents),
      paid_by: r.paid_by,
      paid_by_name: r.paid_by_name,
      created_at: r.created_at,
      your_share_cents: Number(r.your_share_cents),
    }));
    // Recent settlements/transactions: convert to expected shape with amount in dollars and provider
    const recentTransactionsList = recentSetRes.rows.map((r) => ({
      id: r.id,
      group_id: r.group_id,
      group_name: r.group_name,
      provider: r.stripe_payment_intent_id ? 'stripe' : 'manual',
      from_user: r.from_user,
      from_name: r.from_name,
      to_user: r.to_user,
      to_name: r.to_name,
      amount_cents: Number(r.amount_cents),
      amount: Number(r.amount_cents) / 100,
      status: r.status || 'completed',
      created_at: r.created_at,
      note: r.note || '',
    }));
    res.json({
      // legacy fields for backward compatibility
      monthSpentCents,
      monthExpenseCount,
      allTimeSpentCents,
      monthlySpend: monthlyRes.rows.map((r) => ({ month: r.month, spentCents: Number(r.spent_cents) })),
      recentExpenses: recentExpensesList,
      recentSettlements: recentSetRes.rows.map((r) => ({
        id: r.id,
        groupId: r.group_id,
        groupName: r.group_name,
        fromUser: r.from_user,
        fromName: r.from_name,
        toUser: r.to_user,
        toName: r.to_name,
        amountCents: Number(r.amount_cents),
        status: r.status,
        createdAt: r.created_at,
      })),
      // new fields for dashboard component
      kpis: {
        month_total: monthSpentCents / 100,
        month_count: monthExpenseCount,
        all_time_total: allTimeSpentCents / 100,
      },
      monthly,
      topGroups,
      recentExpenses: recentExpensesList,
      recentTransactions: recentTransactionsList,
    });
  } catch (err) {
    console.error("Dashboard user summary failed:", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

/**
 * GET /api/dashboard/friends/:userId
 * Net balances with each friend across all groups.
 */
router.get("/friends/:userId", async (req, res) => {
  const userId = toInt(req.params.userId);
  if (!Number.isFinite(userId)) return res.status(400).json({ error: "Invalid userId" });

  try {
    const groupIds = await getUserGroupIds(userId);
    if (groupIds.length === 0) return res.json([]);

    /**
     * Build directed edges for all expenses in user's groups:
     * debtor -> creditor (payer) for each split where user_id != paid_by
     */
    const { rows } = await pool.query(
      `
      WITH expense_edges AS (
        SELECT
          s.user_id AS debtor,
          e.paid_by AS creditor,
          s.share_cents AS amt
        FROM expense_splits s
        JOIN expenses e ON e.id = s.expense_id
        WHERE e.group_id = ANY($1::int[])
          AND e.paid_by IS NOT NULL
          AND s.user_id IS NOT NULL
          AND s.user_id <> e.paid_by
      ),
      settlement_edges AS (
        -- Include settlements involving the user across the user's groups or without a group
        SELECT
          st.to_user AS debtor,
          st.from_user AS creditor,
          st.amount_cents AS amt
        FROM settlements st
        WHERE (st.from_user = $2 OR st.to_user = $2)
          AND (st.group_id = ANY($1::int[]) OR st.group_id IS NULL)
          AND COALESCE(st.status, 'completed') != 'failed'
          AND st.from_user IS NOT NULL
          AND st.to_user IS NOT NULL
      ),
      edges AS (
        SELECT * FROM expense_edges
        UNION ALL
        SELECT * FROM settlement_edges
      ),
      net AS (
        SELECT
          CASE
            WHEN debtor = $2 THEN creditor
            WHEN creditor = $2 THEN debtor
          END AS friend_id,
          SUM(
            CASE
              WHEN creditor = $2 THEN amt      -- friend owes you
              WHEN debtor = $2 THEN -amt       -- you owe friend
              ELSE 0
            END
          )::bigint AS net_cents
        FROM edges
        WHERE debtor = $2 OR creditor = $2
        GROUP BY 1
      )
      SELECT n.friend_id, u.name, u.email, n.net_cents
      FROM net n
      JOIN users u ON u.id = n.friend_id
      WHERE n.friend_id IS NOT NULL
      ORDER BY ABS(n.net_cents) DESC, u.name ASC
      `,
      [groupIds, userId]
    );

    res.json(
      rows.map((r) => ({
        user_id: r.friend_id,
        name: r.name,
        email: r.email,
        net_cents: Number(r.net_cents),
      }))
    );
  } catch (err) {
    console.error("Friends balances failed:", err);
    res.status(500).json({ error: "Failed to load friends balances" });
  }
});

export default router;
