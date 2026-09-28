-- List Stacking: every property from every list you upload, deduped by address,
-- with a "stack" count = how many different list types it shows up on.
-- Run ONCE in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run. Safe to re-run.

create table if not exists public.property_lists (
  id bigint generated always as identity primary key,
  name text not null,
  type text not null,
  source text,
  campaign text,
  rows_in_file int not null default 0,
  new_count int not null default 0,
  stacked_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.properties (
  id bigint generated always as identity primary key,
  addr_key text not null unique,
  address text not null,
  city text,
  state text,
  zip text,
  county text,
  owner_name text,
  mailing text,
  phones text[] not null default '{}',
  emails text[] not null default '{}',
  lists jsonb not null default '[]'::jsonb,
  list_ids text[] not null default '{}',
  list_types text[] not null default '{}',
  stack int generated always as (cardinality(list_types)) stored,
  has_phone boolean generated always as (cardinality(phones) > 0) stored,
  campaign text,
  data jsonb not null default '{}'::jsonb,
  lead_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists properties_stack_idx on public.properties (stack desc);
create index if not exists properties_list_types_idx on public.properties using gin (list_types);
create index if not exists properties_list_ids_idx on public.properties using gin (list_ids);

-- Removes one uploaded list from every property; properties left on no list
-- (and not already sent to Leads) are deleted.
create or replace function public.remove_property_list(p_list text) returns void
language plpgsql as $$
begin
  update public.properties p set
    lists = f.l, list_ids = array_remove(p.list_ids, p_list), list_types = f.t, updated_at = now()
  from (
    select pr.id,
      coalesce(jsonb_agg(x) filter (where x->>'list_id' <> p_list), '[]'::jsonb) as l,
      coalesce(array_agg(distinct x->>'type') filter (where x->>'list_id' <> p_list), '{}') as t
    from public.properties pr, jsonb_array_elements(pr.lists) x
    where p_list = any(pr.list_ids)
    group by pr.id
  ) f
  where p.id = f.id;
  delete from public.properties where cardinality(list_ids) = 0 and lead_id is null;
  delete from public.property_lists where id::text = p_list;
end $$;

-- Same open access as the rest of the app (no login right now).
alter table public.properties enable row level security;
alter table public.property_lists enable row level security;
drop policy if exists "open_access" on public.properties;
drop policy if exists "open_access" on public.property_lists;
create policy "open_access" on public.properties for all to anon, authenticated using (true) with check (true);
create policy "open_access" on public.property_lists for all to anon, authenticated using (true) with check (true);
grant execute on function public.remove_property_list(text) to anon, authenticated;

notify pgrst, 'reload schema';
