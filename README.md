# RoomieConnect — Splitwise-Style Expense Sharing & Settlements Platform

RoomieConnect is a **production-style, full-stack expense sharing platform** inspired by Splitwise. It enables roommates, friends, and small groups to **track shared expenses**, apply **flexible split rules**, compute **accurate real-time balances**, and complete **settlement workflows** (manual and Stripe-backed) with a clear, auditable activity trail.

It solves a real-world problem: shared living and group spending quickly becomes messy—who paid, who owes whom, and what changed after edits or settlements. RoomieConnect keeps the **ledger accurate**, the **UI easy to follow**, and **balances consistent across the entire application** after every change.

**Built for:** roommates, travel groups, friends splitting recurring costs, and anyone who wants transparent group finance tracking without spreadsheets.

---

## Project Overview

RoomieConnect helps small groups answer the questions that break shared finances:
- Who paid for what?
- How should the cost be split fairly (equal / custom / percent / shares)?
- Who owes whom right now?
- What changed after an expense edit or a settlement?
- Can we settle up cleanly and see a trustworthy history?

The system is designed with a strong focus on **correctness, transparency, and UX clarity**, making it suitable for real-world use rather than a demo-only prototype.

---

## Problem Statement & Motivation

Most expense-sharing apps break down due to:
- inconsistent split logic,
- unclear reconciliation after edits,
- and balances that fail to reflect settlements accurately.

RoomieConnect addresses this with a **ledger-based persistence model**:
- each expense produces durable per-user allocations (`expense_splits`),
- each settle-up produces durable settlement records (`settlements`),
- balances are always computed from these sources of truth.

This approach ensures the UI remains consistent across **Dashboard, Activity, Friends, Groups, Balances, and Transactions** after any mutation.

---

## Key Features

### Authentication
- Email/password authentication with **bcrypt password hashing**
- Client-side route protection with persisted login state
- Separate auth and application layouts

### Groups
- Create groups and invite members via **join codes**
- Automatic **Personal** group creation on registration for quick onboarding

### Expense Tracking
- Create expenses with description, amount, payer, date, and participants
- Split support implemented end-to-end:
  - **Equal**
  - **Unequal (custom amounts)**
  - **Percent**
  - **Shares**
- Per-user split ledger stored at write-time for reliable balance calculations

### Expense Details
- Expense detail view with payer and split breakdown
- **Edit Expense** flow (route-driven) with full split-mode support
- Delete expense support

### Balances & Reconciliation
- Group balance computation based on:
  - Expense splits
  - Settlements (manual and Stripe)
- Balances update consistently across all screens after edits or settlements

### Settlements (Settle Up)
- Manual settle-up recording
- **Stripe PaymentIntent** flow (client Payment Element + server intent + webhook)
- Webhook de-duplication using a unique index on PaymentIntent ID

### Activity & Transactions
- Group transaction history including settle-ups
- Activity feed reflecting expense creation, edits, and settlements
- Friends view reflects balances from both expenses and settlements

### UI / UX Quality
- Clean, Vuetify-based UI with a consistent component system
- Loading and error states for user-friendly failures
- Default dark theme with persistent user preference

### Operational Readiness
- Dockerized local development environment
- Automatic schema initialization and health-checked services
- Production-style reverse proxy configuration using **Caddy**

---

## Tech Stack

### Frontend
- **Vue 3** (Single Page Application)
- **Vite** (build and dev tooling)
- **Vuetify** (Material Design UI components)
- **Vue Router** (route-based navigation and guards)
- REST API communication using Fetch/Axios
- **@vueuse/core** for utility composition helpers
- **Stripe.js (@stripe/stripe-js)** for Payment Element integration

**State management approach**
Lightweight reactive coordination via a global `refreshKey` (`client/src/refresh.js`) to trigger cross-page reloads after mutations (edits and settlements), avoiding unnecessary global stores for this scope.

### Backend
- **Node.js + Express**
- **PostgreSQL** via `pg`
- Modular REST API layer:
  - `/api/auth`
  - `/api/groups`
  - `/api/expenses`
  - `/api/payments`
  - `/api/dashboard`
- Stripe server SDK for PaymentIntent creation and webhook handling
- Environment configuration via `dotenv`
- Defensive server responses with clear HTTP status codes

### Database
- **PostgreSQL (SQL)**
- Schema designed for consistency and auditability:
  - `users`, `groups`, `group_members`
  - `expenses` + `expense_splits` (per-user ledger)
  - `settlements` (manual and Stripe-backed)
- Indexes for common access patterns (group timelines, split lookups)
- Uniqueness constraints to prevent duplicate Stripe webhook inserts

### DevOps & Tooling
- Docker + Docker Compose (local and production compose)
- Automatic DB initialization (`server/scripts/init_db.js`)
- Caddy reverse proxy:
  - Serves the built SPA
  - Proxies `/api/*` to the backend service

---

## System Architecture

RoomieConnect follows a clean, modular full-stack architecture:

