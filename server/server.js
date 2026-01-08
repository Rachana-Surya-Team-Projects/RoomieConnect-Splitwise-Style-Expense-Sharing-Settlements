import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import groupRoutes from "./routes/groups.js";
import expenseRoutes from "./routes/expenses.js";
import paymentRoutes, { stripeWebhookHandler } from "./routes/payments.js";
import dashboardRoutes from "./routes/dashboard.js";

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  credentials: true
}));

// Stripe webhook must use raw body
app.post("/api/payments/webhook", express.raw({ type: "application/json" }), stripeWebhookHandler);

app.use(bodyParser.json());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
// Mount expense routes under /api/expenses to avoid path ambiguity
app.use("/api/expenses", expenseRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

// ✅ Only serve built frontend if it exists (production mode)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.join(__dirname, "client", "dist");
const indexHtml = path.join(distPath, "index.html");

if (fs.existsSync(indexHtml)) {
  app.use(express.static(distPath));

  // Catch-all → serve frontend index.html only when dist exists
  app.get("*", (req, res) => {
    res.sendFile(indexHtml);
  });
} else {
  // In dev, avoid crashing when someone visits backend root
  app.get("/", (req, res) => {
    res.send("Backend is running ✅ Use /api/health or open frontend on :5173");
  });
}

// Start server
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});