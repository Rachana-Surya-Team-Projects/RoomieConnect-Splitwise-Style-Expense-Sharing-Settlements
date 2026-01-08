// server/scripts/seed.js
import pkg from "pg";
const { Pool } = pkg;

import bcrypt from "bcrypt";
import crypto from "crypto";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://roomie:roomie@db:5432/roomieconnect"; // inside docker use db host

const pool = new Pool({ connectionString: DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  try {
    console.log("🌱 Seeding database...");

    // IMPORTANT:
    // ✅ DO NOT recreate tables here.
    // init_db.js already creates the correct schema with users.password_hash.
    // This seed file must follow the SAME schema.

    // 1) Create 2 demo users
    const demoPassHash = await bcrypt.hash("demo123", 10);

    const u1 = await client.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, email`,
      ["Demo User", "demo@example.com", demoPassHash]
    );

    const u2 = await client.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, name, email`,
      ["Demo Friend", "friend@example.com", demoPassHash]
    );

    const user1Id = u1.rows[0].id;
    const user2Id = u2.rows[0].id;

    // 2) Create demo group with join_code
    const joinCode = crypto.randomBytes(3).toString("hex");

    const g = await client.query(
      `INSERT INTO groups (name, join_code, created_by)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ["Maple St House", joinCode, user1Id]
    );

    const groupId = g.rows[0].id;

    // 3) Add members
    await client.query(
      `INSERT INTO group_members (group_id, user_id, role)
       VALUES ($1, $2, 'owner')
       ON CONFLICT DO NOTHING`,
      [groupId, user1Id]
    );

    await client.query(
      `INSERT INTO group_members (group_id, user_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT DO NOTHING`,
      [groupId, user2Id]
    );

    // 4) Insert one expense + splits (cents)
    // Example: groceries $10 split 50/50 => each owes $5
    const amountCents = 1000;

    const exp = await client.query(
      `INSERT INTO expenses (group_id, description, amount_cents, paid_by, created_by)
       VALUES ($1, $2, $3, $4, $4)
       RETURNING id`,
      [groupId, "Groceries", amountCents, user1Id]
    );

    const expenseId = exp.rows[0].id;

    await client.query(
      `INSERT INTO expense_splits (expense_id, user_id, share_cents)
       VALUES 
         ($1, $2, $3),
         ($1, $4, $3)`,
      [expenseId, user1Id, 500, user2Id]
    );

    console.log("✅ Seed complete!");
    console.log(`   Demo login: demo@example.com / demo123`);
    console.log(`   Demo group join_code: ${joinCode}`);
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(() => process.exit(1));
