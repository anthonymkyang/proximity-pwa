create table if not exists public.connection_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists connection_categories_owner_idx
  on public.connection_categories (owner_id);

create unique index if not exists connection_categories_owner_name_idx
  on public.connection_categories (owner_id, lower(name));

alter table public.connection_categories enable row level security;

create policy "connection_categories_select_own"
  on public.connection_categories
  for select
  using (owner_id = auth.uid());

create policy "connection_categories_insert_own"
  on public.connection_categories
  for insert
  with check (owner_id = auth.uid());

create policy "connection_categories_update_own"
  on public.connection_categories
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "connection_categories_delete_own"
  on public.connection_categories
  for delete
  using (owner_id = auth.uid());

alter table public.connections
  add column if not exists category_id uuid references public.connection_categories(id)
  on delete set null;

create index if not exists connections_category_idx
  on public.connections (category_id);
