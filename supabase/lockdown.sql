-- WholesaleOS database lockdown
-- Run this in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- ORDER MATTERS:
--   1. First create your user(s): Dashboard -> Authentication -> Users -> Add user
--      (create one for yourself and one per teammate; use "Auto Confirm User")
--   2. Deploy the app version with the login screen and confirm you can sign in
--   3. THEN run this script. After it runs, only signed-in users can touch data.

-- Turn on row-level security (blocks all access except through policies)
alter table public.leads enable row level security;
alter table public.academy_progress enable row level security;

-- Drop any old permissive policies if they exist (ignore errors if names differ;
-- check Dashboard -> Authentication -> Policies and remove any anon policies by hand)
drop policy if exists "Enable all for anon" on public.leads;
drop policy if exists "Enable all for anon" on public.academy_progress;

-- Signed-in team members get full access
create policy "authenticated_all_leads"
  on public.leads for all
  to authenticated
  using (true) with check (true);

create policy "authenticated_all_academy"
  on public.academy_progress for all
  to authenticated
  using (true) with check (true);
