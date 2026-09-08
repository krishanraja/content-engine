-- The edit ledger and the judge panel.
--
-- Two things Krish asked for, and they only work together.
--
-- The ledger records what he actually did to a piece: which magic edit he ran,
-- whether he kept the result, which brief sections he dropped, what he typed
-- over the top, what he approved and what he binned. Until now that was
-- scattered and mostly unread. content_ideas.meta.revisions[] recorded which
-- button was pressed but never whether the result survived, and nothing read
-- it. The composer's autosave overwrote body in place with no prior value.
-- briefDiff computed a per-section keep/drop decision in the browser and threw
-- it away, which is the single richest taste signal the product had.
--
-- The panel records what the machine thought before he decided. On its own
-- that is just more opinion. Joined to the ledger by panel_run_id it becomes
-- measurable: how often each judge predicted his call, how often it was alone
-- and right, how often it was noise. A judge that never changes an outcome
-- gets proposed for retirement. Without that the panel is ceremony inside a
-- month.
--
-- Shape is deliberately the studio learning spine's, not a new invention:
-- append-only, idempotency-keyed, before/after hashed, with a confirmation
-- state. See 20260907091923_studio_session_learning_spine.sql. A read-side view
-- unions the two so "everything that happened to this piece" is one query.
--
-- The anti-echo rule (api/_arcScore.ts, check-slate-calibration) survives here
-- intact: this data may inform FORM and CRAFT, never rank a candidate higher
-- because Krish showed interest in its SUBJECT. Nothing in this migration
-- stores a topic score, and check-judges.ts fails the build if a judge starts
-- reading one.

begin;

-- ── Composer sessions ───────────────────────────────────────────────────────
-- Open/close around a composer or brief editor so dwell time exists at all.
-- Mirrors mindmake_studio_sessions.

create table public.composer_sessions (
  id uuid primary key default gen_random_uuid(),
  open_idempotency_key uuid not null unique,
  surface text not null check (surface in ('composer', 'brief_editor', 'mobile_deck', 'video_review', 'carousel_review', 'triage')),
  client text not null check (client in ('desktop', 'mobile', 'codex', 'claude_code', 'claude_ai', 'chatgpt', 'runner', 'cron')),
  actor text not null default 'Krish',
  subject_table text not null check (subject_table in ('content_ideas', 'weekly_briefs', 'video_studio_jobs')),
  subject_id text not null,
  opened_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint composer_sessions_close_after_open check (closed_at is null or closed_at >= opened_at)
);

create index composer_sessions_subject_idx on public.composer_sessions (subject_table, subject_id, opened_at desc);

-- ── The edit ledger ─────────────────────────────────────────────────────────

create table public.content_edit_events (
  sequence_id bigint generated always as identity primary key,
  event_id uuid not null unique default gen_random_uuid(),
  -- The caller supplies this. A retried request writes one row, not two: the
  -- composer's accept fires on a tap that can double-fire on a phone.
  idempotency_key uuid not null unique,
  session_id uuid references public.composer_sessions (id),
  -- Set when this event resolves a panel run, so calibration is a join rather
  -- than a guess at which verdict preceded which decision.
  panel_run_id uuid,

  subject_table text not null check (subject_table in ('content_ideas', 'weekly_briefs', 'video_studio_jobs')),
  subject_id text not null,
  artifact_kind text not null check (artifact_kind in (
    'draft', 'brief_section', 'headline', 'thesis', 'caption', 'script', 'external_final'
  )),
  action text not null check (action in (
    'manual_edit',
    'magic_invoked', 'magic_accepted', 'magic_rejected',
    'section_kept', 'section_dropped',
    'final_pass_accepted', 'final_pass_dismissed',
    'approved', 'binned', 'published', 'external_final_captured'
  )),

  -- Which edit, in the palette's own vocabulary. mode/value are the axis and
  -- the preset (tone/punchier, length/short, creator_move/<slug>), so
  -- acceptance per preset is a group-by rather than a text search.
  mode text check (mode is null or mode ~ '^[a-z][a-z0-9_]{0,39}$'),
  value text check (value is null or char_length(value) <= 120),
  -- Only when he typed one. Bounded, and never a whole conversation.
  instruction text check (instruction is null or char_length(instruction) <= 1600),
  -- Which passage he chose to rewrite, without storing the passage twice.
  selection_hash text check (selection_hash is null or selection_hash ~ '^[a-f0-9]{64}$'),

  before_hash text check (before_hash is null or before_hash ~ '^[a-f0-9]{64}$'),
  after_hash text check (after_hash is null or after_hash ~ '^[a-f0-9]{64}$'),
  -- Structured and bounded: what changed, never two full bodies. Shape follows
  -- FeedbackEventV2's delta_features in @mindmake/contracts.
  delta_features jsonb not null default '[]'::jsonb check (jsonb_typeof(delta_features) = 'array'),
  chars_before integer check (chars_before is null or chars_before >= 0),
  chars_after integer check (chars_after is null or chars_after >= 0),
  dwell_ms integer check (dwell_ms is null or dwell_ms >= 0),

  -- Reuses the served-surface vocabulary rather than inventing a second one.
  reason_code text check (reason_code is null or reason_code ~ '^[a-z][a-z0-9_]{0,63}$'),
  confirmation_state text not null default 'not_applicable'
    check (confirmation_state in ('not_applicable', 'pending', 'confirmed', 'corrected', 'observation_only')),

  actor text not null default 'Krish',
  surface text not null check (surface in ('composer', 'brief_editor', 'mobile_deck', 'video_review', 'carousel_review', 'triage', 'api')),
  client text not null check (client in ('desktop', 'mobile', 'codex', 'claude_code', 'claude_ai', 'chatgpt', 'runner', 'cron')),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  -- An accept or reject has to say what it accepted. Without this the table
  -- fills with outcomes nobody can attribute to an input, which is exactly the
  -- failure meta.revisions[] already had.
  constraint content_edit_events_resolution_has_parent check (
    action not in ('magic_accepted', 'magic_rejected') or before_hash is not null
  ),
  -- A change that claims a result must say what the result was.
  constraint content_edit_events_change_has_result check (
    action not in ('manual_edit', 'magic_accepted', 'external_final_captured') or after_hash is not null
  )
);

