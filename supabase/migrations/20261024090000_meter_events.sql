-- Cost guard G12 (docs/COST_GUARDS.md): which piece and which run a metered call was for.
--
-- meter_daily is one cell per provider, agent, day and model, keyed on exactly that, so it can say what the
-- fact gate cost on a day and never what one run cost. Putting a piece or run id into that key would split
-- every day into thousands of cells and break every reader that sums it. So the ids live here instead: one
-- row per self-metered call made inside a scope (api/_meter.ts `meterScope`), beside the daily cell the same
-- call still adds to. lastFactRunCost() reads the newest run's rows from here, and falls back to the daily
-- average while this table does not exist, so the code runs the same before and after this is applied.
--
-- Append-only by use: nothing updates or deletes a row. Written by the service role only.

create table if not exists public.meter_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  provider text not null,
  unit_key text not null,
  bucket text not null default '',
  piece_id text,
  run_id text,
  usd numeric not null default 0,
  units numeric not null default 0,
  failed boolean not null default false
);

create index if not exists meter_events_run_idx on public.meter_events (run_id) where run_id is not null;
create index if not exists meter_events_piece_idx on public.meter_events (piece_id, at desc) where piece_id is not null;
create index if not exists meter_events_unit_idx on public.meter_events (unit_key, at desc);

alter table public.meter_events enable row level security;

comment on table public.meter_events is
  'One row per self-metered call made for a piece or a run (cost guard G12). meter_daily keeps the day totals.';
