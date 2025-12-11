-- Connections feature: base table plus per-type detail tables for contacts and pins.

-- Clean up: remove prior pin detail table if it exists (recreate below)
drop table if exists public.connection_pins cascade;

-- Base connections table
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('contact', 'pin')),
  title text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_interacted_at timestamptz
);

comment on table public.connections is 'User-owned connections shown on the Connections page.';
comment on column public.connections.type is 'Either contact or pin (pin = favorited profile).';
comment on column public.connections.owner_id is 'Auth user who owns the connection.';

create index if not exists connections_owner_idx on public.connections (owner_id);
create index if not exists connections_owner_type_idx on public.connections (owner_id, type);

-- Keep updated_at current
create or replace function public.set_connections_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_connections_updated_at on public.connections;
create trigger set_connections_updated_at
before update on public.connections
for each row execute function public.set_connections_updated_at();

-- Contacts detail (one-to-one with connections of type contact)
create table if not exists public.connection_contacts (
  connection_id uuid primary key references public.connections (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  display_name text,
  email text,
  phone text,
  handle text,
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.connection_contacts is 'Optional contact-specific fields for a connection.';
comment on column public.connection_contacts.profile_id is 'Linked profile if this contact is an in-app user.';

create index if not exists connection_contacts_profile_idx on public.connection_contacts (profile_id);

-- Pins detail (one-to-one with connections of type pin)
create table if not exists public.connection_pins (
  connection_id uuid primary key references public.connections (id) on delete cascade,
  pinned_profile_id uuid not null references public.profiles (id) on delete cascade,
  nickname text,
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.connection_pins is 'Pinned profiles for connections of type pin.';
comment on column public.connection_pins.pinned_profile_id is 'Profile that was pinned to create this connection.';

create index if not exists connection_pins_profile_idx on public.connection_pins (pinned_profile_id);

-- Ensure detail rows match their connection type
create or replace function public.ensure_connection_type()
returns trigger as $$
declare
  expected_type text := tg_argv[0];
  actual_type text;
begin
  select type into actual_type from public.connections where id = new.connection_id;
  if actual_type is null then
    raise exception 'connection % does not exist', new.connection_id;
  end if;
  if actual_type <> expected_type then
    raise exception 'connection % must be of type %', new.connection_id, expected_type;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists connection_contacts_enforce_type on public.connection_contacts;
create trigger connection_contacts_enforce_type
before insert or update on public.connection_contacts
for each row execute function public.ensure_connection_type('contact');

drop trigger if exists connection_pins_enforce_type on public.connection_pins;
create trigger connection_pins_enforce_type
before insert or update on public.connection_pins
for each row execute function public.ensure_connection_type('pin');

-- RLS
alter table public.connections enable row level security;
alter table public.connection_contacts enable row level security;
alter table public.connection_pins enable row level security;

-- Base table policies
drop policy if exists "connections_select_own" on public.connections;
create policy "connections_select_own" on public.connections
for select using (owner_id = auth.uid());

drop policy if exists "connections_insert_own" on public.connections;
create policy "connections_insert_own" on public.connections
for insert with check (owner_id = auth.uid());

drop policy if exists "connections_update_own" on public.connections;
create policy "connections_update_own" on public.connections
for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "connections_delete_own" on public.connections;
create policy "connections_delete_own" on public.connections
for delete using (owner_id = auth.uid());

-- Detail tables policies (gate through owning connection)
drop policy if exists "connection_contacts_owner_access" on public.connection_contacts;
create policy "connection_contacts_owner_access" on public.connection_contacts
for all using (
  exists (
    select 1 from public.connections c
    where c.id = connection_contacts.connection_id
      and c.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.connections c
    where c.id = connection_contacts.connection_id
      and c.owner_id = auth.uid()
  )
);

drop policy if exists "connection_pins_owner_access" on public.connection_pins;
create policy "connection_pins_owner_access" on public.connection_pins
for all using (
  exists (
    select 1 from public.connections c
    where c.id = connection_pins.connection_id
      and c.owner_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.connections c
    where c.id = connection_pins.connection_id
      and c.owner_id = auth.uid()
  )
);
