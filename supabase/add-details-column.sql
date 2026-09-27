-- Adds the flexible "details" column that stores property condition,
-- repair flags, and seller intel for the Call Card.
--
-- Run this ONCE in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run; it does nothing if the column already exists.

alter table public.leads
  add column if not exists details jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
