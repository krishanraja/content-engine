-- Evidence from a failed run, so a failure does not have to be reproduced by
-- hand against live data to be understood.
--
-- Two inspiration_scan runs failed on 2026-09-08 recording `counts: {}` and a
-- reason string, and fixing them meant re-running the scan against production.
-- The artifact carries what came back, bounded and redacted by
-- apps/control-plane/api/_runArtifacts.ts before it ever reaches this table.
--
-- Rows are written by withContentRun with the service role only, and deleted
-- with their run. They are evidence about the engine, not about content, so
-- nothing outside the engine reads them.

create table if not exists public.content_engine_run_artifacts (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null references public.content_engine_runs(id) on delete cascade,
  job         text not null,
  kind        text not null check (kind in ('handler_error', 'llm_parse_failure', 'schema_rejection', 'http_failure')),
  reason      text,
  payload     jsonb not null default '{}'::jsonb,
  promoted_at timestamptz,
  created_at  timestamptz not null default now()
);

-- The two questions this table gets asked: what has this job been failing on,
-- and what has not yet been turned into an eval case.
create index if not exists content_engine_run_artifacts_job_idx
  on public.content_engine_run_artifacts (job, created_at desc);
create index if not exists content_engine_run_artifacts_unpromoted_idx
  on public.content_engine_run_artifacts (created_at desc) where promoted_at is null;

-- A run artifact can quote a model response built from a content row. Even
-- redacted, that is not something the browser's anon key should be able to
-- enumerate: the Content tab reads counts and reasons from content_engine_runs,
-- which is enough for the obligation strip.
alter table public.content_engine_run_artifacts enable row level security;
revoke all on public.content_engine_run_artifacts from anon, authenticated;

comment on table public.content_engine_run_artifacts is
  'Bounded, redacted evidence from failed content_engine_runs. Service role only. Redaction happens in api/_runArtifacts.ts before insert, not here.';
comment on column public.content_engine_run_artifacts.promoted_at is
  'Set when the artifact has been turned into a pinned eval case under scripts/eval/cases/, so a fixed failure stays fixed.';
