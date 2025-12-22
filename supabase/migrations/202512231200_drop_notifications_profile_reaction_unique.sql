alter table public.notifications
  drop constraint if exists notifications_profile_reaction_unique;
