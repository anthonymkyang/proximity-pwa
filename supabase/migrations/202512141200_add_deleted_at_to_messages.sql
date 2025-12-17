-- Add soft delete support to messages table
alter table public.messages add column if not exists deleted_at timestamptz;

comment on column public.messages.deleted_at is 'Timestamp when message was soft deleted; null if not deleted.';
