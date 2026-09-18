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
- **This-week filter** — dated columns show only the current week (Mon–Sun); older dated tasks are hidden
- **Backlog column** — always pinned first (left of Today) for undated tasks; not hidden by the week filter
- Date-grouped columns with Today highlighted in brand blue; columns are independently scrollable on large screens
- **Stat cards** below the header: Planned hours · Done hours · Free hours remaining for today
- Column headers show task count, done/total hours, and a progress bar
- **Add Task modal** with title, hours, date, a **Save to backlog** checkbox (date optional when checked), and a custom project dropdown with live search
- Inline title editing — click any task title to edit
- Clickable project badge on each card to change the project instantly
- Hours badge opens an estimate edit panel (requires a reason when changing hours)
- Inline date chip on each card to move the task to another day or **Backlog** (locked once the task is completed)
- Task completion toggle
- Realtime sync via Supabase Postgres changes subscription

### Projects
- All roles can add and rename projects
- Case-insensitive duplicate prevention enforced on client and at the DB level (unique index on `lower(name)`)
- Delete restricted to Super Admin and HR Admin
- Project name shown as a badge on task cards and in the dashboard task list

### Reports
- **Period tabs** — Today / This Week / This Month; clicking a tab filters the task list and stat cards below in real time
- Expandable per-developer rows with:
  - Quick stats: Planned · Done · Free for the selected period
  - 6-month history cards — green if target met, red if missed, neutral for future/empty months
  - Monthly target = working days × 8h − leave hours taken
  - Task list filtered by the selected period with project, date, and hours columns
  - Task filter: All · Done · Pending
- **Role-based access**: developers see only their own report; HR Admin sees all except Super Admin; Super Admin sees everyone
- Search bar hidden for developer view (single-row)

### Settings *(Super Admin & HR Admin)*
- **Public Holidays** — add/remove holidays by date; auto-suppresses the daily target on those days
- **Developer Leaves** — log full-day or half-day (morning/afternoon) leave for any developer; deducted from the monthly target in Reports

### Team Management
- Full team roster with role badges and live workload status
- Super Admin can assign any role including SQA and UI/UX; HR Admin can assign developer-tier roles
- Role summary cards show combined developer-tier headcount (Developer + SQA + UI/UX)
- Actions column hidden from developer-tier users

### User Status
- Status picker in the navbar dropdown: Active · Away · Do Not Disturb · In a Meeting · On Leave · Vacation
- Date range picker for Vacation and On Leave statuses
- **On Leave auto-sync** — setting On Leave automatically inserts leave records for every weekday in the range; reverting removes future records while preserving past ones
- Flat CSS status dot on every avatar (reliable at all sizes, no emoji rendering issues)

### Available-to-Assist Signal
- Any developer can signal they are open to help from the navbar — sets a timed window (up to 8 h)
- Hours and minutes chosen from branded dropdowns; no native OS time picker
- Active assist shown as a pulsing green "Open to help · Xh Ym" chip on the developer's card, visible to the whole team
- Clicking the chip opens a two-step popup: **Update time** (adjusts the window) or **End availability** (clears it immediately)
- Timer counts down live and expires automatically

### Notifications
- In-app notification bell in the navbar with role-aware feed

---

## Roles

| Role | Access |
|------|--------|
| `super_admin` | Full access — all reports, settings, team management, delete projects |
| `hr_admin` | Settings, team management, reports (excluding super admins), delete projects |
| `developer` | My Tasks, own report, team view (read-only), projects (no delete) |
| `sqa` | Same access as `developer` |
| `ui_ux` | Same access as `developer` |

---

## Database Migrations

Run in order via the Supabase SQL editor (`supabase/migrations/`):

| File | Purpose |
|------|---------|
| `001_initial_schema.sql` | Core tables: profiles, projects, developer_roles, tasks; RLS policies |
| `002` – `006_features.sql` | Notifications, leave records, public holidays, status sync, idempotency fixes |
| `007_projects.sql` | Unique index on project names; delete RLS policy for admins |
| `008_leave_unique.sql` | Leave records schema fixes (rename date column, unique constraint) |
| `009_assist_until.sql` | Add `assist_until` timestamptz to profiles for the available-to-assist signal |
| `010_add_sqa_ui_ux_roles.sql` | Expand role check constraint to include `sqa` and `ui_ux`; update 3 RLS policies |
| `011_task_date_nullable.sql` | Make `tasks.task_date` nullable (`null` = backlog) |

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
