-- Taste reports: what a session in any repository tells the taste engine, kept as it was reported.
--
-- Krish, 2026-10-26: "start the two-way build in a fresh session" (krishanraja/inspirationhouse docs/TWO_WAY.md, step
-- 1). Every repository learns how to report back from one Control Center connector tool (`report_to_taste_engine`,
-- krishanraja/control-center api/harness/_taste-mcp.ts). The tool writes here and nowhere else; this is its inbox, not
-- a home for the fact. The inspirationhouse engine's daily `reports` stage (src/collect/sessionReports.ts) reads each
-- report once and files it where the fact already lives: taste_evidence (source 'session_report') and, when his words
-- name what to do with a subject, feedback_cues (source 'session_report'). The procedure lives in inspirationhouse;
-- this table holds only what the session said.
--
-- Two kinds, never mixed (Ruling, Krish, 2026-10-24: "exact typed quotes count as my opinions on what I think you
-- should do with that content"):
--   krish_words   his exact words, quoted verbatim from a message he typed, with where (said_where) and when (said_at)
--                 he typed them. Refused without either. Becomes krish_words evidence, which can count toward a claim.
--   observation   anything else: a paraphrase, a summary, what a session noticed, how a piece performed. Never
--                 carries said_where or said_at, so it can never pass for his words. Becomes observation evidence,
--                 which is context only and never counts toward a claim (the claim trigger counts krish_* only).
-- Every report carries the session, the repository and when it was reported. A session never writes as Krish: the
-- tool takes his words only as a quote of what he typed, it cannot answer a card, write answered_by, or approve or
-- reword a rule, and nothing here reaches mindmake_studio_learning_proposals.
--
-- A retry is a no-op (unique on emitter_id, client_report_id). The engine stamps collected_at when it has filed a
-- report; a report is never edited after that.

begin;

create table public.taste_reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('krish_words', 'observation')),
  -- For krish_words, his words verbatim. For an observation, the session's own words.
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  -- Where and when he typed the words: only on krish_words, and required there.
  said_where text check (said_where is null or char_length(btrim(said_where)) between 3 and 300),
  said_at timestamptz,
  lane text not null check (lane in ('strategy', 'production', 'visibility', 'voice')),
  polarity text not null default 'neutral' check (polarity in ('likes', 'dislikes', 'neutral')),
  -- What the report is about, when it is about one thing: 'idea:<content_ideas id>', 'card:<inspiration_items id>',
  -- or 'piece:<content_ideas id>'. One plain line saying what that is.
  subject_ref text check (subject_ref is null or subject_ref ~ '^(idea|card|piece):[A-Za-z0-9-]{1,80}$'),
  subject text check (subject is null or char_length(btrim(subject)) between 1 and 300),
  -- Who reported it: the session's own reference, the repository it ran in, the connector surface and emitter.
  session_ref text not null check (char_length(btrim(session_ref)) between 3 and 200),
  repository text not null check (repository ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'),
  surface text not null check (char_length(surface) between 2 and 40),
  emitter_id text not null check (char_length(emitter_id) between 1 and 120),
  client_report_id text not null check (client_report_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,95}$'),
  reported_at timestamptz not null default now(),
  -- Set by the inspirationhouse engine when it has filed the report, with what it became.
  collected_at timestamptz,
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object'),
  constraint taste_reports_words_say_where_and_when check (
    kind <> 'krish_words' or (said_where is not null and said_at is not null)),
  constraint taste_reports_observation_is_not_words check (
    kind <> 'observation' or (said_where is null and said_at is null)),
  constraint taste_reports_said_before_reported check (said_at is null or said_at <= reported_at + interval '5 minutes'),
  -- Nothing he typed predates the engine; an absurd date is a session's mistake, never his.
  constraint taste_reports_said_since_2020 check (said_at is null or said_at >= timestamptz '2020-01-01 00:00:00+00'),
  constraint taste_reports_subject_named check ((subject_ref is null) = (subject is null)),
  constraint taste_reports_retry_once unique (emitter_id, client_report_id)
);

create index taste_reports_uncollected on public.taste_reports (reported_at) where collected_at is null;

-- What a session reported stays as it reported it: only collected_at (once, never back to null) and meta (what it
-- became) may change.
create or replace function public.taste_reports_hold()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (old.collected_at is not null and new.collected_at is null) then
    raise exception 'taste_reports: a filed report stays filed';
  end if;
  if (new.id, new.kind, new.body, new.said_where, new.said_at, new.lane, new.polarity, new.subject_ref, new.subject,
      new.session_ref, new.repository, new.surface, new.emitter_id, new.client_report_id, new.reported_at)
     is distinct from
     (old.id, old.kind, old.body, old.said_where, old.said_at, old.lane, old.polarity, old.subject_ref, old.subject,
      old.session_ref, old.repository, old.surface, old.emitter_id, old.client_report_id, old.reported_at) then
    raise exception 'taste_reports: a report is kept as it was reported';
  end if;
  return new;
end;
$$;

create trigger taste_reports_hold
  before update on public.taste_reports
  for each row execute function public.taste_reports_hold();

-- The engine files a report as evidence under its own source, and a cue under its own source.
alter table public.taste_evidence drop constraint taste_evidence_source_check;
alter table public.taste_evidence add constraint taste_evidence_source_check check (source in (
  'learnings_json', 'title_verdicts', 'golden_examples', 'rejected_lines',
  'style_references', 'style_bank', 'drive_cold', 'drive_video',
  'what_i_like_sheet', 'idea_triage', 'feedback_hist', 'creator_move',
  'visibility_target', 'drive_artifact', 'inspiration_page', 'session_report'
));

alter table public.feedback_cues drop constraint feedback_cues_source_check;
alter table public.feedback_cues add constraint feedback_cues_source_check
  check (source in ('idea_queue', 'board_comment', 'inspiration_card', 'week_pick', 'session_report'));

comment on table public.taste_reports is
  'What a session in any repository reported to the taste engine through Control Center''s report_to_taste_engine tool: his exact words with where and when he typed them (krish_words), or an observation (context only). Filed daily by the inspirationhouse engine into taste_evidence and feedback_cues.';

-- Access: service role only, like the taste ledger. Control Center writes with its service role.
alter table public.taste_reports enable row level security;
revoke all on public.taste_reports from public, anon, authenticated;
grant select, insert, update on public.taste_reports to service_role;

commit;
