-- Migration 003: Notifications table
-- Each user owns their own notification rows (inserted client-side on realtime events).

create table public.notifications (
  id         uuid        default gen_random_uuid() primary key,
  user_id    uuid        references public.profiles(id) on delete cascade not null,
  message    text        not null,
  type       text        not null,
  read       boolean     default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

-- Users can only read/write their own notifications
create policy "notifications_all" on public.notifications
  for all to authenticated
  using     (user_id = auth.uid())
  with check (user_id = auth.uid());
