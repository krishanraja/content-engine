-- The taste ledger: why Krish likes what he likes, as claims he confirms.
--
-- Written by the inspirationhouse engine (krishanraja/inspirationhouse), read
-- live by this repo's drafting and by Control Center's visibility scorer.
-- Every decision goes through the existing learning-proposals door
-- (mindmake_studio_learning_proposals, class 'taste'), so this migration adds
-- no verdict table of its own.
--
-- Three rules are enforced here, not by convention:
--   1. Numbers are computed, never emitted by a model (architecture 0a.7):
--      support_n and counter_n are recounted by trigger from Krish-attributed
--      evidence, and confidence is a generated column.
--   2. Anti-echo: taste may shape form and craft, never what to write about.
--      A form claim must name a craft layer, and readers only ever see
--      taste_profile_form.
--   3. His words are his: a claim's `krish` text must be a verbatim excerpt
--      of the evidence row it cites.

begin;

-- 1. The craft layers a form claim can name ---------------------------------

create table public.taste_layers (
  slug text primary key check (slug ~ '^[a-z][a-z_]{1,31}$'),
  label text not null check (char_length(label) between 1 and 60),
  plane text not null check (plane in ('text', 'video', 'visibility')),
  what text not null check (char_length(what) between 1 and 300)
);

insert into public.taste_layers (slug, label, plane, what) values
  ('opening',      'Opening',      'text',       'How a piece starts: the hook, the first line, the first ten seconds.'),
  ('structure',    'Structure',    'text',       'The order of the argument and how the parts connect.'),
  ('breakdown',    'Breakdown',    'text',       'How a point is explained: examples, images, steps.'),
  ('proof',        'Proof',        'text',       'How a claim is backed: numbers, sources, cases.'),
  ('tone',         'Tone',         'text',       'How it talks to the reader or viewer.'),
  ('close',        'Close',        'text',       'How a piece ends and what it asks for.'),
  ('packaging',    'Packaging',    'text',       'Titles, headlines, thumbnails and covers.'),
  ('length',       'Length',       'text',       'How long a piece runs and how dense it is.'),
  ('editing',      'Editing',      'video',      'Cuts, pace and rhythm.'),
  ('camerawork',   'Camerawork',   'video',      'Framing, angles, push-ins and moves.'),
  ('graphics',     'Graphics',     'video',      'On-screen text, B-roll and graphics.'),
  ('production',   'Production',   'video',      'Light, sound and finish.'),
  ('stage_format', 'Stage format', 'visibility', 'The kind of room: conversation, panel, keynote, podcast, workshop.');

-- 2. Evidence: one row per thing he liked, rejected or corrected -------------

create table public.taste_evidence (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in (
    'learnings_json', 'title_verdicts', 'golden_examples', 'rejected_lines',
    'style_references', 'style_bank', 'drive_cold', 'drive_video',
    'what_i_like_sheet', 'idea_triage', 'feedback_hist', 'creator_move',
    'visibility_target', 'drive_artifact', 'inspiration_page'
  )),
  source_ref text not null check (char_length(source_ref) between 1 and 300),
  -- A hash of the entry's own content, so an edited entry is a new version and
  -- an unchanged one is never inserted twice.
  source_version text not null check (source_version ~ '^[a-f0-9]{16,64}$'),
  occurred_at timestamptz not null,
  attribution text not null check (attribution in (
    'krish_words', 'krish_action', 'observation', 'machine_inference'
  )),
  polarity text not null check (polarity in ('likes', 'dislikes', 'neutral')),
  lane text not null check (lane in ('strategy', 'production', 'visibility', 'voice')),
  layer text references public.taste_layers(slug),
  title text check (title is null or char_length(title) <= 300),
  excerpt text check (excerpt is null or char_length(excerpt) <= 400),
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object'),
  collected_run uuid,
  created_at timestamptz not null default now(),
  constraint taste_evidence_version_unique unique (source, source_ref, source_version)
);

create index taste_evidence_source_ref_idx on public.taste_evidence (source, source_ref);
create index taste_evidence_lane_time_idx on public.taste_evidence (lane, occurred_at desc);

-- 3. Whys: candidate reasons, one evidence row at a time ----------------------

