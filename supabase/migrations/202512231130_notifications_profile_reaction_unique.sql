alter table public.notifications
  add constraint notifications_profile_reaction_unique
  unique (recipient_id, actor_id, type, entity_type, entity_id);
