-- The ideas gate: only Krish's Approve on the ideas board puts an idea on a publish board (docs/PUBLISH_BOARDS.md,
-- "The ideas gate").
--
-- Krish, 2026-11-11: "If they're approved, they should move into the publish board. The ideas board-to-publish board
-- process should be bulletproof. I shouldn't end up seeing random ideas in the publish board that I never wanted there
-- and that I didn't approve to move to the publish board. This process should be crystal clear, incorrigible, and
-- incorruptible."
--
-- Three parts, all additive:
--   1. idea_outcomes: one row for every answer Krish gives an idea on the board, append only. Each answer is one of
--      five outcomes (approved, filed, rejected, trend, improved; withdrawn when he takes a press back), with the idea,
--      the day, his words, the hash of the option text he saw, and when. Rows are written only by a trigger on
--      board_history, from a revision Krish saved through board_save, and an insert that names no such revision is
--      refused. Nothing in it is ever changed or removed.
--   2. board_approvals_now(week): the approvals that stand now. A publishing day (Monday, Wednesday, Friday) has his
--      latest pick for that day; an off-day option has its latest answer, when that answer is Approve; his Approve for
--      publish on a day names the piece too.
--   3. A trigger on content_ideas that refuses to put a piece on a day (scheduled_for set or changed, or a piece on a
--      day brought back from buried or dropped) unless an approval for that exact piece and that exact date stands.
--      Taking a piece off a day is never refused. Every writer goes through it: the engine's routes, Control Centre,
--      a session's SQL, a workflow.
--
-- His earlier presses are recorded once from board_history (source board_history_backfill), so the weeks already
-- planned keep the approvals he gave. A pick saved before 11 November carries no option hash (option_sha256 null):
-- its text was not bound, and the board says so.
--
-- What the database cannot tell: a writer holding the service key can still write board_history as 'Krish' by hand.
-- Nothing in a database tells a forged name from his press; the routes refuse any other writer his presses
-- (hisOnlyRefusal), and this ledger names the revision every approval came from.
--
-- Undo: drop trigger content_ideas_board_gate on content_ideas; drop trigger idea_outcomes_from_history on
-- board_history; drop function content_ideas_board_gate(); drop function idea_outcomes_from_history();
-- drop function board_approval_holds(text, date, text); drop function board_approvals_now(date);
-- drop function idea_outcome_record(board_history, text); drop table idea_outcomes (its rows are his answers: keep a
-- copy first).