create table public.taste_whys (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.taste_evidence(id) on delete cascade,
  statement text not null check (char_length(statement) between 12 and 400),
  lane text not null check (lane in ('strategy', 'production', 'visibility', 'voice')),
  layer text references public.taste_layers(slug),
  kind text not null check (kind in ('form', 'subject')),
  -- Grounded in his words, in a recorded reason, or a guess from the content.
  origin text not null check (origin in ('krish', 'recorded', 'model_guess')),
  model text not null check (char_length(model) between 1 and 80),
  prompt_rev text not null check (char_length(prompt_rev) between 1 and 40),
  run_id uuid,
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{16,64}$'),
  created_at timestamptz not null default now(),
  constraint taste_whys_form_has_layer check (kind <> 'form' or layer is not null),
  constraint taste_whys_unique unique (evidence_id, fingerprint)
);

create index taste_whys_evidence_idx on public.taste_whys (evidence_id);

-- 4. Claims: what the evidence says he likes, for him to confirm -------------

create table public.taste_claims (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{16,64}$'),
  version integer not null default 1 check (version >= 1),
  supersedes uuid references public.taste_claims(id),
  lane text not null check (lane in ('strategy', 'production', 'visibility', 'voice')),
  layer text references public.taste_layers(slug),
  kind text not null check (kind in ('form', 'subject')),
  statement text not null check (char_length(statement) between 12 and 600),
  krish text check (krish is null or char_length(krish) between 1 and 400),
  krish_source_id uuid references public.taste_evidence(id),
  why text not null check (char_length(why) between 12 and 600),
  means text not null check (char_length(means) between 12 and 600),
  encoded jsonb not null default '[]'::jsonb check (jsonb_typeof(encoded) = 'array'),
  evidence_ids uuid[] not null check (cardinality(evidence_ids) between 1 and 100),
  counterexample_ids uuid[] not null default '{}' check (cardinality(counterexample_ids) <= 100),
  support_n integer not null default 0,
  counter_n integer not null default 0,
  confidence numeric generated always as (
    round((support_n + 1)::numeric / (support_n + counter_n + 2), 3)
  ) stored,
  flip_rule text not null check (char_length(flip_rule) between 12 and 400),
  status text not null default 'candidate' check (status in ('candidate', 'proposed', 'retired', 'superseded')),
  proposal_id uuid references public.mindmake_studio_learning_proposals(id),
  created_run uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint taste_claims_form_has_layer check (kind <> 'form' or layer is not null),
  constraint taste_claims_krish_cited check (krish is null or krish_source_id is not null),
  constraint taste_claims_proposed_has_proposal check (status <> 'proposed' or proposal_id is not null),
  constraint taste_claims_version_unique unique (fingerprint, version)
);

create index taste_claims_status_idx on public.taste_claims (status, lane);
create index taste_claims_proposal_idx on public.taste_claims (proposal_id) where proposal_id is not null;

-- Counts come from the database. A model can list evidence; it cannot score it.
create or replace function public.taste_claims_count_evidence()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  unresolved integer;
  quoted text;
begin
  select count(*) into unresolved
  from unnest(new.evidence_ids || new.counterexample_ids) as e(id)
  where not exists (select 1 from public.taste_evidence t where t.id = e.id);
  if unresolved > 0 then
    raise exception 'taste_claims: % cited evidence id(s) do not exist', unresolved;
  end if;

  -- One source entry counts once, however many versions of it are cited.
  select count(distinct (t.source, t.source_ref)) into new.support_n
  from public.taste_evidence t
  where t.id = any(new.evidence_ids)
    and t.attribution in ('krish_words', 'krish_action');

  select count(distinct (t.source, t.source_ref)) into new.counter_n
  from public.taste_evidence t
  where t.id = any(new.counterexample_ids)
    and t.attribution in ('krish_words', 'krish_action');

  if new.krish is not null then
    select t.excerpt into quoted
    from public.taste_evidence t
    where t.id = new.krish_source_id
      and t.id = any(new.evidence_ids)
      and t.attribution = 'krish_words';
    if quoted is null or position(new.krish in quoted) = 0 then
      raise exception 'taste_claims: krish must be a verbatim excerpt of a cited krish_words evidence row';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger taste_claims_count_evidence
  before insert or update on public.taste_claims
  for each row execute function public.taste_claims_count_evidence();

