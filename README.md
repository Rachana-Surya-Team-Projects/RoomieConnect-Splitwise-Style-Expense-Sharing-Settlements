# RoomieConnect — Splitwise-Style Expense Sharing & Settlements

RoomieConnect is a **production-style, full-stack expense sharing platform** inspired by Splitwise. It enables roommates and groups to **track shared expenses**, apply **flexible split rules**, compute **real-time balances**, and complete **settlement workflows** (manual and Stripe-backed) with an auditable activity trail.

Built with a clean separation between **Vue 3 SPA**, **Express REST APIs**, and a **PostgreSQL ledger-first schema**, RoomieConnect emphasizes **data consistency**, **maintainable modular architecture**, and **deployment-ready containerization**.

---

## Project Overview

RoomieConnect helps small groups answer the questions that break shared living and group travel finances:
- Who paid for what?
- How should the cost be split fairly (equal / custom / percent / shares)?
- Who owes whom right now?
- What changed after an expense edit or a settlement?
- Can we settle up cleanly and see a trustworthy history?

The system is designed for **roommates**, **friends**, **travel groups**, and **recurring bill sharing** where correctness, transparency, and UX clarity matter.

---

## Problem Statement & Motivation

Most shared-expense tracking breaks down due to:
- inconsistent split logic,
- unclear reconciliation after edits,
- and balances that don’t reliably reflect settlements.

RoomieConnect solves this with a **ledger-style persistence model**:
- each expense produces durable per-user allocations (`expense_splits`),
- each settle-up produces durable settlement records (`settlements`),
- and balances are computed from these sources of truth so the UI remains consistent across pages after any mutation.

---

## Key Features

- **Authentication**
  - Email/password registration & login
  - Secure password hashing with **bcrypt**
  - Auth-aware routing (Auth layout vs App shell)

- **Group Management**
  - Create groups and manage members
  - Join groups via **join/invite codes**
  - Automatic creation of a **Personal** group on registration

- **Expense Tracking**
  - Create expenses with: description, amount, payer, date, participants
  - Split types implemented end-to-end:
    - **Equal**
    - **Unequal (custom amounts)**
    - **Percent**
    - **Shares**
  - Split ledger stored per user for accurate balance reconciliation

- **Expense Details + Edit Expense**
  - Expense detail view with payer + split breakdown
  - **Edit Expense** flow (route-driven) supporting all split types
  - Delete expense support

- **Balances & Reconciliation**
  - Group balances computed from expense splits + settlements
  - Consistent state updates across **Dashboard, Activity, Friends, Groups, Balances, Transactions** after edits and settle-ups

- **Settlement Workflows**
  - Manual settle-ups
  - Optional **Stripe PaymentIntent** settle-ups with webhook confirmation
  - Transaction history for settlements (manual + Stripe)

- **Activity & Transparency**
  - Activity feed reflecting expense creation/updates and settle-ups
  - Transactions tab for a clean settlement ledger view

- **UX Quality**
  - Vuetify-driven, consistent UI components
  - Default **dark theme** with persistence
  - Loading/error states to support user-friendly failures

---

## Tech Stack

### Frontend
- **Vue 3** (SPA)
- **Vite** (build + dev server)
- **Vuetify** (Material Design UI system)
- **Vue Router** (route-driven pages, layouts, and guarded flows)
- REST API integration pattern for clean frontend/backend separation
- Lightweight global refresh coordination (`client/src/refresh.js`) to maintain cross-page consistency after mutations

### Backend
- **Node.js + Express**
- Modular **RESTful API** routing by domain (auth, groups, expenses, dashboard, payments)
- **pg** connection pool for PostgreSQL access
- Optional Stripe integration via **Stripe Node SDK**
- Consistent HTTP status codes and safe error responses

### Database
- **PostgreSQL**
- Normalized, ledger-first schema supporting reliable recomputation:
  - users, groups, group_members
  - expenses, expense_splits (per-user allocations)
  - settlements (manual + Stripe-backed)

### Infrastructure / DevOps
- **Docker + Docker Compose** (local and production-style)
- **Caddy reverse proxy** for production-like single-domain routing:
  - serves the SPA
  - proxies `/api/*` to the backend

---

## System Architecture

RoomieConnect is structured as a scalable, maintainable full-stack system:

- **Client (Vue SPA)**: UI orchestration, form validation, routing, and user workflows (expenses, edits, settlements).
- **Server (Express)**: REST API layer, business rules, settlement and split calculations, DB orchestration.
- **PostgreSQL**: durable source of truth using ledger tables for correctness and auditability.
- **Reverse Proxy (Caddy)**: production-style routing under a single origin for clean deployments.

**Scalability & maintainability**
- Modular routes reduce coupling and support feature growth
- Ledger model enables analytics and historical correctness
- Containerized infrastructure supports CI/CD-ready deployments

---

## Data Flow & API Design

