-- Migration 001: Initial schema
-- Tables: profiles, projects, developer_roles, tasks
-- Basic open-access policies (pre-RBAC)

create table public.profiles (
  id         uuid references auth.users on delete cascade primary key,
  full_name  text not null,
  email      text not null,
  created_at timestamptz default now()
);

create table public.projects (
  id         uuid default gen_random_uuid() primary key,
  name       text not null,
  created_at timestamptz default now()
);

create table public.developer_roles (
  id           uuid default gen_random_uuid() primary key,
  developer_id uuid references public.profiles on delete cascade not null,
  project_id   uuid references public.projects  on delete cascade not null,
  title        text not null,
  unique(developer_id, project_id)
);

create table public.tasks (
  id              uuid    default gen_random_uuid() primary key,
  developer_id    uuid    references public.profiles on delete cascade not null,
  project_id      uuid    references public.projects on delete set null,
  title           text    not null,
  estimated_hours numeric(4,1) not null default 0,
  completed       boolean not null default false,
  task_date       date    not null default current_date,
  created_at      timestamptz default now()
);

-- RLS (open read, owner write)
alter table public.profiles       enable row level security;
alter table public.projects       enable row level security;
alter table public.developer_roles enable row level security;
alter table public.tasks          enable row level security;

create policy "profiles_select"  on public.profiles       for select to authenticated using (true);
create policy "profiles_insert"  on public.profiles       for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update"  on public.profiles       for update to authenticated using (auth.uid() = id);

create policy "projects_select"  on public.projects       for select to authenticated using (true);
create policy "projects_insert"  on public.projects       for insert to authenticated with check (true);
create policy "projects_update"  on public.projects       for update to authenticated using (true);

create policy "roles_select"     on public.developer_roles for select to authenticated using (true);
create policy "roles_insert"     on public.developer_roles for insert to authenticated with check (auth.uid() = developer_id);
create policy "roles_update"     on public.developer_roles for update to authenticated using (auth.uid() = developer_id);
create policy "roles_delete"     on public.developer_roles for delete to authenticated using (auth.uid() = developer_id);

create policy "tasks_select"     on public.tasks           for select to authenticated using (true);
create policy "tasks_insert"     on public.tasks           for insert to authenticated with check (auth.uid() = developer_id);
create policy "tasks_update"     on public.tasks           for update to authenticated using (auth.uid() = developer_id);
create policy "tasks_delete"     on public.tasks           for delete to authenticated using (auth.uid() = developer_id);

-- Realtime
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.developer_roles;

-- Auto-create profile on signup
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
