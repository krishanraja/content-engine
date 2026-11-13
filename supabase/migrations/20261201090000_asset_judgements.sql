-- content-engine's 10/10 judges on every Growth carousel and Short (Ruling, Krish, 2026-11-12: "Judge them; count
-- passes. Every Growth carousel goes through the same 10/10 judges, and each one that passes and goes live counts.").
--
-- One append-only ledger, written only by POST /api/board/<Monday>/judge on Growth's key or the operator's
-- (apps/control-plane/api/board/_judge.ts):
--   judged  the panel's verdict on one derived post, bound to its artifact (format, channel, exact words, each
--           picture's sha256), with every judge's score and the one fix of each that did not pass;
--   bound   a passing verdict tied to the Buffer post Growth saved for it;
--   live    that post gone out, with its link: only ever for a bound artifact.
-- Control Center's reader for content-engine's North Star counts each artifact whose latest verdict is a pass and that
-- went live in the last 7 days (api/_mymuReaders.ts judgedLiveCount).
--
-- Additive only: one table, its indexes and its refusal of update, delete and truncate. Re-runnable.
-- Undo: drop table public.asset_judgements; drop function public.asset_judgements_refuse().
create table if not exists public.asset_judgements (
  id uuid primary key default gen_random_uuid(),
  event text not null check (event in ('judged', 'bound', 'live')),
  artifact_sha256 text not null check (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  item text check (item is null or char_length(item) between 1 and 200),
  week date,
  format text check (format is null or format in ('carousel', 'short-video')),
  channel text check (channel is null or channel ~ '^[a-z][a-z0-9-]{0,30}$'),
  concept_id text check (concept_id is null or char_length(concept_id) <= 200),
  verdict text check (verdict is null or verdict in ('pass', 'fail')),
  score numeric(4, 2) check (score is null or (score >= 0 and score <= 10)),
  band text check (band is null or char_length(band) <= 40),
  reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(reasons) = 'array'),
  judges jsonb not null default '[]'::jsonb check (jsonb_typeof(judges) = 'array'),
  roster_version text check (roster_version is null or roster_version ~ '^[a-z0-9][a-z0-9._-]{0,39}$'),
  cost_usd numeric(10, 4) not null default 0 check (cost_usd >= 0),
  buffer_post_id text check (buffer_post_id is null or buffer_post_id ~ '^[A-Za-z0-9_-]{6,64}$'),
  payload_sha256 text check (payload_sha256 is null or payload_sha256 ~ '^[a-f0-9]{64}$'),
  url text check (url is null or (char_length(url) <= 2048 and url ~ '^https://')),
  live_at timestamptz,
  judged_at timestamptz,
  written_by text not null check (char_length(written_by) between 1 and 80),
  created_at timestamptz not null default now(),
  constraint asset_judgements_judged check (event <> 'judged' or (verdict is not null and judged_at is not null and format is not null and roster_version is not null)),
  constraint asset_judgements_bound check (event <> 'bound' or buffer_post_id is not null),
  constraint asset_judgements_live check (event <> 'live' or (buffer_post_id is not null and url is not null and live_at is not null))
);
create index if not exists asset_judgements_artifact_idx on public.asset_judgements (artifact_sha256, event, created_at desc);
create index if not exists asset_judgements_post_idx on public.asset_judgements (buffer_post_id) where buffer_post_id is not null;
create index if not exists asset_judgements_live_idx on public.asset_judgements (event, live_at desc);
create unique index if not exists asset_judgements_one_live on public.asset_judgements (artifact_sha256, buffer_post_id) where event = 'live';

create or replace function public.asset_judgements_refuse() returns trigger
language plpgsql as $$
begin
  raise exception 'asset_judgements is append only: a verdict is never changed or removed';
end $$;
drop trigger if exists asset_judgements_no_update on public.asset_judgements;
create trigger asset_judgements_no_update before update or delete on public.asset_judgements for each row execute function public.asset_judgements_refuse();
drop trigger if exists asset_judgements_no_truncate on public.asset_judgements;
create trigger asset_judgements_no_truncate before truncate on public.asset_judgements for each statement execute function public.asset_judgements_refuse();

alter table public.asset_judgements enable row level security;
revoke all on public.asset_judgements from anon, authenticated;
comment on table public.asset_judgements is
  'content-engine''s 10/10 judges on Growth''s carousels and Shorts: judged, bound to a Buffer post, live. Append only; written by POST /api/board/<Monday>/judge.';
