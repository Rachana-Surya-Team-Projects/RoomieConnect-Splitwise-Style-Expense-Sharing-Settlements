// server/scripts/init_db.js
import pkg from "pg";
const { Pool } = pkg;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://roomie:roomie@db:5432/roomieconnect"; // inside docker use db host

const pool = new Pool({ connectionString: DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        join_code VARCHAR(12) UNIQUE NOT NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS group_members (
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(40) DEFAULT 'member',
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (group_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
        paid_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS expense_splits (
        id SERIAL PRIMARY KEY,
        expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        share_cents INTEGER NOT NULL CHECK (share_cents >= 0)
      );

      CREATE TABLE IF NOT EXISTS settlements (
        id SERIAL PRIMARY KEY,
        group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
        from_user INTEGER REFERENCES users(id) ON DELETE SET NULL,
        to_user INTEGER REFERENCES users(id) ON DELETE SET NULL,
        amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
        status VARCHAR(20) DEFAULT 'completed',
        stripe_payment_intent_id TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      -- Ensure a note column exists for settlements.  This is used to store optional
      -- descriptions for manual and Stripe settlements.  If the note column
      -- already exists this command is a no-op.
      ALTER TABLE settlements
        ADD COLUMN IF NOT EXISTS note TEXT;

      -- Create a unique index on stripe_payment_intent_id to prevent duplicate
      -- inserts from webhook retries.  The IF NOT EXISTS guard avoids errors if
      -- the index already exists.  We do not specify CONCURRENTLY here since
      -- this script runs on startup when no other sessions should be using
      -- the database.
      CREATE UNIQUE INDEX IF NOT EXISTS idx_settlements_stripe_payment_intent_id
        ON settlements(stripe_payment_intent_id);

      CREATE INDEX IF NOT EXISTS idx_expenses_group_created_at ON expenses(group_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_splits_expense ON expense_splits(expense_id);
      CREATE INDEX IF NOT EXISTS idx_settlements_group_created_at ON settlements(group_id, created_at DESC);
    `);

    console.log("✅ Tables created successfully (with expense_splits + settlements)");
  } catch (e) {
    console.error("❌ init_db failed:", e);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(() => process.exit(1));
