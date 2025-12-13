-- Message reactions table with RLS for conversation participants (or the sender).

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

comment on table public.message_reactions is 'Per-user reactions on a message.';
comment on column public.message_reactions.type is 'Reaction key (e.g., thumbs-up, heart).';

create index if not exists message_reactions_message_idx on public.message_reactions (message_id);
create index if not exists message_reactions_user_idx on public.message_reactions (user_id);

alter table public.message_reactions enable row level security;

-- Helper predicate: participant in the message's conversation or the sender.
-- (Inline in policies to avoid separate function requirement.)

drop policy if exists "message_reactions_select_participants" on public.message_reactions;
create policy "message_reactions_select_participants" on public.message_reactions
for select using (
  exists (
    select 1
    from public.messages m
    join public.conversation_members cm
      on cm.conversation_id = m.conversation_id
     where m.id = message_reactions.message_id
       and cm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.messages m
     where m.id = message_reactions.message_id
       and m.sender_id = auth.uid()
  )
);

drop policy if exists "message_reactions_mutate_participants" on public.message_reactions;
create policy "message_reactions_mutate_participants" on public.message_reactions
for all using (
  exists (
    select 1
    from public.messages m
    join public.conversation_members cm
      on cm.conversation_id = m.conversation_id
     where m.id = message_reactions.message_id
       and cm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.messages m
     where m.id = message_reactions.message_id
       and m.sender_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from public.messages m
    join public.conversation_members cm
      on cm.conversation_id = m.conversation_id
     where m.id = message_reactions.message_id
       and cm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.messages m
     where m.id = message_reactions.message_id
       and m.sender_id = auth.uid()
  )
);
