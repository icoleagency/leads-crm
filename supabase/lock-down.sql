-- WholesaleOS: make your data private.
-- After this runs, ONLY people with a WholesaleOS login (listed in crm_access) can read or change anything.
-- The public key in your website can no longer read your leads, buyers, or anything else.
--
-- BEFORE running: create your own login (Supabase -> Authentication -> Users -> Add user -> Create new user,
-- tick "Auto Confirm User"), then put that email on the line marked >>> below.
-- If the email doesn't match a login, the script stops and changes NOTHING.
-- Run in Supabase: SQL Editor -> + New query -> paste -> Run. Safe to re-run.

-- 1) Who may use the CRM, and as what.
create table if not exists public.crm_access (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'va' check (role in ('owner','va')),
  member_id bigint,                -- the VA's row in team_members (for VA logins)
  created_at timestamptz not null default now()
);
alter table public.crm_access enable row level security;
revoke all on public.crm_access from anon;

-- 1b) Make YOU the owner.
do $$
declare owner_email text := 'YOUR-LOGIN-EMAIL@example.com';   -- >>> put the email you sign in with here
begin
  insert into public.crm_access (user_id, email, role)
  select id, email, 'owner' from auth.users where lower(email) = lower(trim(owner_email))
  on conflict (user_id) do update set role = 'owner';
  if not exists (select 1 from public.crm_access where role = 'owner') then
    raise exception 'No login found for %. Create it in Authentication -> Users first (with Auto Confirm), then run this again. Nothing was changed.', owner_email;
  end if;
end $$;

-- 2) Helpers the policies use. SECURITY DEFINER so they can read crm_access without opening it up.
create or replace function public.crm_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.crm_access where user_id = auth.uid()
$$;
create or replace function public.is_crm_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crm_access where user_id = auth.uid())
$$;
revoke all on function public.crm_role() from public, anon;
revoke all on function public.is_crm_user() from public, anon;
grant execute on function public.crm_role() to authenticated;
grant execute on function public.is_crm_user() to authenticated;

-- crm_access: you can see your own row; owners see everyone. Changes go through the
-- team-access server function (service key), never straight from the browser.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='crm_access' loop
    execute format('drop policy %I on public.crm_access', p.policyname);
  end loop;
end $$;
create policy "own_row" on public.crm_access for select to authenticated
  using (user_id = auth.uid() or public.crm_role() = 'owner');

-- 3) Every CRM table: remove the old open policies, allow team members only.
do $$
declare t record; p record;
begin
  for t in select tablename from pg_tables where schemaname='public' and tablename <> 'crm_access' loop
    execute format('alter table public.%I enable row level security', t.tablename);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t.tablename loop
      execute format('drop policy %I on public.%I', p.policyname, t.tablename);
    end loop;
    execute format('create policy "team_only" on public.%I for all to authenticated using (public.is_crm_user()) with check (public.is_crm_user())', t.tablename);
    execute format('revoke all on public.%I from anon', t.tablename);
  end loop;
end $$;

-- 4) The list-removal function is only for signed-in team members.
do $$ begin
  if exists (select 1 from pg_proc where proname='remove_property_list') then
    revoke all on function public.remove_property_list(text) from public, anon;
    grant execute on function public.remove_property_list(text) to authenticated;
  end if;
end $$;

notify pgrst, 'reload schema';

-- Shows who has access now:
select email, role from public.crm_access order by role, email;
