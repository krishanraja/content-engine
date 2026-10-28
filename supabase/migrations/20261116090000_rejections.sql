-- Rejections: the floor beside the taste ledger's ceiling.
--
-- Krish, 2026-10-28: "I want this repository to house a separate side engine called Rejections (where all the working
-- rejected production work goes, with the reason why I rejected it - acting as the floor, whilst Inspiration acts as
-- the Ceiling)." And: "The engine shouldn't keep or re-watch masters. It should keep a frame and your reason."
--
-- Written only by the inspirationhouse engine's `rejections` job (krishanraja/inspirationhouse src/rejection/), which
-- reads his Rejections folder in Drive read-only, the session reports of his words, and the inbox below. Read by the
-- same engine to render config/rejection-floor.json into this repository by pull request, which every session reads.
--
-- Enforced here, not by convention:
--   1. His words are his and stay whole. A quote is one row per distinct thing he said (quote_key: its normalised text
--      and the day he said it), so a dump renumbered by a later merge pass never files a quote twice. Its text never
--      changes. Only a quote dated and marked verbatim is krish_words; approving a critique is krish_action; a
--      paraphrase is an observation and can never pass for his words.
--   2. No master is ever kept. A frame or strip is an image of at most 400 KB; a clip is an mp4 of at most 1.6 MB and
--      4.5 s. A whole cut is pointed at by its Drive id, never stored.
--   3. Numbers are computed, never emitted by a model: a standard's support is the distinct quotes of his, standing
--      in a record that stands, counted by trigger.
--   4. Never set a decision. A standard reaches him through mindmake_studio_learning_proposals and is never rewritten
--      once it is there. The view labels each standard approved, reworded or draft, and only he moves it.
--   5. Anti-echo (Ruling, Krish, 2026-10-28: reviewers and pre-delivery checks may test work against the floor, craft
--      and process only): a standard is kind form or workflow, never subject. Subject records are kept as records.

begin;

-- 1. His words ----------------------------------------------------------------------------------------------------

create table public.taste_rejection_quotes (
  id uuid primary key default gen_random_uuid(),
  -- md5-length hex of the normalised text and the day he said it.
  quote_key text not null unique check (quote_key ~ '^[a-f0-9]{32}$'),
  text text not null check (char_length(btrim(text)) between 1 and 20000),
  said_at timestamptz not null check (said_at >= timestamptz '2020-01-01 00:00:00+00'),
  -- 'day' when the record gave a date only, 'second' when it gave the moment.
  said_precision text not null check (said_precision in ('day', 'second')),
  said_where text not null check (char_length(btrim(said_where)) between 1 and 300),
  source text not null check (source in ('cloud', 'codex', 'local', 'repo', 'other_account', 'session_report', 'capture', 'unknown')),
  attribution text not null check (attribution in ('krish_words', 'krish_action', 'observation')),
  first_run uuid,
  created_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object')
);

-- His words never change. How the engine classes them (attribution, source, where, precision) may be corrected.
create or replace function public.taste_rejection_quotes_hold()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.quote_key, new.text, new.said_at) is distinct from (old.id, old.quote_key, old.text, old.said_at) then
    raise exception 'taste_rejection_quotes: his words are kept as he said them';
  end if;
  return new;
end;
$$;

create trigger taste_rejection_quotes_hold
  before update on public.taste_rejection_quotes
  for each row execute function public.taste_rejection_quotes_hold();

-- 2. The records ---------------------------------------------------------------------------------------------------