create index content_edit_events_subject_idx on public.content_edit_events (subject_table, subject_id, occurred_at desc);
create index content_edit_events_action_idx on public.content_edit_events (action, occurred_at desc);
create index content_edit_events_preset_idx on public.content_edit_events (mode, value, occurred_at desc) where mode is not null;
create index content_edit_events_panel_idx on public.content_edit_events (panel_run_id) where panel_run_id is not null;

-- Append-only. A ledger you can edit is a story, not a record.
create or replace function public.content_edit_events_reject_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'content_edit_events is append-only';
end;
$$;

create trigger content_edit_events_append_only
  before update or delete on public.content_edit_events
  for each row execute function public.content_edit_events_reject_mutation();

-- ── The judge panel ─────────────────────────────────────────────────────────

create table public.panel_runs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null unique,
  gate text not null check (gate in ('idea', 'draft')),
  subject_table text not null check (subject_table in ('content_ideas', 'weekly_briefs')),
  subject_id text not null,
  -- What exactly was judged. A verdict that is not bound to a hash is a verdict
  -- about something that may since have changed.
  artifact_hash text not null check (artifact_hash ~ '^[a-f0-9]{64}$'),
  roster_version text not null check (roster_version ~ '^[a-z0-9][a-z0-9._-]{0,39}$'),
  -- Where the panel landed as a whole, and where it disagreed. Preserved rather
  -- than averaged: a mean hides the one thing worth seeing.
  spread jsonb not null default '{}'::jsonb check (jsonb_typeof(spread) = 'object'),
  dissent boolean not null default false,
  tiebreaker_used boolean not null default false,
  cost_usd numeric(10, 4) not null default 0 check (cost_usd >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz not null default now(),
  constraint panel_runs_time_order check (finished_at >= started_at)
);

create index panel_runs_subject_idx on public.panel_runs (subject_table, subject_id, finished_at desc);

create table public.judge_verdicts (
  sequence_id bigint generated always as identity primary key,
  verdict_id uuid not null unique default gen_random_uuid(),
  panel_run_id uuid not null references public.panel_runs (id) on delete cascade,
  judge text not null check (judge ~ '^[a-z][a-z0-9_]{1,39}$'),
  -- 0 to 10. Null when the judge abstained, which is an honest answer and must
  -- not be silently read as zero.
  score numeric(4, 2) check (score is null or (score >= 0 and score <= 10)),
  verdict text not null check (verdict in ('pass', 'revise', 'kill', 'abstain')),
  -- The single most important thing to fix. One, not a list: a judge that
  -- returns six notes has not judged, it has reviewed.
  the_one_fix text check (the_one_fix is null or char_length(the_one_fix) <= 600),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  confidence numeric(3, 2) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  -- Deterministic judges (dedupe, voice lint, card lint) cost nothing and run
  -- first. Recording which is which keeps the spend attributable.
  deterministic boolean not null default false,
  model text check (model is null or char_length(model) <= 80),
  cost_usd numeric(10, 4) not null default 0 check (cost_usd >= 0),
  occurred_at timestamptz not null default now(),
  unique (panel_run_id, judge),
  -- An abstention has no score and a scored verdict has one.
  constraint judge_verdicts_abstain_has_no_score check (
    (verdict = 'abstain' and score is null) or (verdict <> 'abstain' and score is not null)
  )
);

create index judge_verdicts_judge_idx on public.judge_verdicts (judge, occurred_at desc);

create or replace function public.judge_verdicts_reject_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  raise exception 'judge_verdicts is append-only';
end;
$$;

create trigger judge_verdicts_append_only
  before update or delete on public.judge_verdicts
  for each row execute function public.judge_verdicts_reject_mutation();