### Frontend ↔ Backend Communication
- The SPA communicates exclusively via **RESTful APIs** under `/api/*`.
- Write operations (create/edit/delete/settle) are followed by targeted refetch and a shared refresh signal, keeping the UI consistent across all pages.

### High-Level API Domains
- **Auth**: registration, login
- **Groups**: create, join via code, membership reads
- **Expenses**: CRUD + split persistence
- **Payments/Settlements**: manual settle-ups, optional Stripe PaymentIntent + webhook
- **Dashboard**: aggregates and friends balances (includes settlements)

---

## Database Design & Schema Philosophy

### Ledger-First Consistency
RoomieConnect stores:
- **Expense allocations** as durable per-user rows in `expense_splits`
- **Settlements** as durable rows in `settlements`

This avoids UI-only reconciliation and ensures balances can always be recomputed correctly from persistent facts.

### Normalization & Relationships
- `group_members` maps users ↔ groups (many-to-many)
- `expenses` stores headers; `expense_splits` stores allocations
- `settlements` records settle-up transfers; optional Stripe metadata supports idempotency

### Transaction Safety
- User registration performs multi-step writes using a DB transaction to ensure consistent onboarding (user + personal group + membership).

---

## Folder Structure (Expanded)

Below is the fully expanded repository tree (based on the ZIP contents). Each layer exists to keep the system modular, scalable, and deployment-friendly.

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

### Key Architectural Notes
- **`client/`** contains the Vue 3 SPA, organized by components, layouts, router, and shared refresh coordination.
- **`server/`** contains the Express API, domain-routed modules, DB access, and scripts for schema bootstrap and seeding.
- **`docker-compose*.yml` + `Caddyfile`** enable containerized development and production-style deployment patterns.

---

## Setup & Installation

### Prerequisites
- Node.js 18+
- Docker + Docker Compose
- (Optional) Stripe keys for Stripe settle-ups

### Environment Variables (names only)
**Server**
- `DATABASE_URL`
- `FRONTEND_ORIGIN`
- `PORT`
- `STRIPE_SECRET_KEY` (optional)
- `STRIPE_WEBHOOK_SECRET` (optional)

**Client**
- `VITE_API_URL` (API base URL used by the frontend)
- `VITE_STRIPE_PUBLISHABLE_KEY` (optional)

### Run Locally (Docker — Recommended)
```bash
docker compose up --build
```
- Frontend: http://localhost:5173  
- Backend: http://localhost:8080  

### Production-Style Stack (Reverse Proxy + SPA)
```bash
docker compose -f docker-compose.prod.yml up --build
```
> Update the host in `Caddyfile` (e.g., `yourdomain.com`) before deploying.

---

## Reliability, Performance & Error Handling

- Ledger-based persistence ensures balances remain correct after edits and settlements
- App-wide refresh signaling prevents stale UI state after writes
- API returns safe error messages and appropriate status codes
- Database schema bootstrap ensures environments remain reproducible across local/dev/prod
- Index-friendly access patterns support timeline reads and split lookups as data grows

---

## Security & Best Practices

- Passwords stored as **bcrypt hashes** (never plaintext)
- Environment-based configuration (no secrets hardcoded in source)
- Controlled CORS via `FRONTEND_ORIGIN`
- Production-ready considerations:
  - add JWT/session cookies and group-level authorization
  - implement rate limiting, request logging, and stricter validation
  - store secrets in a managed vault (AWS SSM/Secrets Manager, Render secrets, etc.)

---

## Future Enhancements

- Hardened auth (JWT/session cookies + refresh tokens)
- Role-based permissions (group admins, member controls)
- Notifications (in-app/email) for expenses and settle-ups
- Analytics (spend trends, categories, insights)
- Mobile-first UI and/or native mobile client
- Performance improvements (pagination, query batching, caching)
- Observability (structured logs, metrics dashboards, health checks)
- CI/CD pipeline integration for automated deployments

---

## 👥 Team Contributions

This project was **equally designed, implemented, and tested** by both:

- **@VenkataSriSaiSuryaMandava**  
  👉 https://github.com/VenkataSriSaiSuryaMandava

- **@DharmavaramRachana**  
  👉 https://github.com/DharmavaramRachana

Equal responsibilities included:
- Frontend architecture & UI/UX development (Vue 3 + Vuetify)
- Backend API design & implementation (Express.js, RESTful endpoints)
- Database schema design & normalization (PostgreSQL)
- SQL development (DDL, DML, constraints, joins) and balance reconciliation queries
- Settlement & balance calculation logic (expense splits + settle-ups)
- Performance optimization & indexing strategy (ledger-first access patterns)
- Docker & environment configuration (local + production-style compose)
- Server setup & reverse proxy configuration (Caddy for SPA + `/api` routing)
- End-to-end testing & debugging across the full stack
- Documentation & demo preparation for recruiter/hiring-manager review
