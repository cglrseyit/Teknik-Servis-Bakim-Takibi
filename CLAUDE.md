# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Teknik Servis & Bakım Takibi** — A hotel technical maintenance tracking system. Manages equipment, recurring maintenance plans, tasks, and technician assignments.

## Commands

### Backend (`backend/`)
```bash
npm install          # install dependencies
npm run dev          # start with nodemon (development)
npm start            # start without hot-reload (production)
npm run migrate      # run db/migrate.js
```

### Frontend (`frontend/`)
```bash
npm install          # install dependencies
npm run dev          # Vite dev server (default: http://localhost:5173)
npm run build        # production build → frontend/dist/
npm run lint         # ESLint
```

### Database setup
```bash
# 1. Create DB and run base schema
psql $DATABASE_URL -f backend/db/schema.sql

# 2. Apply incremental migrations in order
psql $DATABASE_URL -f backend/db/migrate_roles.sql
psql $DATABASE_URL -f backend/db/migrate_v2.sql
psql $DATABASE_URL -f backend/db/migrate_v3.sql

# 3. Optional: seed initial data
psql $DATABASE_URL -f backend/db/seed.sql
```

### Environment setup
```bash
cp backend/.env.example backend/.env
# Then fill in: PORT, DATABASE_URL, JWT_SECRET, NODE_ENV
```

For local frontend dev, create `frontend/.env.local`:
```
VITE_API_URL=http://localhost:5000/api
```

## Architecture

**Monorepo with separate backend and frontend.** In production (Railway/Nixpacks via `railway.toml`/`nixpacks.toml`), the backend serves the frontend's built `dist/` folder as static files.

### Backend — Express + PostgreSQL

- **Entry:** `backend/src/app.js` — registers all routes, mounts two cron jobs (midnight task generation + 08:00 notification push), runs startup fixes (overdue sync + task pre-generation) on every boot.
- **Auth:** JWT Bearer tokens. `authenticate` middleware validates token; `requireRole(...roles)` enforces RBAC. Three roles: `admin`, `teknik_muduru`, `order_taker`.
- **Database:** Raw `pg` pool, no ORM. Connection config in `backend/src/config/db.js`. Schema-altering `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` lines in `app.js` run on every startup as a lightweight migration safety net — don't rely on them for new columns, use proper SQL migration files instead.
- **Task generation logic** (`backend/src/services/taskGenerator.js`): Core business logic. Generates future `maintenance_tasks` from `maintenance_plans`. Month-based frequencies (monthly/quarterly/yearly) snap to **month-end dates**. Yearly plans can be locked to a specific calendar month via `target_month`. One-time plans (`is_one_time=true`) are excluded from auto-generation.

### Data model relationships
```
users → (assigned_to / completed_by in maintenance_tasks)
equipment → maintenance_plans → maintenance_tasks
maintenance_tasks → notifications
all entities → audit_logs
```

### Frontend — React 19 + Vite + Tailwind

- **Routing:** `react-router-dom` v7; all routes in `frontend/src/App.jsx`. Role-based access via `ProtectedRoute` wrapper.
- **API:** Single axios instance in `frontend/src/api/axios.js`. Reads `VITE_API_URL` env var; falls back to `/api` (works when backend serves frontend in production). Auto-attaches JWT from `localStorage`; on 401 clears storage and redirects to `/login`.
- **State:** No global state library. Auth state in `AuthContext`, toasts in `ToastContext`. Per-page local state only.
- **UI components:** Radix UI primitives wrapped in `frontend/src/components/ui/`. Charts via Recharts in `ReportsPage`.

### Cron behavior
- **00:00 Istanbul:** `generateAllActivePlans()` creates upcoming tasks → then batch-updates pending tasks due today to `in_progress`, and past-due pending to `overdue`.
- **08:00 Istanbul:** `generateNotifications()` creates 3-day-ahead reminder notifications.
- Same overdue fix also runs at server startup.

## Key business rules

- Notification advance notice is hardcoded to **3 days** (not user-configurable).
- Tasks visible to users are only "upcoming" (due within 3 days) and "today/overdue" — not all future tasks.
- `maintenance_period` on `equipment` is a display field only; scheduling is driven by `maintenance_plans.frequency_type`.
- `migrate_v3.sql` shifts all pending task dates to month-end — only run once on an existing DB.