create table public.taste_rejections (
  id uuid primary key default gen_random_uuid(),
  -- Where the engine read it: the Drive dump, the inbox below, or a session report of his words.
  source text not null check (source in ('drive_dump', 'inbox', 'session_report')),
  source_ref text not null check (char_length(source_ref) between 1 and 300),
  source_version text not null check (source_version ~ '^[a-f0-9]{16,64}$'),
  -- rejected: an asset or opinion below the floor. liked: what he liked in the same breath (the boundary).
  -- process: how a session worked with him (the workflow floor), never mixed into production counts.
  kind text not null check (kind in ('rejected', 'liked', 'process')),
  rejected_at timestamptz not null,
  quote_ids uuid[] not null default '{}',
  attribution text not null check (attribution in ('krish_words', 'krish_action', 'observation')),
  -- The compiler's or session's text, never his words: what was rejected, why, and what he wanted instead.
  item text check (item is null or char_length(item) <= 4000),
  reason text check (reason is null or char_length(reason) <= 4000),
  wanted_instead text check (wanted_instead is null or char_length(wanted_instead) <= 4000),
  strength text not null check (strength in ('hated', 'disliked', 'rejected', 'ruled_out', 'endorsed', 'liked', 'unstated')),
  -- Slugs from the engine's fixed vocabularies (src/rejection/vocab.ts), grown only by pull request.
  theme text not null check (theme ~ '^[a-z][a-z0-9_]{1,63}$'),
  formats text[] not null check (cardinality(formats) between 1 and 16),
  rule_kind text not null check (rule_kind in ('form', 'subject', 'workflow')),
  -- How the defect is kept: a still shows it, a moment needs a clip, a whole cut has no single moment, or the words
  -- themselves are the asset.
  capture text not null check (capture in ('still', 'moment', 'whole_cut', 'words')),
  piece text check (piece is null or char_length(piece) <= 300),
  rules_rev text not null check (char_length(rules_rev) between 1 and 40),
  -- Filled in after insert, never part of the record's version.
  master_drive_id text check (master_drive_id is null or master_drive_id ~ '^[A-Za-z0-9_-]{10,80}$'),
  moment_ms integer check (moment_ms is null or moment_ms >= 0),
  moment_origin text check (moment_origin is null or moment_origin in ('krish', 'record', 'anchor')),
  -- The quotes he liked nearby: [{quote_id, basis}], basis same_message | same_piece.
  near jsonb not null default '[]'::jsonb check (jsonb_typeof(near) = 'array'),
  media_sha256 text[] not null default '{}',
  withdrawn_at timestamptz,
  collected_run uuid,
  created_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object'),
  constraint taste_rejections_version_once unique (source, source_ref, source_version),
  constraint taste_rejections_moment_pair check ((moment_ms is null) = (moment_origin is null)),
  constraint taste_rejections_words_are_quoted check (attribution <> 'krish_words' or cardinality(quote_ids) > 0),
  constraint taste_rejections_media_hashes check (
    array_to_string(media_sha256, ',') ~ '^([a-f0-9]{64}(,[a-f0-9]{64})*)?$')
);

create index taste_rejections_standing_idx on public.taste_rejections (source, source_ref) where withdrawn_at is null;
create index taste_rejections_quotes_idx on public.taste_rejections using gin (quote_ids);

-- Every cited quote exists. Once written, a version's content never changes: only withdrawal, meta, the master pointer,
-- the moment, near and media are filled in.
create or replace function public.taste_rejections_check()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  unresolved integer;
begin
  select count(*) into unresolved
  from unnest(new.quote_ids) as q(id)
  where not exists (select 1 from public.taste_rejection_quotes t where t.id = q.id);
  if unresolved > 0 then
    raise exception 'taste_rejections: % cited quote(s) do not exist', unresolved;
  end if;
  if tg_op = 'UPDATE' then
    if (new.id, new.source, new.source_ref, new.source_version, new.kind, new.rejected_at, new.quote_ids,
        new.attribution, new.item, new.reason, new.wanted_instead, new.strength, new.theme, new.formats,
        new.rule_kind, new.capture, new.piece, new.rules_rev, new.collected_run, new.created_at)
       is distinct from
       (old.id, old.source, old.source_ref, old.source_version, old.kind, old.rejected_at, old.quote_ids,
        old.attribution, old.item, old.reason, old.wanted_instead, old.strength, old.theme, old.formats,
        old.rule_kind, old.capture, old.piece, old.rules_rev, old.collected_run, old.created_at) then
      raise exception 'taste_rejections: a record version is kept as it was filed; a change is a new version';
    end if;
  end if;
  return new;