### Client (Vue SPA)
- Component-driven UI for groups, expenses, balances, activity, friends, and transactions
- Route-based layouts (auth vs app shell)
- Mutation actions trigger re-fetches and global refresh signals

### Server (Express REST API)
- Feature-based route modules:
  - Auth (register/login)
  - Groups (membership, join codes)
  - Expenses (CRUD + splits)
  - Payments (manual settlement + Stripe + webhook)
  - Dashboard (aggregated totals, friends balances, activity)

### Data Layer (PostgreSQL)
- Transactions and constraints used where appropriate
- Balance calculations rely on normalized ledger tables for correctness

### Data Flow
- UI action (create/edit/delete/settle)
- REST request to server
- Server validates and writes to ledger tables
- Client re-fetches impacted views and triggers global refresh
- Dashboard, Activity, Friends, and Group balances remain consistent

### Scalability Considerations
- Clear separation of read and write endpoints
- Ledger-based schema supports reporting and analytics growth
- Reverse-proxy-friendly routing supports single-domain deployments

---

## API Overview (High Level)

**Base URL:** `/api`

### Auth
- `POST /auth/register` — Create user, hash password, create personal group
- `POST /auth/login` — Verify credentials and return safe user profile

### Groups
- `GET /groups` — List groups for the user context
- `GET /groups/:id` — Group details + membership
- `POST /groups` — Create a new group (with join code)
- `POST /groups/join` — Join a group via join code
- `DELETE /groups/:id` — Delete group (where supported)
- `GET /groups/:id/expenses` — Group expense feed
- `GET /groups/:id/balances` — Group balances (expenses + settlements)
- `GET /groups/:id/transactions` — Group transaction history
- `POST /groups/:id/expenses` — Create expense in group

### Expenses
- `GET /expenses/group/:groupId` — Expense list by group
- `GET /expenses/:expenseId` — Expense details
- `GET /expenses/:expenseId/splits` — Per-user splits for an expense
- `POST /expenses` — Create expense + splits
- `PUT /expenses/:expenseId` — Edit expense + rebuild splits
- `DELETE /expenses/:expenseId` — Delete expense

### Payments / Settlements
- `POST /payments/settle` — Manual settle-up record
- `POST /payments/create-intent` — Create Stripe PaymentIntent for settle-up
- `POST /payments/stripe/webhook` — Stripe webhook to finalize settlement write
- `GET /payments/settle/group/:groupId` — Group settle-up entries
- `GET /payments/transactions/group/:groupId` — Transaction feed for group

### Dashboard
- `GET /dashboard/user/:userId` — Aggregated dashboard totals and recents
- `GET /dashboard/friends/:userId` — Friend balances (expenses + settlements)

---

## Folder Structure

The repository is organized to keep responsibilities isolated and easy to review.

```text
roomieconnect/
├── client/
│   ├── node_modules/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Activity.vue
│   │   │   ├── Dashboard.vue
│   │   │   ├── EditExpense.vue
│   │   │   ├── ExpenseDetails.vue
│   │   │   ├── Expenses.vue
│   │   │   ├── Friends.vue
│   │   │   ├── GroupDetails.vue
│   │   │   ├── Groups.vue
│   │   │   ├── Header.vue
│   │   │   ├── Insights.vue
│   │   │   ├── Login.vue
│   │   │   ├── Logout.vue
│   │   │   ├── Register.vue
│   │   │   └── Transactions.vue
│   │   ├── layouts/
│   │   │   ├── AppShell.vue
│   │   │   └── AuthLayout.vue
│   │   ├── plugins/
│   │   │   └── vuetify.js
│   │   ├── router/
│   │   │   └── index.js
│   │   ├── App.vue
│   │   ├── main.js
│   │   ├── refresh.js
│   │   └── styles.css
│   ├── .DS_Store
│   ├── .env
│   ├── Dockerfile
│   ├── index.html
│   ├── nginx.conf
│   ├── package-lock.json
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── routes/
│   │   ├── auth.js
│   │   ├── dashboard.js
│   │   ├── expenses.js
│   │   ├── groups.js
│   │   └── payments.js
│   ├── scripts/
│   │   ├── init_db.js
│   │   └── seed.js
│   ├── .env
│   ├── db.js
│   ├── Dockerfile
│   ├── package-lock.json
│   ├── package.json
│   ├── prisma.sql
│   └── server.js
├── .DS_Store
├── README.md
├── Caddyfile
├── docker-compose.prod.yml
└── docker-compose.yml
```

---

## Setup & Installation

### Prerequisites
- Node.js 18+
- Docker + Docker Compose
- PostgreSQL (only if running without Docker)
- Stripe account (optional; only required for Stripe settle-ups)

### Environment Variables (names only)

**Server (e.g., `server/.env`)**
- `DATABASE_URL`
- `STRIPE_SECRET_KEY` (optional; required for Stripe flow)
- `STRIPE_WEBHOOK_SECRET` (optional; required for webhook verification)
- `FRONTEND_ORIGIN`
- `PORT` (optional; defaults to 8080 in this project)

