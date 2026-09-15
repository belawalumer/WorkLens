-- WorkLens schema — run in Supabase SQL editor (safe to re-run on fresh DB)

-- ─── Tables ───────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text not null,
  role text not null default 'developer' check (role in ('super_admin', 'hr_admin', 'developer')),
  created_at timestamptz default now()
);

create table public.projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamptz default now()
);

create table public.developer_roles (
  id uuid default gen_random_uuid() primary key,
  developer_id uuid references public.profiles on delete cascade not null,
  project_id uuid references public.projects on delete cascade not null,
  title text not null,
  unique(developer_id, project_id)
);

create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  developer_id uuid references public.profiles on delete cascade not null,
  project_id uuid references public.projects on delete set null,
  title text not null,
  estimated_hours numeric(4,1) not null default 0,
  completed boolean not null default false,
  task_date date not null default current_date,
  estimate_change_reason text,
  created_at timestamptz default now()
);

-- ─── Helper function (used by RLS policies) ───────────────────────────────────

create or replace function public.get_my_role()
returns text language sql security definer stable set search_path = ''
as $$ select role from public.profiles where id = auth.uid() $$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.developer_roles enable row level security;
alter table public.tasks enable row level security;

-- Profiles visibility:
--   super_admin → everyone | hr_admin → developers + hr_admins | developer → developers only
--   Always allowed to see own profile.
create policy "profiles_select" on public.profiles for select to authenticated using (
  id = auth.uid()
  or case public.get_my_role()
    when 'super_admin' then true
    when 'hr_admin'    then role in ('developer', 'hr_admin')
    else role = 'developer'
  end
);
create policy "profiles_insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
-- Own-profile updates only; role changes go through service-role admin client
create policy "profiles_update" on public.profiles for update to authenticated using (auth.uid() = id);

-- Projects: visible/writable to all authenticated users
create policy "projects_select" on public.projects for select to authenticated using (true);
create policy "projects_insert" on public.projects for insert to authenticated with check (true);
create policy "projects_update" on public.projects for update to authenticated using (true);

-- Developer roles: visible based on profile visibility; owner manages own
create policy "roles_select" on public.developer_roles for select to authenticated using (
  case public.get_my_role()
    when 'super_admin' then true
    when 'hr_admin'    then (select role from public.profiles where id = developer_id) in ('developer', 'hr_admin')
    else (select role from public.profiles where id = developer_id) = 'developer'
  end
);
create policy "roles_insert" on public.developer_roles for insert to authenticated with check (auth.uid() = developer_id);
create policy "roles_update" on public.developer_roles for update to authenticated using (auth.uid() = developer_id);
create policy "roles_delete" on public.developer_roles for delete to authenticated using (auth.uid() = developer_id);

-- Tasks visibility:
--   super_admin → everyone | hr_admin → developer + hr_admin tasks | developer → developer tasks only
create policy "tasks_select" on public.tasks for select to authenticated using (
  case public.get_my_role()
    when 'super_admin' then true
    when 'hr_admin'    then (select role from public.profiles where id = developer_id) in ('developer', 'hr_admin')
    else (select role from public.profiles where id = developer_id) = 'developer'
  end
);
create policy "tasks_insert" on public.tasks for insert to authenticated with check (auth.uid() = developer_id);
create policy "tasks_update" on public.tasks for update to authenticated using (auth.uid() = developer_id);
create policy "tasks_delete" on public.tasks for delete to authenticated using (auth.uid() = developer_id);

-- ─── Realtime ─────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.developer_roles;

-- ─── Notifications ────────────────────────────────────────────────────────────

create table public.notifications (
  id           uuid        default gen_random_uuid() primary key,
  user_id      uuid        references public.profiles(id) on delete cascade not null,
  message      text        not null,
  type         text        not null,
  read         boolean     default false,
  created_at   timestamptz default now()
);

alter table public.notifications enable row level security;

create policy "users can manage own notifications" on public.notifications
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─── Trigger: auto-create profile on signup ───────────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Super admin seed ─────────────────────────────────────────────────────────
-- Run AFTER Belawal, Hamza, and Ahsan have signed up:
--
-- update public.profiles set role = 'super_admin'
-- where email in ('belawal@yourcompany.com', 'hamza@yourcompany.com', 'ahsan@yourcompany.com');


-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRATION — run this block only if upgrading an existing WorkLens install
-- ════════════════════════════════════════════════════════════════════════════════

-- alter table public.profiles
--   add column if not exists role text not null default 'developer'
--     check (role in ('super_admin', 'hr_admin', 'developer'));
--
-- alter table public.tasks
--   add column if not exists estimate_change_reason text;
--
-- create or replace function public.get_my_role()
-- returns text language sql security definer stable set search_path = ''
-- as $$ select role from public.profiles where id = auth.uid() $$;
--
-- -- Replace old open policies with role-scoped ones:
-- drop policy if exists "profiles_select" on public.profiles;
-- drop policy if exists "tasks_select" on public.tasks;
-- drop policy if exists "roles_select" on public.developer_roles;
-- -- Then re-run the create policy statements above.