end;
$$;

create trigger taste_rejections_check
  before insert or update on public.taste_rejections
  for each row execute function public.taste_rejections_check();

-- A record of his words cites at least one quote that is his words, checked once, when the version is filed. After the
-- insert, so a version sent again and skipped by ON CONFLICT DO NOTHING is never checked again (a before trigger fires
-- for a skipped row too). A quote the engine later reclasses must not block withdrawing the record, or filling in its
-- near and media: the record's version is what was filed.
create or replace function public.taste_rejections_words()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.attribution = 'krish_words' and not exists (
       select 1 from public.taste_rejection_quotes t where t.id = any(new.quote_ids) and t.attribution = 'krish_words') then
    raise exception 'taste_rejections: a record of his words must cite a quote that is his words';
  end if;
  return null;
end;
$$;

create trigger taste_rejections_words
  after insert on public.taste_rejections
  for each row execute function public.taste_rejections_words();

-- 3. What is kept of the asset: a frame, a strip or a short clip, never a master ----------------------------------

create table public.taste_rejection_media (
  id uuid primary key default gen_random_uuid(),
  sha256 text not null unique check (sha256 ~ '^[a-f0-9]{64}$'),
  role text not null check (role in ('screenshot', 'strip', 'clip')),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'video/mp4')),
  bytes bytea not null,
  width integer not null check (width between 1 and 4000),
  height integer not null check (height between 1 and 4000),
  -- A clip's length as ffprobe measured it; the database cannot measure an mp4 itself.
  duration_ms integer check (duration_ms is null or duration_ms between 1 and 4500),
  -- Where in the master it was cut, and the window it covers.
  at_ms integer check (at_ms is null or at_ms >= 0),
  window_from_ms integer check (window_from_ms is null or window_from_ms >= 0),
  window_to_ms integer check (window_to_ms is null or window_to_ms >= 0),
  frames_n smallint check (frames_n is null or frames_n between 1 and 12),
  -- The Drive file it was made from (a screenshot, a strip or a master), and that file's sha256 when Drive gave one.
  derived_from text check (derived_from is null or derived_from ~ '^[A-Za-z0-9_-]{10,80}$'),
  derived_from_sha256 text check (derived_from_sha256 is null or derived_from_sha256 ~ '^[a-f0-9]{64}$'),
  -- The recipe that made it (src/rejection/media.ts), so a better cutter can cut again.
  cut_rev text not null check (cut_rev ~ '^[a-z0-9_.-]{1,40}$'),
  created_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object'),
  constraint taste_rejection_media_hash_is_bytes check (encode(sha256(bytes), 'hex') = sha256),
  -- The bytes are what their label says, so a cap on an image can never hold a video.
  constraint taste_rejection_media_bytes_are_the_mime check (case mime
    when 'image/jpeg' then substring(bytes from 1 for 3) = '\xffd8ff'::bytea
    when 'image/png' then substring(bytes from 1 for 4) = '\x89504e47'::bytea
    when 'image/webp' then substring(bytes from 1 for 4) = '\x52494646'::bytea and substring(bytes from 9 for 4) = '\x57454250'::bytea
    when 'video/mp4' then substring(bytes from 5 for 4) = '\x66747970'::bytea
    else false end),
  constraint taste_rejection_media_image_cap check (mime = 'video/mp4' or octet_length(bytes) <= 400000),
  constraint taste_rejection_media_clip_cap check (
    mime <> 'video/mp4' or (octet_length(bytes) <= 1600000 and duration_ms is not null)),
  constraint taste_rejection_media_clip_is_mp4 check ((role = 'clip') = (mime = 'video/mp4')),
  constraint taste_rejection_media_strip_frames check (role <> 'strip' or frames_n is not null),
  constraint taste_rejection_media_window check (
    window_from_ms is null or window_to_ms is null or window_from_ms <= window_to_ms)
);

