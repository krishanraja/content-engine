-- Feedback cues: everything Krish has said about a subject or an idea, kept as a cue the Sunday session can draw on.
--
-- Krish, 2026-10-26: "create some form of feedback loop with the [inspiration] house repository where all the feedback
-- I've given you goes into a really clear set of cues that you can draw from in the future? ... some stuff is really
-- valuable. For the future some stuff is really valuable but as a pattern within a different piece some stuff is
-- really valuable to track over time, etc."
--
-- Written by the inspirationhouse engine (krishanraja/inspirationhouse, src/collect/feedbackCues.ts) on its daily run,
-- from his idea-queue verdicts (meta.queue.triage and triage_history, decided_by 'Krish' only) and his typed answers on
-- Inspiration cards. Read by this repo's Sunday gather (GET /api/week/options?include=sources, `cues`;
-- apps/control-plane/api/_feedbackCues.ts) into docs/plans/<Monday>-week/sources.json.
--
-- One cue is one piece of his words with what it is for (`use`):
--   future_piece          an idea to make later as its own piece
--   wider_piece_context   material to keep as context for a bigger piece, grouped by `theme` when he named one
--   track_over_time       a topic or pattern to watch across weeks
--   brief                 his angle on how a piece should be told
--   not_for_us            dropped, never offered again
-- `said` is his exact words, never a paraphrase. `use_origin` says who named the use: 'krish' when his words name it,
-- 'rule' when a deterministic rule read it from his verdict or route, 'model_guess' when no rule fired and a model
-- guessed (labelled, and the model and prompt revision are kept in meta).
--
-- A rerun is a no-op (unique on source, source_ref, subject_ref). An answer he changes updates its cue; an answer he
-- takes back retires it (meta.retired_by 'withdrawn'), and a later verdict that contradicts it retires it
-- (meta.retired_by 'superseded'); either comes back open when his answer does. A cue a piece used is 'used' with the
-- piece's id, and the engine never reopens it.

begin;

create table public.feedback_cues (
  id uuid primary key default gen_random_uuid(),
  -- His exact words. Never empty, never a paraphrase.
  said text not null check (char_length(btrim(said)) between 1 and 4000),
  said_at timestamptz not null,
  -- Where the words were given. week_pick is reserved for words he writes on a week option.
  source text not null check (source in ('idea_queue', 'board_comment', 'inspiration_card', 'week_pick')),
  -- Which answer within the source: for the queue, '<idea id>:<use>'; for a card, '<item id>:<field>'.
  source_ref text not null check (char_length(source_ref) between 1 and 300),
  -- What the words are about: a content_ideas id or an inspiration_items id (text, as either table's id).
  subject_ref text not null check (char_length(subject_ref) between 1 and 300),
  -- One plain line saying what the subject is (the idea, or the card).
  subject text not null check (char_length(btrim(subject)) between 1 and 300),
  use text not null check (use in ('future_piece', 'wider_piece_context', 'track_over_time', 'brief', 'not_for_us')),
  theme text check (theme is null or char_length(btrim(theme)) between 1 and 120),
  use_origin text not null check (use_origin in ('krish', 'model_guess', 'rule')),
  status text not null default 'open' check (status in ('open', 'used', 'retired')),
  -- The piece (content_ideas id) a used cue went into.
  used_in uuid,
  -- The verdict or field, the rule that fired, a hash of the words, the model and prompt revision of a guess, and
  -- retired_by ('withdrawn' or 'superseded') when the engine retired it.
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feedback_cues_theme_is_wider check (theme is null or use = 'wider_piece_context'),
  constraint feedback_cues_used_names_piece check (used_in is null or status = 'used'),
  constraint feedback_cues_answer_unique unique (source, source_ref, subject_ref)
);

create index feedback_cues_open on public.feedback_cues (use, theme) where status = 'open';
create index feedback_cues_subject on public.feedback_cues (subject_ref);

comment on table public.feedback_cues is
  'Krish''s words about a subject or idea, each with what it is for (future_piece, wider_piece_context by theme, track_over_time, brief, not_for_us). Written by the inspirationhouse engine; read by the Sunday gather. said is verbatim.';

-- Access: service role only, like the taste ledger.
alter table public.feedback_cues enable row level security;
revoke all on public.feedback_cues from public, anon, authenticated;
grant select, insert, update on public.feedback_cues to service_role;

commit;