-- 5. The reword: what he said instead, on the existing door ------------------

alter table public.mindmake_studio_learning_proposals
  add column if not exists decision_note text
  check (decision_note is null or char_length(decision_note) between 1 and 600);

-- 6. What readers see: approved claims only, and form claims only -----------

create view public.taste_profile_current
with (security_invoker = true) as
select
  c.id,
  c.lane,
  c.layer,
  c.kind,
  -- A reword is his wording of the claim; it replaces the engine's.
  coalesce(p.decision_note, c.statement) as statement,
  coalesce(p.decision_note, c.krish) as krish,
  c.why,
  c.means,
  c.support_n,
  c.counter_n,
  c.confidence,
  p.status as decision,
  p.decided_at
from public.taste_claims c
join public.mindmake_studio_learning_proposals p on p.id = c.proposal_id
where p.status in ('approved', 'corrected')
  and p.decided_by = 'Krish'
  and c.status not in ('retired', 'superseded');

create view public.taste_profile_form
with (security_invoker = true) as
select * from public.taste_profile_current where kind = 'form';

-- 7. The scoreboard: is the output getting better ----------------------------

create table public.taste_scoreboard (
  week date not null check (extract(isodow from week) = 1),
  metric text not null check (metric ~ '^[a-z][a-z0-9_]{1,63}$'),
  numerator numeric,
  denominator numeric,
  value numeric generated always as (numerator / nullif(denominator, 0)) stored,
  reading text not null check (reading in ('measured', 'no_reading')),
  phase text not null check (phase in ('baseline', 'live')),
  inputs jsonb not null default '{}'::jsonb check (jsonb_typeof(inputs) = 'object'),
  computed_at timestamptz not null default now(),
  primary key (week, metric),
  -- Silence is not feedback: a week with nothing to count is no reading, never 0.
  constraint taste_scoreboard_reading_has_numbers check (
    (reading = 'measured' and numerator is not null and denominator > 0)
    or (reading = 'no_reading' and numerator is null)
  )
);

-- 8. Where each collector got to ---------------------------------------------

create table public.taste_watermarks (
  source text primary key check (char_length(source) between 1 and 60),
  cursor text,
  last_run_id uuid,
  last_run_at timestamptz,
  last_seen_n integer not null default 0 check (last_seen_n >= 0),
  last_written_n integer not null default 0 check (last_written_n >= 0)
);

-- 9. The Inspiration page: one card per thing he dropped in Drive ------------
--
-- The engine fills a card (thumbnail, its guessed tags, its guessed answers as
-- one-tap chips). Control Center's Inspiration page shows it and saves his three
-- answers. A guess stays a guess until he answers: silence is not feedback.

