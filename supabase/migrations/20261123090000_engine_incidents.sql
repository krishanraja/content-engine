-- The engine's failure loop, part 1: capture (Krish, 2026-11-04: "how can your system autonomously understand the
-- difference between a repeated failure, why it happened, what was being done when the failure occurred and how it was
-- being done ... all of this stuff should feed an intelligent system that automatically gets more intelligent every
-- week"; then "yes, build part 1 and the weekly loop").
--
-- One row per thing that went wrong in production, written at the moment it happened, with what the session had read
-- first (its preflight receipt) so the weekly loop (scripts/learning/) can trace a repeat back to why it kept
-- happening. Writers: Krish's Reject presses on the publish board and a second round (apps/control-plane/api/board/
-- _presses.ts, api/content-ideas/[id]/making.ts), the Critic's block (scripts/velib/verdict.py), a lint override
-- (scripts/ve.py lint), a guard test that fails (scripts/check_failures.py --run). The Python writers go through
-- POST /api/learning/incidents. A row is a record of what happened; nothing here judges, sends or decides.
--
-- Service role only: no anon or authenticated access.

create table if not exists public.engine_incidents (
  id uuid primary key default gen_random_uuid(),
  at timestamptz not null default now(),
  piece_id uuid null,
  piece_path text null check (piece_path is null or length(piece_path) <= 300),
  stage text not null check (stage in ('brief', 'script', 'storyboard', 'style', 'proof', 'cut', 'package', 'post', 'board', 'session')),
  maker text not null default 'unknown' check (maker in ('claude', 'codex', 've', 'krish', 'unknown')),
  kind text not null check (kind in ('krish_reject', 'critic_block', 'override', 'guard_fired', 'second_round')),
  session_ref text null check (session_ref is null or length(session_ref) <= 300),
  skill text null check (skill is null or length(skill) <= 80),
  artifact_ref text null check (artifact_ref is null or length(artifact_ref) <= 500),
  artifact_sha256 text null check (artifact_sha256 is null or artifact_sha256 ~ '^[a-f0-9]{64}$'),
  his_words text null check (his_words is null or length(his_words) <= 2000),
  preflight jsonb null,
  brief_score numeric null,
  floor_groups text[] not null default '{}',
  failure_ids text[] not null default '{}',
  meta jsonb not null default '{}'::jsonb,
  -- The writer's own key for the same event, so a press saved again or a lint run twice files once.
  client_ref text null check (client_ref is null or length(client_ref) <= 120),
  created_at timestamptz not null default now()
);

-- A plain unique index (nulls stay distinct), so PostgREST's upsert on client_ref matches it.
create unique index if not exists engine_incidents_client_ref on public.engine_incidents (client_ref);
create index if not exists engine_incidents_at on public.engine_incidents (at desc);
create index if not exists engine_incidents_piece on public.engine_incidents (piece_id) where piece_id is not null;

alter table public.engine_incidents enable row level security;
revoke all on public.engine_incidents from public, anon, authenticated;
grant select, insert on public.engine_incidents to service_role;

comment on table public.engine_incidents is
  'The failure loop''s capture: one row per production failure at the moment it happened, with the preflight receipt then held. Written by the engine only (POST /api/learning/incidents and the board presses); read weekly by scripts/learning/.';
