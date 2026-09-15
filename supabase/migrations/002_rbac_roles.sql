-- Migration 002: RBAC — roles, role-scoped RLS, estimate change reason
-- Run this on an existing install that has migration 001 applied.

-- Add role column to profiles
alter table public.profiles
  add column if not exists role text not null default 'developer'
    check (role in ('super_admin', 'hr_admin', 'developer'));

-- Add estimate change reason to tasks
alter table public.tasks
  add column if not exists estimate_change_reason text;

-- Security definer function to read caller's role (used by RLS)
create or replace function public.get_my_role()
returns text language sql security definer stable set search_path = ''
as $$ select role from public.profiles where id = auth.uid() $$;

-- Replace open select policies with role-scoped ones
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "tasks_select"    on public.tasks;
drop policy if exists "roles_select"    on public.developer_roles;

-- Profiles: super_admin → all | hr_admin → developer+hr_admin | developer → developer only + self
create policy "profiles_select" on public.profiles for select to authenticated using (
  id = auth.uid()
  or case public.get_my_role()
    when 'super_admin' then true
    when 'hr_admin'    then role in ('developer', 'hr_admin')
    else role = 'developer'
  end
);

-- Tasks: super_admin → all | hr_admin → developer+hr_admin tasks | developer → developer tasks
create policy "tasks_select" on public.tasks for select to authenticated using (
  case public.get_my_role()
    when 'super_admin' then true
    when 'hr_admin'    then (select role from public.profiles where id = developer_id) in ('developer', 'hr_admin')
    else (select role from public.profiles where id = developer_id) = 'developer'
  end
);

-- Developer roles: same scoping as tasks
create policy "roles_select" on public.developer_roles for select to authenticated using (
  case public.get_my_role()
    when 'super_admin' then true
    when 'hr_admin'    then (select role from public.profiles where id = developer_id) in ('developer', 'hr_admin')
    else (select role from public.profiles where id = developer_id) = 'developer'
  end
);

-- Promote initial super admins (replace emails with actual values and run manually):
-- update public.profiles set role = 'super_admin'
-- where email in ('belawal@kodesinc.com', 'hamza@kodesinc.com', 'ahsan@kodesinc.com');