create table if not exists public.idea_outcomes (
  id bigint generated always as identity primary key,
  week date not null check (extract(isodow from week) = 1),
  day text not null check (day in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
  date date not null,
  -- The piece (content_ideas id) the answer is about, or the off-day option's own document id when it has no piece.
  idea_id text not null check (length(idea_id) between 1 and 160),
  -- The option on the board the press answered (mon-2, off-sat-goodnews).
  option_ref text,
  -- The board document and the revision of it Krish saved (picks/mon, queue/mon-2, queue/off-sat-goodnews).
  doc text not null,
  revision bigint not null,
  outcome text not null check (outcome in ('approved', 'filed', 'rejected', 'trend', 'improved', 'withdrawn')),
  -- Which press: pick (a publishing day's Approve), offday (an off-day option), recorded (an off-day piece he
  -- records), approve_publish (his Approve for publish), press (the other answers on a publishing day's idea).
  via text not null check (via in ('pick', 'offday', 'recorded', 'approve_publish', 'press')),
  words text check (words is null or length(words) <= 4000),
  option_sha256 text check (option_sha256 is null or option_sha256 ~ '^[a-f0-9]{64}$'),
  shown jsonb check (shown is null or (jsonb_typeof(shown) = 'object' and length(shown::text) <= 20000)),
  decided_by text not null check (decided_by = 'Krish'),
  decided_at timestamptz not null,
  source text not null check (source in ('publish_board', 'board_history_backfill')),
  recorded_at timestamptz not null default now()
);
create index if not exists idea_outcomes_week on public.idea_outcomes (week, doc, decided_at desc);
create index if not exists idea_outcomes_idea on public.idea_outcomes (idea_id, week);

alter table public.idea_outcomes enable row level security;
revoke all on public.idea_outcomes from anon, authenticated, service_role;
grant select on public.idea_outcomes to service_role;

-- Append only: nothing in it is changed, removed or truncated.
create or replace function public.idea_outcomes_refuse() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'idea_outcomes is append only: his answers are never changed or removed (docs/PUBLISH_BOARDS.md, The ideas gate)'
    using errcode = 'P0001';
end $$;
drop trigger if exists idea_outcomes_no_change on public.idea_outcomes;
create trigger idea_outcomes_no_change before update or delete on public.idea_outcomes
  for each row execute function public.idea_outcomes_refuse();
drop trigger if exists idea_outcomes_no_truncate on public.idea_outcomes;
create trigger idea_outcomes_no_truncate before truncate on public.idea_outcomes
  for each statement execute function public.idea_outcomes_refuse();

-- Only a revision Krish saved on the board can be recorded: an insert that names none is refused.
create or replace function public.idea_outcomes_his_press() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from board_history h where h.week = new.week and h.collection || '/' || h.doc_id = new.doc
                 and h.revision = new.revision and h.updated_by = 'Krish') then
    raise exception 'not_his_press: an answer on an idea is recorded only from a press Krish saved on the board (% revision %)', new.doc, new.revision
      using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists idea_outcomes_his_press on public.idea_outcomes;
create trigger idea_outcomes_his_press before insert on public.idea_outcomes
  for each row execute function public.idea_outcomes_his_press();

-- One saved revision of a board document, read as his answer on an idea (or nothing, when it is not one).
create or replace function public.idea_outcome_record(h public.board_history, p_source text default 'publish_board') returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b jsonb := h.body;
  uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  sha_re constant text := '^[a-f0-9]{64}$';
  days constant text[] := array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  d text; v_outcome text; v_via text; v_idea text; v_ref text; v_words text; v_sha text; v_shown jsonb;
  last_outcome text; last_idea text; last_sha text; last_words text;
begin
  if h.updated_by is distinct from 'Krish' or b is null or jsonb_typeof(b) <> 'object' then return; end if;
  if h.collection = 'picks' and h.doc_id = any(days) and not (b ? 'kind') then
    -- His pick for a publishing day: Approved, for the idea it names.
    d := h.doc_id; v_via := 'pick'; v_outcome := 'approved';
    v_idea := b->>'idea_id';
    if v_idea is null or v_idea !~ uuid_re then return; end if;
    v_ref := b->>'pick';
    v_words := nullif(btrim(coalesce(b->>'note', '')), '');
    v_sha := case when b->>'option_sha256' ~ sha_re then b->>'option_sha256' end;
    v_shown := jsonb_strip_nulls(jsonb_build_object('so_what', b->'so_what', 'story', b->'story'));
  elsif h.collection = 'picks' and h.doc_id ~ '^(mon|tue|wed|thu|fri|sat|sun)-publish$' and b->>'kind' = 'approve_publish' then
    -- His Approve for publish names the piece on that day.
    d := split_part(h.doc_id, '-', 1); v_via := 'approve_publish';
    v_idea := b->>'piece_id';
    if v_idea is null or v_idea !~ uuid_re then return; end if;
    v_outcome := case when b->>'approved' = 'true' then 'approved' else 'withdrawn' end;
  elsif h.collection = 'queue' and h.doc_id ~ '^off-(mon|tue|wed|thu|fri|sat|sun)-' and b->>'use' = 'offday' then
    d := split_part(h.doc_id, '-', 2); v_ref := h.doc_id;
    v_idea := case when b->>'piece_id' ~ uuid_re then b->>'piece_id' else h.doc_id end;
    if b ? 'idea' or b ? 'direction' or b ? 'mock' then
      -- His answer on the option's idea is the option's outcome.
      v_via := 'offday';
      v_outcome := case b->'idea'->>'verdict' when 'approve' then 'approved' when 'improve' then 'improved' when 'reject' then 'rejected'
        when 'next_week' then 'filed' when 'trend' then 'trend' end;
      v_words := coalesce(nullif(btrim(coalesce(b->'idea'->>'words', '')), ''), nullif(btrim(coalesce(b->'direction'->>'words', '')), ''),
        nullif(btrim(coalesce(b->'note'->>'words', '')), ''));
      v_sha := case when b->'idea'->>'sha256' ~ sha_re then b->'idea'->>'sha256' end;
      v_shown := case when jsonb_typeof(b->'idea'->'shown') = 'object' then b->'idea'->'shown' end;
    elsif b->>'approved' in ('true', 'false') then
      -- The older off-day press (approved true or false), and an off-day piece he records.
      v_via := case when b->>'kind' = 'recorded' then 'recorded' else 'offday' end;
      v_outcome := case when b->>'approved' = 'true' then 'approved' else 'withdrawn' end;
      v_words := case when jsonb_typeof(b->'note') = 'string' then nullif(btrim(b->>'note'), '') end;
      v_sha := case when b->>'kind' = 'recorded' and b->>'script_sha256' ~ sha_re then b->>'script_sha256'
        when b->>'copy_sha256' ~ sha_re then b->>'copy_sha256' end;
    end if;
  elsif h.collection = 'queue' and b ? 'use' and h.doc_id ~ '^(mon|tue|wed|thu|fri|sat|sun)-[0-9]{1,3}$' then
    -- One of the other answers on a publishing day's idea, or a press taken back.
    d := split_part(h.doc_id, '-', 1); v_via := 'press'; v_ref := h.doc_id;
    v_idea := case when b->>'idea_id' ~ uuid_re then b->>'idea_id' else h.doc_id end;
    v_outcome := case when jsonb_typeof(b->'use') = 'null' then 'withdrawn' else case b->>'use'
      when 'next_week' then 'filed' when 'not_for_us' then 'rejected' when 'wider_piece_context' then 'trend'
      when 'track_over_time' then 'trend' when 'improve' then 'improved' end end;
    v_words := coalesce(nullif(btrim(coalesce(b->>'reason', '')), ''), nullif(btrim(coalesce(b->>'note', '')), ''),
      nullif(btrim(coalesce(b->>'theme', '')), ''));
    v_sha := case when b->>'option_sha256' ~ sha_re then b->>'option_sha256' end;
  else
    return;
  end if;
  if v_outcome is null or d is null then return; end if;
  v_idea := lower(v_idea);
  -- What he was shown is kept when it is small enough to keep whole; the hash binds it either way. A recording never
  -- fails his press: a long story is kept by its hash alone.
  if v_shown is not null and length(v_shown::text) > 20000 then v_shown := null; end if;
  -- The same answer saved again (a note added, a resave) records nothing twice.
  select o.outcome, o.idea_id, o.option_sha256, o.words into last_outcome, last_idea, last_sha, last_words
    from idea_outcomes o where o.week = h.week and o.doc = h.collection || '/' || h.doc_id order by o.decided_at desc, o.id desc limit 1;
  if found and last_outcome = v_outcome and last_idea = v_idea and last_sha is not distinct from v_sha
     and last_words is not distinct from left(v_words, 4000) then
    return;
  end if;
  insert into idea_outcomes (week, day, date, idea_id, option_ref, doc, revision, outcome, via, words, option_sha256, shown,
    decided_by, decided_at, source)
  values (h.week, d, h.week + (array_position(days, d) - 1), v_idea, v_ref, h.collection || '/' || h.doc_id, h.revision,
    v_outcome, v_via, left(v_words, 4000), v_sha, case when v_shown = '{}'::jsonb then null else v_shown end,
    'Krish', h.updated_at, p_source);
end $$;
revoke all on function public.idea_outcome_record(public.board_history, text) from public, anon, authenticated, service_role;

create or replace function public.idea_outcomes_from_history() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform idea_outcome_record(new, 'publish_board');
  return new;
end $$;
revoke all on function public.idea_outcomes_from_history() from public, anon, authenticated, service_role;
drop trigger if exists idea_outcomes_from_history on public.board_history;
create trigger idea_outcomes_from_history after insert on public.board_history
  for each row execute function public.idea_outcomes_from_history();

-- His earlier presses, once, in the order he made them (a re-run records nothing twice).
do $$
declare h public.board_history;
begin
  if not exists (select 1 from public.idea_outcomes where source = 'board_history_backfill') then
    for h in select * from public.board_history where updated_by = 'Krish' order by updated_at, week, collection, doc_id, revision loop
      perform public.idea_outcome_record(h, 'board_history_backfill');
    end loop;
  end if;
end $$;

-- The approvals that stand now for a week: a publishing day's latest pick, an off-day option's latest answer when it
-- is Approve, and his Approve for publish on a day while he has not taken it back.
create or replace function public.board_approvals_now(p_week date)
returns table (idea_id text, day text, date date, via text, doc text, option_ref text, revision bigint, decided_at timestamptz,
  option_sha256 text, words text, source text)
language sql stable security definer set search_path = public, pg_temp as $$
  with ranked as (
    select o.*, row_number() over (
      partition by case when o.via = 'pick' then 'pick/' || o.day else o.doc end
      order by o.decided_at desc, o.id desc) as n
    from idea_outcomes o
    where o.week = p_week and o.via in ('pick', 'offday', 'recorded', 'approve_publish')
  )
  select r.idea_id, r.day, r.date, r.via, r.doc, r.option_ref, r.revision, r.decided_at, r.option_sha256, r.words, r.source
  from ranked r where r.n = 1 and r.outcome = 'approved'
  order by r.date, r.decided_at
$$;
revoke all on function public.board_approvals_now(date) from public, anon, authenticated;
grant execute on function public.board_approvals_now(date) to service_role;

-- Whether an approval for this piece on this date stands: by the piece's own id, or (an off-day option made into a
-- piece) by the option's document named in its meta.offday.doc.
create or replace function public.board_approval_holds(p_idea text, p_date date, p_offday_doc text default null) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from board_approvals_now(p_date - (extract(isodow from p_date)::int - 1)) a
    where a.date = p_date and (a.idea_id = lower(p_idea) or (p_offday_doc is not null and a.doc = p_offday_doc)))