-- ── Calibration: did the judge predict Krish? ───────────────────────────────
-- The panel's own report card. One row per judge per resolved run: what it
-- said, and what he then did. `agreed` is null while he has not decided, which
-- is different from disagreeing and must not be counted as either.

create or replace view public.judge_calibration as
select
  v.judge,
  r.gate,
  r.id as panel_run_id,
  r.subject_table,
  r.subject_id,
  v.verdict,
  v.score,
  v.confidence,
  e.action as krish_action,
  e.occurred_at as decided_at,
  case
    when e.action is null then null
    -- Only a pass or a kill is a prediction this action can settle. An
    -- abstention is not a wrong answer, and "revise" is a middle position:
    -- counting either against the judge would punish honest abstention and
    -- train confident guessing, which is the opposite of what the panel needs.
    when v.verdict not in ('pass', 'kill') then null
    when e.action in ('approved', 'published') then v.verdict = 'pass'
    when e.action = 'binned' then v.verdict = 'kill'
    else null
  end as agreed
from public.judge_verdicts v
join public.panel_runs r on r.id = v.panel_run_id
left join lateral (
  select action, occurred_at
  from public.content_edit_events ce
  where ce.panel_run_id = r.id
    and ce.action in ('approved', 'binned', 'published')
  order by ce.occurred_at asc
  limit 1
) e on true;

-- ── One timeline per piece ──────────────────────────────────────────────────
-- Everything that happened to a piece, whichever ledger recorded it. The
-- studio spine keeps its own table; this reads across rather than merging them.

create or replace view public.piece_timeline as
select
  'edit'::text as source,
  e.occurred_at,
  e.subject_table,
  e.subject_id,
  e.action,
  e.mode,
  e.value,
  e.surface,
  e.client
from public.content_edit_events e
union all
select
  'studio'::text as source,
  s.occurred_at,
  'video_studio_jobs'::text as subject_table,
  coalesce(s.job_id, '') as subject_id,
  s.action,
  null::text as mode,
  null::text as value,
  'video_review'::text as surface,
  s.client
from public.mindmake_studio_interaction_events s;

-- ── Grants ──────────────────────────────────────────────────────────────────
-- The dashboard reads with the anon key like every other Content table; only
-- the service role (the routes) writes. The append-only triggers make the
-- distinction enforceable rather than merely intended.

alter table public.composer_sessions enable row level security;
alter table public.content_edit_events enable row level security;
alter table public.panel_runs enable row level security;
alter table public.judge_verdicts enable row level security;

grant select on public.composer_sessions to anon;
grant select on public.content_edit_events to anon;
grant select on public.panel_runs to anon;
grant select on public.judge_verdicts to anon;
grant select on public.judge_calibration to anon;
grant select on public.piece_timeline to anon;

grant select, insert, update on public.composer_sessions to service_role;
grant select, insert on public.content_edit_events to service_role;
grant select, insert on public.panel_runs to service_role;
grant select, insert on public.judge_verdicts to service_role;

create policy composer_sessions_anon_read on public.composer_sessions for select to anon using (true);
create policy composer_sessions_service_all on public.composer_sessions for all to service_role using (true) with check (true);
create policy content_edit_events_anon_read on public.content_edit_events for select to anon using (true);
create policy content_edit_events_service_all on public.content_edit_events for all to service_role using (true) with check (true);
create policy panel_runs_anon_read on public.panel_runs for select to anon using (true);
create policy panel_runs_service_all on public.panel_runs for all to service_role using (true) with check (true);
create policy judge_verdicts_anon_read on public.judge_verdicts for select to anon using (true);
create policy judge_verdicts_service_all on public.judge_verdicts for all to service_role using (true) with check (true);

-- The append-only triggers are SECURITY DEFINER, which is right for a trigger
-- and wrong as an RPC: without this they are callable by anon through
-- /rest/v1/rpc and do nothing but raise. Triggers fire regardless of EXECUTE.
revoke execute on function public.content_edit_events_reject_mutation() from public, anon, authenticated;
revoke execute on function public.judge_verdicts_reject_mutation() from public, anon, authenticated;

-- Read with the caller's permissions, not the creator's, so the anon key's RLS
-- actually applies to what the dashboard reads back.
alter view public.judge_calibration set (security_invoker = true);
alter view public.piece_timeline set (security_invoker = true);

comment on table public.content_edit_events is
  'Append-only record of what Krish did to a piece: which edit he ran, whether he kept it, what he typed over it, what he approved. Joined to panel_runs it measures the judges.';
comment on table public.panel_runs is
  'One run of a judge panel against an exact artifact hash. Disagreement is preserved in spread, never averaged into a single number.';
comment on table public.judge_verdicts is
  'One judge, one question it owns, one verdict. Append-only; abstention carries no score.';
comment on view public.judge_calibration is
  'The panel graded against Krish. agreed is true or false only where the judge made a pass/kill prediction his action settles; an abstention or a revise is null, because neither is a wrong answer.';

commit;
