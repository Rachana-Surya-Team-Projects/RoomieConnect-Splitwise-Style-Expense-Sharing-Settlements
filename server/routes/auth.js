// server/routes/auth.js
import express from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import pool from "../db.js";

const router = express.Router();

// ✅ Register
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  let client;
  try {
    const password_hash = await bcrypt.hash(password, 10);

    client = await pool.connect();
    await client.query("BEGIN");

    // ✅ FIX: insert into password_hash (NOT password)
    const result = await client.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name, email, password_hash]
    );

    const user = result.rows[0];

    // Create personal group for the user
    const joinCode = crypto.randomBytes(3).toString("hex");
    const gRes = await client.query(
      `INSERT INTO groups (name, join_code, created_by)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ["Personal", joinCode, user.id]
    );

    const groupId = gRes.rows[0].id;

    await client.query(
      `INSERT INTO group_members (group_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [groupId, user.id]
    );

    await client.query("COMMIT");

    res.status(201).json({ ...user, personal_group_id: groupId });
  } catch (err) {
    try {
      await client?.query("ROLLBACK");
    } catch {}

    console.error("❌ Registration error:", err);

    // duplicate email
    if (err.code === "23505") {
      return res.status(400).json({ error: "Email already registered" });
    }

    res.status(500).json({ error: "Server error" });
  } finally {
    client?.release();
  }
});

// ✅ Login
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    // ✅ only fetch needed fields
    const result = await pool.query(
      `SELECT id, name, email, password_hash
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // ✅ FIX: compare against password_hash (NOT password)
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Return safe user data
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