$$;
revoke all on function public.board_approval_holds(text, date, text) from public, anon, authenticated;
grant execute on function public.board_approval_holds(text, date, text) to service_role;

-- The gate itself: a piece goes on a day only with his approval for that exact piece and that exact date.
create or replace function public.content_ideas_board_gate() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare doc text;
begin
  if new.scheduled_for is null or new.buried_at is not null or coalesce(new.state, '') = 'dropped' then return new; end if;
  if tg_op = 'UPDATE' and new.scheduled_for is not distinct from old.scheduled_for
     and old.buried_at is null and coalesce(old.state, '') <> 'dropped' then
    return new;
  end if;
  if board_approval_holds(new.id::text, new.scheduled_for, null) then return new; end if;
  doc := new.meta->'offday'->>'doc';
  if doc is not null and board_approval_holds(new.id::text, new.scheduled_for, doc)
     and not exists (select 1 from content_ideas c where c.id <> new.id and c.scheduled_for = new.scheduled_for
                     and c.buried_at is null and coalesce(c.state, '') <> 'dropped' and c.meta->'offday'->>'doc' = doc) then
    return new;
  end if;
  raise exception 'not_approved_by_krish: % goes on the publish board for % only once Krish approves it on the ideas board', new.id, new.scheduled_for
    using errcode = 'P0001',
      hint = 'His Approve on the live Publish Board (Control Centre, Content) puts it on its day. A session proposes ideas; it never places one.';
end $$;
revoke all on function public.content_ideas_board_gate() from public, anon, authenticated, service_role;
drop trigger if exists content_ideas_board_gate on public.content_ideas;
create trigger content_ideas_board_gate before insert or update on public.content_ideas
  for each row execute function public.content_ideas_board_gate();
