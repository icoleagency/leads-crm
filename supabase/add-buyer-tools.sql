-- Buyer tools: verified cash-buyer profiles (purchase history), sign-up form answers, VIP flag.
-- Run ONCE in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.
alter table public.buyers add column if not exists profile jsonb not null default '{}'::jsonb;
create index if not exists buyers_phone_idx on public.buyers (phone);
create index if not exists buyers_email_idx on public.buyers (lower(email));
notify pgrst, 'reload schema';