**Client (e.g., `client/.env`)**
- `VITE_STRIPE_PUBLISHABLE_KEY` (optional; required for Stripe Payment Element)

### Run Locally (Recommended: Docker)

From the repo root:
```bash
docker compose up --build
```

- Client: http://localhost:5173  
- Server: http://localhost:8080  
- Postgres: exposed on localhost:5434 (dev compose)

### Run Frontend/Backend Separately (Without Docker)

**Backend**
```bash
cd server
npm install
npm run dev
```

**Frontend**
```bash
cd client
npm install
npm run dev
```

---

## 🚀 Deployment

RoomieConnect is deployed on **Render** using a production-ready architecture with **separate services** for the frontend, backend API, and database. This setup mirrors real-world cloud deployments with clear separation of concerns, secure configuration management, and independent scalability.

---

### 🌐 Live Services

#### Frontend — Static Site
- **URL:** https://roomieconnect-web.onrender.com  
- **Render Service:** `roomieconnect-web`  
- **Type:** Static Site  
- **Tech:** Vue 3 + Vite

The frontend is built using Vite and deployed as a static site. It communicates with the backend exclusively via REST APIs.

---

#### Backend — API Service
- **URL:** https://roomieconnect-api.onrender.com  
- **Render Service:** `roomieconnect-api`  
- **Type:** Web Service  
- **Tech:** Node.js + Express

The backend exposes `/api/*` endpoints for authentication, groups, expenses, settlements, and dashboard aggregation. It connects securely to the PostgreSQL database using environment-based configuration.

---

#### Database — Managed PostgreSQL
- **Render Service:** `roomieconnect-db`  
- **Type:** Managed PostgreSQL

The database acts as the system’s durable source of truth, storing users, groups, expenses, per-user split ledgers, and settlements. Ledger-based persistence ensures balances can always be recomputed accurately.

---

### 🔐 Environment & Secrets Management

- No secrets are committed to GitHub  
- `.env` files are used **only locally** and are excluded from version control  
- All production secrets are configured via **Render Environment Variables**  
- Separate environment configuration is maintained for frontend and backend services  

**Frontend (Render Static Site)**
```env
VITE_API_URL=https://roomieconnect-api.onrender.com/api
VITE_STRIPE_PUBLISHABLE_KEY=<publishable_key>
```

**Backend (Render Web Service)**
```env
DATABASE_URL=<render_postgres_url>
STRIPE_SECRET_KEY=<stripe_secret_key>
STRIPE_WEBHOOK_SECRET=<stripe_webhook_secret>
FRONTEND_ORIGIN=https://roomieconnect-web.onrender.com
PORT=8080
```

---

### 🔄 Deployment Flow

1. Code is pushed to GitHub  
2. Render automatically installs dependencies and builds services  
3. Environment variables are injected securely  
4. Frontend and backend deploy independently  
5. Frontend communicates with backend over HTTPS  
6. Backend connects to managed PostgreSQL via internal networking  

---

### 📈 Deployment Benefits

- Clean separation of frontend, API, and database  
- Secure secret handling with zero credential leakage  
- Stateless backend design enables horizontal scaling  
- CDN-backed static frontend for fast load times  
- CI/CD-ready workflow with automatic deployments on push  

---

## Reliability & Quality
- Consistent balance updates after expense edits, deletes, and settlements
- Global refresh mechanism ensures UI stays in sync
- Defensive checks for invalid splits and self-settlements
- Indexes ensure predictable performance for timelines and splits

---

## Security & Best Practices
- Passwords stored as bcrypt hashes
- Server-side validation and safe error responses
- Environment-based configuration (no secrets committed)
- Stripe webhook handling designed for retry safety

**Production hardening recommendations**
- JWT or session-based authentication
- Role-based authorization
- Rate limiting and request logging
- Managed secrets storage

---

## Future Enhancements
- JWT/session-based auth with refresh tokens
- Role-based access control
- Notifications (email/in-app)
- Advanced analytics and insights
- Mobile-friendly UX or native app
- Performance optimizations (pagination, batching)
- Observability and CI/CD integration
- Multi-currency support

---

## 👥 Team Contributions 

This project was **equally designed, implemented, and tested** by both:

- **@VenkataSriSaiSuryaMandava**  
  👉 https://github.com/VenkataSriSaiSuryaMandava

- **@DharmavaramRachana**  
  👉 https://github.com/DharmavaramRachana

Equal responsibilities included:
- Frontend architecture & UI/UX development (Vue 3 + Vuetify)
- Backend API design & implementation (Express.js)
- Database schema design & normalization (PostgreSQL)
- SQL development (DDL, DML, constraints, joins)
- Settlement and balance calculation logic
- Performance optimization & indexing
- Docker & environment configuration
- Server setup & reverse proxy configuration
- End-to-end testing & debugging
- Documentation & demo preparation
