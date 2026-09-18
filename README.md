# WorkLens

**WorkLens** is a developer workload tracker and team dashboard built for engineering teams. It gives managers and HR a real-time view of who's doing what, tracks daily task hours, manages leave, and helps keep the whole team in sync.

🌐 **Live:** [work-lens-kappa.vercel.app](https://work-lens-kappa.vercel.app)

---

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| Database & Auth | Supabase (PostgreSQL + RLS + Realtime) |
| Styling | Tailwind CSS |
| Data fetching | SWR |
| Deployment | Vercel |

---

## Features

### Team Dashboard
- Real-time overview of the entire team's workload
- Stat cards: team size, average load today, free capacity, overloaded count
- Stat card tooltips showing per-developer breakdown (full names)
- **Status distribution** — Overloaded / Occupied / Underloaded / Available counts with progress bars
- **Public holiday banner** — shows today's holiday name; suppresses inactive-dev alerts on holidays
- **Inactive developer alerts** — highlights devs with no tasks logged after noon PKT (hidden on weekends and holidays)
- **WhatsApp reminder button** — sends a pre-filled task reminder to any dev with a WhatsApp number on file
- Filter tabs: All · Available · Occupied · Underloaded · Overloaded
- Developer cards showing name, role, workload status badge, planned hours, free hours, task count, workload bar, and task list with project tags

### My Tasks — Kanban Board
- Date-grouped columns with Today highlighted in brand blue
- Column headers show task count, done/total hours, and a progress bar
- **Add Task modal** with title, hours, date, and a custom project dropdown with live search
- Inline title editing — click any task title to edit
- Clickable project badge on each card to change the project instantly
- Hours badge opens an estimate edit panel (requires a reason when changing hours)
- Inline date chip on each card to move the task to any other day (locked once the task is completed)
- Task completion toggle
- Realtime sync via Supabase Postgres changes subscription
- Today's summary bar: planned · done · free hours

### Projects
- All roles can add and rename projects
- Case-insensitive duplicate prevention enforced on client and at the DB level (unique index on `lower(name)`)
- Delete restricted to Super Admin and HR Admin
- Project name shown as a badge on task cards and in the dashboard task list

### Reports
- Expandable per-developer rows with:
  - Quick stats: Today · This Week · This Month
  - 6-month history cards — green if target met, red if missed, neutral for future/empty months
  - Monthly target = working days × 8h − leave hours taken
  - Task list for the current month with project, date, and hours columns
  - Task filter: All · Done · Pending
- **Role-based access**: developers see only their own report; HR Admin sees all except Super Admin; Super Admin sees everyone
- Search bar hidden for developer view (single-row)

### Settings *(Super Admin & HR Admin)*
- **Public Holidays** — add/remove holidays by date; auto-suppresses the daily target on those days
- **Developer Leaves** — log full-day or half-day (morning/afternoon) leave for any developer; deducted from the monthly target in Reports

### Team Management
- Full team roster with role badges and live workload status
- Super Admin and HR Admin can promote/change roles
- Actions column hidden from developer view

### User Status
- Status picker in the navbar dropdown: Active · Away · Do Not Disturb · In a Meeting · On Leave · Vacation
- Date range picker for Vacation and On Leave statuses
- **On Leave auto-sync** — setting On Leave automatically inserts leave records for every weekday in the range; reverting removes future records while preserving past ones
- Flat CSS status dot on every avatar (reliable at all sizes, no emoji rendering issues)

### Notifications
- In-app notification bell in the navbar with role-aware feed

---

## Roles

| Role | Access |
|------|--------|
| `super_admin` | Full access — all reports, settings, team management, delete projects |
| `hr_admin` | Settings, team management, reports (excluding super admins), delete projects |
| `developer` | My Tasks, own report, team view (read-only), projects (no delete) |

---

## Database Migrations

Run in order via the Supabase SQL editor (`supabase/migrations/`):

| File | Purpose |
|------|---------|
| `001_initial_schema.sql` | Core tables: profiles, projects, developer_roles, tasks; RLS policies |
| `002` – `006_features.sql` | Notifications, leave records, public holidays, status sync, idempotency fixes |
| `007_projects.sql` | Unique index on project names; delete RLS policy for admins |

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template and fill in Supabase credentials
cp .env.example .env.local

# 3. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