create index taste_rejection_media_source_idx on public.taste_rejection_media (derived_from, role);

create or replace function public.taste_rejection_media_hold()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.id, new.sha256, new.role, new.mime, new.bytes, new.width, new.height, new.duration_ms, new.at_ms,
      new.window_from_ms, new.window_to_ms, new.frames_n, new.derived_from, new.derived_from_sha256, new.cut_rev)
     is distinct from
     (old.id, old.sha256, old.role, old.mime, old.bytes, old.width, old.height, old.duration_ms, old.at_ms,
      old.window_from_ms, old.window_to_ms, old.frames_n, old.derived_from, old.derived_from_sha256, old.cut_rev) then
    raise exception 'taste_rejection_media: kept media is never rewritten';
  end if;
  return new;
end;
$$;

create trigger taste_rejection_media_hold
  before update on public.taste_rejection_media
  for each row execute function public.taste_rejection_media_hold();

-- 4. The inbox: what a session's one-step capture files, kept as it was filed --------------------------------------
--
-- A cloud session cannot write into Drive (apps/control-plane/api/library/_library.ts), so the capture files here, on
-- the engine key, and the inspirationhouse engine reads each row once. His words always carry where and when he said
-- them, and then a screenshot, or a master with the moment, or a whole cut, or nothing but the words.

create table public.taste_rejection_inbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'rejected' check (kind in ('rejected', 'liked', 'process')),
  said text not null check (char_length(btrim(said)) between 1 and 20000),
  said_where text not null check (char_length(btrim(said_where)) between 3 and 300),
  said_at timestamptz not null,
  piece text check (piece is null or char_length(btrim(piece)) between 1 and 300),
  formats text[] not null default '{}' check (cardinality(formats) <= 16),
  -- The session's own words about what was on screen. Context, never his words.
  note text check (note is null or char_length(btrim(note)) between 1 and 2000),
  screenshot bytea check (screenshot is null or octet_length(screenshot) between 1 and 5000000),
  screenshot_mime text check (screenshot_mime is null or screenshot_mime in ('image/jpeg', 'image/png', 'image/webp')),
  master_drive_id text check (master_drive_id is null or master_drive_id ~ '^[A-Za-z0-9_-]{10,80}$'),
  master_sha256 text check (master_sha256 is null or master_sha256 ~ '^[a-f0-9]{64}$'),
  at_ms integer check (at_ms is null or at_ms >= 0),
  whole_cut boolean not null default false,
  session_ref text not null check (char_length(btrim(session_ref)) between 3 and 200),
  repository text not null check (repository ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,99}/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$'),
  surface text not null check (char_length(surface) between 2 and 40),
  emitter_id text not null check (char_length(emitter_id) between 1 and 120),
  client_report_id text not null check (client_report_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,95}$'),
  reported_at timestamptz not null default now(),
  collected_at timestamptz,
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object'),
  constraint taste_rejection_inbox_said_before_reported check (said_at <= reported_at + interval '5 minutes'),
  constraint taste_rejection_inbox_said_since_2020 check (said_at >= timestamptz '2020-01-01 00:00:00+00'),
  constraint taste_rejection_inbox_screenshot_pair check ((screenshot is null) = (screenshot_mime is null)),
  constraint taste_rejection_inbox_screenshot_is_an_image check (screenshot is null or case screenshot_mime
    when 'image/jpeg' then substring(screenshot from 1 for 3) = '\xffd8ff'::bytea
    when 'image/png' then substring(screenshot from 1 for 4) = '\x89504e47'::bytea
    when 'image/webp' then substring(screenshot from 1 for 4) = '\x52494646'::bytea and substring(screenshot from 9 for 4) = '\x57454250'::bytea
    else false end),
  -- Exactly one shape: words alone; a screenshot; a master by its Drive id with the moment; or a whole cut by its Drive
  -- id. A master's sha256 only goes with its Drive id, since the engine reaches a master by id, never by hash.
  constraint taste_rejection_inbox_one_shape check (case
    when screenshot is not null then master_drive_id is null and master_sha256 is null and at_ms is null and not whole_cut
    when at_ms is not null or whole_cut then master_drive_id is not null and not (at_ms is not null and whole_cut)
    else master_drive_id is null and master_sha256 is null end),
  constraint taste_rejection_inbox_retry_once unique (emitter_id, client_report_id)
);

