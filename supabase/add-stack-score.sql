-- List Stacking upgrade: smart score + filter columns (equity, value, owner type, years owned,
-- out-of-state / absentee owner, filing date). Run ONCE in Supabase SQL Editor. Safe to re-run.

alter table public.properties add column if not exists score int;
alter table public.properties add column if not exists equity_pct int;
alter table public.properties add column if not exists est_value numeric;
alter table public.properties add column if not exists owner_type text;
alter table public.properties add column if not exists years_owned int;
alter table public.properties add column if not exists out_of_state boolean not null default false;
alter table public.properties add column if not exists absentee boolean not null default false;
alter table public.properties add column if not exists filed_on date;

create index if not exists properties_score_idx on public.properties (score desc nulls last);
create index if not exists properties_filed_idx on public.properties (filed_on desc nulls last);

notify pgrst, 'reload schema';
