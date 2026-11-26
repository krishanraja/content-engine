create table public.hub_snapshots (
  edition_date date primary key,
  payload jsonb not null,
  revision uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  check ((payload->>'edition_date')::date is not distinct from edition_date
    and (payload @> '{"ok":true,"version":1}')
    and jsonb_typeof(payload->'items') is not distinct from 'array'
    and jsonb_array_length(payload->'items') between 8 and 12)
);

create table public.hub_price_closes (
  symbol text not null,
  day date not null,
  currency text not null,
  price numeric not null check (price > 0),
  primary key (day, symbol)
);

create table public.hub_feed_health (
  url text primary key,
  checked_on date not null,
  empty_since date,
  retry_on date
);

create table public.hub_runs (
  day date not null,
  mode text not null check (mode in ('daily','prices')),
  attempts integer not null default 1,
  lease_until timestamptz not null,
  complete boolean not null default false,
  primary key (day, mode)
);

alter table public.hub_snapshots enable row level security;
alter table public.hub_price_closes enable row level security;
alter table public.hub_feed_health enable row level security;
alter table public.hub_runs enable row level security;
revoke all on public.hub_snapshots, public.hub_price_closes, public.hub_feed_health, public.hub_runs from public, anon, authenticated;
grant select, insert, update on public.hub_snapshots, public.hub_price_closes, public.hub_feed_health, public.hub_runs to service_role;

-- Longer than the function's maximum lifetime. A duplicate cron cannot pay twice.
create function public.hub_claim_run(run_day date, run_mode text)
returns boolean language sql security invoker set search_path = '' as $$
  with claimed as (
    insert into public.hub_runs as r (day, mode, lease_until)
    values (run_day, run_mode, now() + interval '11 minutes')
    on conflict (day, mode) do update
      set attempts = r.attempts + 1, lease_until = excluded.lease_until
      where not r.complete and r.attempts < 2 and r.lease_until <= now()
    returning 1
  ) select exists (select from claimed);
$$;
revoke all on function public.hub_claim_run(date,text) from public, anon, authenticated;
grant execute on function public.hub_claim_run(date,text) to service_role;