create index taste_rejection_inbox_uncollected on public.taste_rejection_inbox (reported_at) where collected_at is null;

create or replace function public.taste_rejection_inbox_hold()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (old.collected_at is not null and new.collected_at is null) then
    raise exception 'taste_rejection_inbox: a filed capture stays filed';
  end if;
  if (new.id, new.kind, new.said, new.said_where, new.said_at, new.piece, new.formats, new.note, new.screenshot,
      new.screenshot_mime, new.master_drive_id, new.master_sha256, new.at_ms, new.whole_cut, new.session_ref,
      new.repository, new.surface, new.emitter_id, new.client_report_id, new.reported_at)
     is distinct from
     (old.id, old.kind, old.said, old.said_where, old.said_at, old.piece, old.formats, old.note, old.screenshot,
      old.screenshot_mime, old.master_drive_id, old.master_sha256, old.at_ms, old.whole_cut, old.session_ref,
      old.repository, old.surface, old.emitter_id, old.client_report_id, old.reported_at) then
    raise exception 'taste_rejection_inbox: a capture is kept as it was filed';
  end if;
  return new;
end;
$$;

create trigger taste_rejection_inbox_hold
  before update on public.taste_rejection_inbox
  for each row execute function public.taste_rejection_inbox_hold();

-- 5. The standards: what the engine reads into his rejections, for him to approve -----------------------------------

