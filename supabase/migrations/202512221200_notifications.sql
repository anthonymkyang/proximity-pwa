create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  type text not null,
  entity_type text,
  entity_id uuid,
  title text,
  body text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_at_idx
  on public.notifications (recipient_id, created_at desc);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications
  for select
  using (recipient_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications
  for update
  using (recipient_id = auth.uid());

create policy "notifications_insert_actor"
  on public.notifications
  for insert
  with check (actor_id = auth.uid());