create table public.inspiration_items (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null unique check (drive_file_id ~ '^[A-Za-z0-9_-]{10,80}$'),
  folder text not null check (folder in ('cold_ideas', 'video_inspiration')),
  lane text not null check (lane in ('strategy', 'production')),
  name text not null check (char_length(name) between 1 and 300),
  mime text not null check (char_length(mime) between 1 and 120),
  drive_created_at timestamptz not null,
  -- A small preview kept in the row, so the page needs no storage bucket and
  -- no Drive call to draw a card.
  thumb bytea check (thumb is null or octet_length(thumb) <= 250000),
  thumb_mime text check (thumb_mime is null or thumb_mime in ('image/jpeg', 'image/png', 'image/webp')),
  thumb_width integer check (thumb_width is null or thumb_width between 1 and 4000),
  thumb_height integer check (thumb_height is null or thumb_height between 1 and 4000),
  -- The engine's guesses, labelled as such: [{label, kind: form|subject, layer}].
  auto_tags jsonb not null default '[]'::jsonb check (jsonb_typeof(auto_tags) = 'array' and jsonb_array_length(auto_tags) <= 12),
  -- One-tap answers: {why_here: [..], why_like: [..], would_do: [..]}, each at most 3.
  predicted jsonb not null default '{}'::jsonb check (jsonb_typeof(predicted) = 'object'),
  predicted_route text check (predicted_route is null or predicted_route in ('study_style', 'make_piece', 'visibility', 'taste_only')),
  tag_model text check (tag_model is null or char_length(tag_model) <= 80),
  tagged_at timestamptz,
  -- His answers. `why_like_source` says whether he typed it or tapped a guess,
  -- so a tapped guess is recorded as his endorsement and never as his words.
  why_here text check (why_here is null or char_length(why_here) between 1 and 600),
  why_like text check (why_like is null or char_length(why_like) between 1 and 600),
  why_like_source text check (why_like_source is null or why_like_source in ('typed', 'picked')),
  would_do text check (would_do is null or char_length(would_do) between 1 and 600),
  route text check (route is null or route in ('study_style', 'make_piece', 'visibility', 'taste_only')),
  confirmed_tags jsonb not null default '[]'::jsonb check (jsonb_typeof(confirmed_tags) = 'array' and jsonb_array_length(confirmed_tags) <= 12),
  answered_at timestamptz,
  answered_by text check (answered_by is null or answered_by = 'Krish'),
  dismissed_at timestamptz,
  routed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inspiration_items_answer_owner check (
    (answered_at is null and answered_by is null) or (answered_at is not null and answered_by = 'Krish')
  ),
  constraint inspiration_items_answered_has_words check (
    answered_at is null or coalesce(why_here, why_like, would_do) is not null or route is not null
  ),
  constraint inspiration_items_like_source check ((why_like is null) = (why_like_source is null)),
  constraint inspiration_items_thumb_pair check ((thumb is null) = (thumb_mime is null))
);

create index inspiration_items_open_idx on public.inspiration_items (drive_created_at desc)
  where answered_at is null and dismissed_at is null;
create index inspiration_items_answered_idx on public.inspiration_items (answered_at desc)
  where answered_at is not null;

-- 10. Access: service role only -----------------------------------------------

alter table public.taste_layers enable row level security;
alter table public.taste_evidence enable row level security;
alter table public.taste_whys enable row level security;
alter table public.taste_claims enable row level security;
alter table public.taste_scoreboard enable row level security;
alter table public.taste_watermarks enable row level security;
alter table public.inspiration_items enable row level security;

revoke all on public.taste_layers, public.taste_evidence, public.taste_whys,
  public.taste_claims, public.taste_scoreboard, public.taste_watermarks,
  public.inspiration_items, public.taste_profile_current, public.taste_profile_form
  from public, anon, authenticated;

grant select on public.taste_layers to service_role;
grant select, insert on public.taste_evidence to service_role;
grant select, insert on public.taste_whys to service_role;
grant select, insert, update on public.taste_claims to service_role;
grant select, insert, update on public.taste_scoreboard to service_role;
grant select, insert, update on public.taste_watermarks to service_role;
grant select, insert, update on public.inspiration_items to service_role;
grant select on public.taste_profile_current, public.taste_profile_form to service_role;

create policy taste_layers_service_all on public.taste_layers
  for all to service_role using (true) with check (true);
create policy taste_evidence_service_all on public.taste_evidence
  for all to service_role using (true) with check (true);
create policy taste_whys_service_all on public.taste_whys
  for all to service_role using (true) with check (true);
create policy taste_claims_service_all on public.taste_claims
  for all to service_role using (true) with check (true);
create policy taste_scoreboard_service_all on public.taste_scoreboard
  for all to service_role using (true) with check (true);
create policy taste_watermarks_service_all on public.taste_watermarks
  for all to service_role using (true) with check (true);
create policy inspiration_items_service_all on public.inspiration_items
  for all to service_role using (true) with check (true);

comment on table public.taste_claims is
  'What the evidence says Krish likes, waiting on or past his decision. Written by the inspirationhouse engine; decided only through mindmake_studio_learning_proposals (class taste). support_n and counter_n are recounted by trigger; confidence is generated.';
comment on view public.taste_profile_form is
  'The only taste object a reader may use: approved or reworded form claims. Subject claims never appear here (anti-echo). Never read by a judge, ranker or scorer.';

commit;