create table public.taste_floor_standards (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{16,64}$'),
  version integer not null default 1 check (version >= 1),
  supersedes uuid references public.taste_floor_standards(id),
  -- The engine's words: the standard, and the maker's own check of the finished file before delivery.
  statement text not null check (char_length(btrim(statement)) between 8 and 400),
  how_to_check text not null check (char_length(btrim(how_to_check)) between 8 and 600),
  formats text[] not null check (cardinality(formats) between 1 and 16),
  theme text not null check (theme ~ '^[a-z][a-z0-9_]{1,63}$'),
  layer text references public.taste_layers(slug),
  kind text not null check (kind in ('form', 'workflow')),
  quote_ids uuid[] not null check (cardinality(quote_ids) between 1 and 300),
  record_refs text[] not null default '{}' check (cardinality(record_refs) <= 300),
  -- What he liked nearby, so a maker does not over-correct.
  boundary_quote_ids uuid[] not null default '{}' check (cardinality(boundary_quote_ids) <= 100),
  krish text check (krish is null or (char_length(krish) <= 600 and krish ~ '\S')),
  krish_quote_id uuid references public.taste_rejection_quotes(id),
  support_n integer not null default 0,
  action_n integer not null default 0,
  status text not null default 'candidate' check (status in ('candidate', 'proposed', 'retired', 'superseded')),
  proposal_id uuid,
  run_id uuid,
  model text check (model is null or char_length(model) between 1 and 80),
  prompt_rev text not null check (char_length(prompt_rev) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb check (jsonb_typeof(meta) = 'object'),
  constraint taste_floor_standards_krish_cited check ((krish is null) = (krish_quote_id is null)),
  constraint taste_floor_standards_version_once unique (fingerprint, version),
  constraint taste_floor_standards_proposed_has_proposal check (status <> 'proposed' or proposal_id is not null)
);

create index taste_floor_standards_open_idx on public.taste_floor_standards (status) where status in ('candidate', 'proposed');

create or replace function public.taste_floor_standards_count()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  unresolved integer;
  quoted text;
  set_quote boolean;
begin
  select count(*) into unresolved
  from unnest(new.quote_ids || new.boundary_quote_ids) as q(id)
  where not exists (select 1 from public.taste_rejection_quotes t where t.id = q.id);
  if unresolved > 0 then
    raise exception 'taste_floor_standards: % cited quote(s) do not exist', unresolved;
  end if;

  -- Support: distinct quotes of his words cited by a standing rejected or process record. A shared quote counts once.
  select count(distinct t.id) into new.support_n
  from public.taste_rejection_quotes t
  where t.id = any(new.quote_ids) and t.attribution = 'krish_words'
    and exists (select 1 from public.taste_rejections r
                where r.withdrawn_at is null and r.kind in ('rejected', 'process') and t.id = any(r.quote_ids));
  select count(distinct t.id) into new.action_n
  from public.taste_rejection_quotes t
  where t.id = any(new.quote_ids) and t.attribution = 'krish_action'
    and exists (select 1 from public.taste_rejections r
                where r.withdrawn_at is null and r.kind in ('rejected', 'process') and t.id = any(r.quote_ids));

  -- His quote is his words, whitespace aside, on a cited quote that is his words: checked when the quote is set. A
  -- quote the engine later reclasses must not stop a recount or a retirement; the view stops showing it instead.
  -- Nested, so OLD is read on an update only.
  set_quote := new.krish is not null and tg_op = 'INSERT';
  if new.krish is not null and tg_op = 'UPDATE' then
    set_quote := new.krish is distinct from old.krish or new.krish_quote_id is distinct from old.krish_quote_id;
  end if;
  if set_quote then
    select t.text into quoted from public.taste_rejection_quotes t
    where t.id = new.krish_quote_id and t.id = any(new.quote_ids) and t.attribution = 'krish_words';
    if quoted is null
       or strpos(regexp_replace(quoted, '\s+', ' ', 'g'),
                 regexp_replace(regexp_replace(new.krish, '^\s+|\s+$', '', 'g'), '\s+', ' ', 'g')) = 0 then
      raise exception 'taste_floor_standards: krish must be his words, verbatim, on a cited quote of his';
    end if;
  end if;

  -- What he was shown is what he decides: a standard on a proposal is never rewritten.
  if tg_op = 'UPDATE' then
    if old.proposal_id is not null and (
         new.proposal_id is distinct from old.proposal_id
      or new.statement is distinct from old.statement or new.how_to_check is distinct from old.how_to_check
      or new.formats is distinct from old.formats or new.theme is distinct from old.theme
      or new.layer is distinct from old.layer or new.kind is distinct from old.kind
      or new.quote_ids is distinct from old.quote_ids or new.record_refs is distinct from old.record_refs
      or new.boundary_quote_ids is distinct from old.boundary_quote_ids
      or new.krish is distinct from old.krish or new.krish_quote_id is distinct from old.krish_quote_id) then
      raise exception 'taste_floor_standards: a standard on a proposal is never rewritten; draft a new one instead';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger taste_floor_standards_count
  before insert or update on public.taste_floor_standards
  for each row execute function public.taste_floor_standards_count();

-- 6. The floor, as a session reads it -------------------------------------------------------------------------------
--
-- Each open standard, labelled by where it stands: approved or reworded by Krish, or a draft the engine read into his
-- rejections and has not yet put to him or he has not yet decided. A reword is his words and replaces the engine's.
-- His quote shows only while a standing record still cites it and it is still classed as his words.
create view public.taste_floor
with (security_invoker = true) as
select
  s.id,
  s.fingerprint,
  s.formats,
  s.theme,
  s.layer,
  s.kind,
  case when p.decided_by = 'Krish' and p.status = 'corrected' then 'reworded'
       when p.decided_by = 'Krish' and p.status = 'approved' then 'approved'
       else 'draft' end as standing,
  case when p.decided_by = 'Krish' and p.status = 'corrected' then coalesce(p.decision_note, s.statement)
       else s.statement end as statement,
  s.how_to_check,
  case when exists (select 1 from public.taste_rejections r
                    where r.withdrawn_at is null and s.krish_quote_id = any(r.quote_ids))
        and exists (select 1 from public.taste_rejection_quotes q where q.id = s.krish_quote_id and q.attribution = 'krish_words')
       then s.krish end as krish,
  s.support_n,
  s.action_n,
  s.quote_ids,
  s.record_refs,
  s.boundary_quote_ids,
  s.status,
  p.decided_at
from public.taste_floor_standards s
left join public.mindmake_studio_learning_proposals p on p.id = s.proposal_id
where s.status in ('candidate', 'proposed')
  and (p.id is null or p.status not in ('rejected', 'superseded'));

comment on table public.taste_rejection_quotes is
  'Krish''s words from his rejections, one row per distinct thing he said, kept whole and never changed. Written by the inspirationhouse rejections engine.';
comment on table public.taste_rejections is
  'Every rejection Krish gave (and what he liked in the same breath, and how sessions worked with him), one row per version, with a frame, strip or clip kept and never a master. Written by the inspirationhouse rejections engine from his Drive Rejections folder, session reports and taste_rejection_inbox.';
comment on table public.taste_rejection_media is
  'What is kept of a rejected asset: a screenshot or strip (at most 400 KB) or a clip (an mp4 of at most 1.6 MB and 4.5 s). A master is never stored.';
comment on table public.taste_rejection_inbox is
  'What a session''s one-step capture files: his words with where and when, and a screenshot, a master with the moment, or a whole cut. Read once by the inspirationhouse rejections engine; kept as filed.';
comment on table public.taste_floor_standards is
  'The standards the inspirationhouse engine reads into his rejections, form or workflow only, decided only through mindmake_studio_learning_proposals. support_n is recounted by trigger.';
comment on view public.taste_floor is
  'The floor as a session reads it: each open standard, approved, reworded or draft. Makers read all of it; reviewers and pre-delivery checks may test work against approved and reworded standards and his words (Ruling, Krish, 2026-10-28: craft and process, never subject).';

-- 7. Access: service role only, like the taste ledger ------------------------------------------------------------------

alter table public.taste_rejection_quotes enable row level security;
alter table public.taste_rejections enable row level security;
alter table public.taste_rejection_media enable row level security;
alter table public.taste_rejection_inbox enable row level security;
alter table public.taste_floor_standards enable row level security;

revoke all on public.taste_rejection_quotes, public.taste_rejections, public.taste_rejection_media,
  public.taste_rejection_inbox, public.taste_floor_standards, public.taste_floor
  from public, anon, authenticated;

grant select, insert, update on public.taste_rejection_quotes to service_role;
grant select, insert, update on public.taste_rejections to service_role;
grant select, insert, update on public.taste_rejection_media to service_role;
grant select, insert, update on public.taste_rejection_inbox to service_role;
grant select, insert, update on public.taste_floor_standards to service_role;
grant select on public.taste_floor to service_role;
-- Supabase's default privileges give the service role everything on a new table: take back delete and truncate, so his
-- words, the records and the captures can only be withdrawn or stamped, never removed, by the engine's key.
revoke delete, truncate on public.taste_rejection_quotes, public.taste_rejections, public.taste_rejection_media,
  public.taste_rejection_inbox, public.taste_floor_standards from service_role;

create policy taste_rejection_quotes_service_all on public.taste_rejection_quotes
  for all to service_role using (true) with check (true);
create policy taste_rejections_service_all on public.taste_rejections
  for all to service_role using (true) with check (true);
create policy taste_rejection_media_service_all on public.taste_rejection_media
  for all to service_role using (true) with check (true);
create policy taste_rejection_inbox_service_all on public.taste_rejection_inbox
  for all to service_role using (true) with check (true);
create policy taste_floor_standards_service_all on public.taste_floor_standards
  for all to service_role using (true) with check (true);

commit;
