-- A series piece moves to any day at his press, and his Approve on a day that already holds a piece says what it
-- replaces and where that piece goes (docs/PUBLISH_BOARDS.md, "Replacing a day's piece, and Move to… on a series
-- piece").
--
-- Krish, 13 Nov 2026, on the live board, trying to put "The Great Recount" on Fri 20 and bring Fri 20's data-centre
-- piece forward: "There is no approve button. I have to click through five different fucking pages for one idea, even
-- though there are actually many ideas." Earlier the same day: "the great recount should be for 20 Nov, and the current
-- 20 Nov piece should be brought forward as it is time sensitive", then "approved on both, get it done".
--
-- Until now a series piece stood on its day only by his pick for that day (picks/<day>, one per day), so a piece could
-- not move to another day without taking that day's pick, could not stand beside another piece, and a day's pick could
-- not be replaced and the old piece sent somewhere in one press. This adds:
--
--   1. A placement, his press: the board document picks/place-<day>-<piece id> {kind: place_piece, piece_id, placed}.
--      placed true is his approval of that piece on that day (via 'placed'); placed false takes it back (withdrawn), or,
--      with later true, is his File for later on it (filed). Recorded into idea_outcomes by idea_outcome_record, like
--      every other press, from a revision Krish saved.
--   2. board_approvals_now stands placements too, and a placement supersedes every earlier approval of the same piece
--      in that week on another document (but for an approval on the same day it keeps it on, alongside): once he has
--      moved a piece, the pick that first put it on a day no longer holds it there, so nothing but his next press puts
--      it back. His Approve again on that day, with the same words, records a new approval (idea_outcome_record).
--   3. series_piece_place(p): his move or his replacing Approve in one transaction: the board documents (the day's new
--      pick, the placement the piece leaves, the placement it goes to), then each piece's day on content_ideas, guarded
--      on the updated_at the board read, and the move kept append only in series_moves. The content_ideas gate checks
--      his approval for every new day; any part refused, none of it lands.
--
-- Additive: one check widened, one table, one function new, two functions replaced (idea_outcome_record with one branch
-- added; board_approvals_now with placements and the supersede rule). Re-runnable. Replayed on PGlite by
-- tests/series-moves-db.mjs on every pull request.
--
-- Undo: drop function series_piece_place(jsonb); drop trigger series_moves_no_change on series_moves; drop table
-- series_moves (his moves: keep a copy first); restore board_approvals_now from 20261126090000_ideas_gate.sql and
-- idea_outcome_record from 20261129090000_offday_items.sql; the via check may stay wide (rows with via 'placed' are his).

alter table public.idea_outcomes drop constraint if exists idea_outcomes_via_check;
alter table public.idea_outcomes add constraint idea_outcomes_via_check
  check (via in ('pick', 'offday', 'recorded', 'approve_publish', 'press', 'placed'));

create table if not exists public.series_moves (
  id bigint generated always as identity primary key,
  piece_id uuid not null,
  -- move: Move to… on the piece; replace: his Approve of another idea on its day; replaced: the piece that Approve
  -- replaced, and where it went.
  kind text not null check (kind in ('move', 'replace', 'replaced')),
  from_date date,
  to_date date,
  -- later: back to his Ideas for Later; alongside: it stays on its day beside the piece that replaced it.
  to_place text not null check (to_place in ('day', 'later', 'alongside')),
  words text check (words is null or length(words) <= 2000),
  moved_by text not null check (moved_by = 'Krish'),
  moved_at timestamptz not null default now()
);
create index if not exists series_moves_piece on public.series_moves (piece_id, id desc);
alter table public.series_moves enable row level security;
revoke all on public.series_moves from anon, authenticated, service_role;
grant select, insert on public.series_moves to service_role;

create or replace function public.series_moves_refuse() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'series_moves is append only: his moves are never changed or removed' using errcode = 'P0001';
end $$;
drop trigger if exists series_moves_no_change on public.series_moves;
create trigger series_moves_no_change before update or delete on public.series_moves
  for each row execute function public.series_moves_refuse();

-- 20261129090000_offday_items.sql's function, with one branch added: his placement of a series piece on a day.
create or replace function public.idea_outcome_record(h public.board_history, p_source text default 'publish_board') returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b jsonb := h.body;
  uuid_re constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  sha_re constant text := '^[a-f0-9]{64}$';
  days constant text[] := array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  d text; v_outcome text; v_via text; v_idea text; v_ref text; v_words text; v_sha text; v_shown jsonb;
  last_outcome text; last_idea text; last_sha text; last_words text; last_at timestamptz; last_id bigint;
begin
  if h.updated_by is distinct from 'Krish' or b is null or jsonb_typeof(b) <> 'object' then return; end if;
  if h.collection = 'picks' and h.doc_id = any(days) and not (b ? 'kind') then
    d := h.doc_id; v_via := 'pick'; v_outcome := 'approved';
    v_idea := b->>'idea_id';
    if v_idea is null or v_idea !~ uuid_re then return; end if;
    v_ref := b->>'pick';
    v_words := nullif(btrim(coalesce(b->>'note', '')), '');
    v_sha := case when b->>'option_sha256' ~ sha_re then b->>'option_sha256' end;
    v_shown := jsonb_strip_nulls(jsonb_build_object('so_what', b->'so_what', 'story', b->'story'));
  elsif h.collection = 'picks' and h.doc_id ~ ('^place-(mon|tue|wed|thu|fri|sat|sun)-' || substr(uuid_re, 2)) and b->>'kind' = 'place_piece' then
    -- 20261201100000: his placement of a series piece on a day (Move to…, or the piece a replacing Approve sent there).
    d := split_part(h.doc_id, '-', 2); v_via := 'placed'; v_ref := h.doc_id;
    v_idea := substr(h.doc_id, length('place-') + 5);
    if lower(coalesce(b->>'piece_id', '')) <> lower(v_idea) then return; end if;
    v_outcome := case when b->>'placed' = 'true' then 'approved' when b->>'later' = 'true' then 'filed' else 'withdrawn' end;
    v_words := nullif(btrim(coalesce(b->>'words', '')), '');
  elsif h.collection = 'picks' and h.doc_id ~ '^(mon|tue|wed|thu|fri|sat|sun)-publish$' and b->>'kind' = 'approve_publish' then
    d := split_part(h.doc_id, '-', 1); v_via := 'approve_publish';
    v_idea := b->>'piece_id';
    if v_idea is null or v_idea !~ uuid_re then return; end if;
    v_outcome := case when b->>'approved' = 'true' then 'approved' else 'withdrawn' end;
  elsif h.collection = 'queue' and h.doc_id ~ '^off-(mon|tue|wed|thu|fri|sat|sun)-' and b->>'use' = 'offday' then
    d := split_part(h.doc_id, '-', 2); v_ref := h.doc_id;
    v_idea := case when b->>'piece_id' ~ uuid_re then b->>'piece_id' else h.doc_id end;
    if b ? 'idea' or b ? 'direction' or b ? 'mock' then
      v_via := 'offday';
      v_outcome := case b->'idea'->>'verdict' when 'approve' then 'approved' when 'improve' then 'improved' when 'reject' then 'rejected'
        when 'next_week' then 'filed' when 'trend' then 'trend' end;
      v_words := coalesce(nullif(btrim(coalesce(b->'idea'->>'words', '')), ''), nullif(btrim(coalesce(b->'direction'->>'words', '')), ''),
        nullif(btrim(coalesce(b->'note'->>'words', '')), ''));
      v_sha := case when b->'idea'->>'sha256' ~ sha_re then b->'idea'->>'sha256' end;
      v_shown := case when jsonb_typeof(b->'idea'->'shown') = 'object' then b->'idea'->'shown' end;
      if v_outcome is null and jsonb_typeof(b->'moved') = 'object' then
        v_outcome := 'withdrawn';
        v_words := coalesce(v_words, nullif(btrim(coalesce(b->'moved'->>'words', '')), ''));
      end if;
    elsif b->>'approved' in ('true', 'false') then
      v_via := case when b->>'kind' = 'recorded' then 'recorded' else 'offday' end;
      v_outcome := case when b->>'approved' = 'true' then 'approved' else 'withdrawn' end;
      v_words := case when jsonb_typeof(b->'note') = 'string' then nullif(btrim(b->>'note'), '') end;
      v_sha := case when b->>'kind' = 'recorded' and b->>'script_sha256' ~ sha_re then b->>'script_sha256'
        when b->>'copy_sha256' ~ sha_re then b->>'copy_sha256' end;
    end if;
  elsif h.collection = 'queue' and b ? 'use' and h.doc_id ~ '^(mon|tue|wed|thu|fri|sat|sun)-[0-9]{1,3}$' then
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
  if v_shown is not null and length(v_shown::text) > 20000 then v_shown := null; end if;
  select o.outcome, o.idea_id, o.option_sha256, o.words, o.decided_at, o.id into last_outcome, last_idea, last_sha, last_words, last_at, last_id
    from idea_outcomes o where o.week = h.week and o.doc = h.collection || '/' || h.doc_id order by o.decided_at desc, o.id desc limit 1;
  -- The same answer saved again records nothing twice, unless a placement of the same piece came after it (20261201100000):
  -- then that answer no longer stands, and his press again is a new approval.
  if found and last_outcome = v_outcome and last_idea = v_idea and last_sha is not distinct from v_sha
     and last_words is not distinct from left(v_words, 4000)
     and not exists (select 1 from idea_outcomes s where s.week = h.week and s.via = 'placed' and s.idea_id = v_idea
                     and s.doc <> h.collection || '/' || h.doc_id and (s.decided_at > last_at or (s.decided_at = last_at and s.id > last_id))) then
    return;
  end if;
  insert into idea_outcomes (week, day, date, idea_id, option_ref, doc, revision, outcome, via, words, option_sha256, shown,
    decided_by, decided_at, source)
  values (h.week, d, h.week + (array_position(days, d) - 1), v_idea, v_ref, h.collection || '/' || h.doc_id, h.revision,
    v_outcome, v_via, left(v_words, 4000), v_sha, case when v_shown = '{}'::jsonb then null else v_shown end,
    'Krish', h.updated_at, p_source);
end $$;
revoke all on function public.idea_outcome_record(public.board_history, text) from public, anon, authenticated, service_role;

-- The approvals that stand now (20261126090000), with his placements, and a placement superseding every earlier
-- approval of the same piece in the week on another document.
create or replace function public.board_approvals_now(p_week date)
returns table (idea_id text, day text, date date, via text, doc text, option_ref text, revision bigint, decided_at timestamptz,
  option_sha256 text, words text, source text)
language sql stable security definer set search_path = public, pg_temp as $$
  with ranked as (
    select o.*, row_number() over (
      partition by case when o.via = 'pick' then 'pick/' || o.day else o.doc end
      order by o.decided_at desc, o.id desc) as n
    from idea_outcomes o
    where o.week = p_week and o.via in ('pick', 'offday', 'recorded', 'approve_publish', 'placed')
  )
  select r.idea_id, r.day, r.date, r.via, r.doc, r.option_ref, r.revision, r.decided_at, r.option_sha256, r.words, r.source
  from ranked r where r.n = 1 and r.outcome = 'approved'
    and not exists (
      select 1 from idea_outcomes s
      where s.week = p_week and s.via = 'placed' and s.idea_id = r.idea_id and s.doc <> r.doc
        and (s.decided_at > r.decided_at or (s.decided_at = r.decided_at and s.id > r.id))
        -- Kept alongside on the same day: his approvals of it on that day (its Approve for publish) still stand.
        and not (s.outcome = 'approved' and s.date = r.date))
  order by r.date, r.decided_at
$$;
revoke all on function public.board_approvals_now(date) from public, anon, authenticated;
grant execute on function public.board_approvals_now(date) to service_role;

-- His move of a series piece, or his Approve that replaces a day's piece, in one transaction. p:
--   actor (must be Krish), kind ('move' or 'replace'), words (his, optional),
--   writes: the board documents of his press, in order, each {week, id, body, revision}: only picks/<day> (the day's
--     new pick, for a replace) and picks/place-<day>-<piece id>;
--   pieces: each piece's new day, in order, each {id, updated_at (as the board read it), scheduled_for (a date, or
--     null for later), state, lane_slot, protect (true to set protected_at when it is not), kind, from_date, to_place};
--     a piece whose day does not change still names itself (to_place 'alongside') so its move is kept.
-- Like board_save, it trusts the actor the route names: the routes pass Krish only for his own press (403 his_press for
-- anyone else), and a call naming any other actor is refused here.
-- Answers {ok: true, revisions, pieces} or {ok: false, error: 'stale', piece}. A refused write (a revision that changed,
-- no approval standing) raises, and nothing lands.
create or replace function public.series_piece_place(p jsonb) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  w jsonb; x jsonb; saved jsonb; revs jsonb := '[]'::jsonb; done jsonb := '[]'::jsonb;
  v_id uuid; v_to date; n int;
begin
  if coalesce(p->>'actor', '') <> 'Krish' then
    raise exception 'his_press: only his press moves a piece or replaces a day''s piece' using errcode = 'P0001';
  end if;
  if coalesce(p->>'kind', '') not in ('move', 'replace') then raise exception 'invalid_move: kind' using errcode = 'P0001'; end if;
  for x in select * from jsonb_array_elements(coalesce(p->'pieces', '[]'::jsonb)) loop
    perform pg_advisory_xact_lock(hashtextextended('series-piece/' || (x->>'id'), 0));
  end loop;
  for w in select * from jsonb_array_elements(coalesce(p->'writes', '[]'::jsonb)) loop
    if coalesce(w->>'id', '') !~ '^((mon|tue|wed|thu|fri|sat)|place-(mon|tue|wed|thu|fri|sat|sun)-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$' then
      raise exception 'invalid_move: only a day''s pick and placements are written' using errcode = 'P0001';
    end if;
    if w->>'id' !~ '^place-' and p->>'kind' <> 'replace' then
      raise exception 'invalid_move: a day''s pick changes only with a replacing Approve' using errcode = 'P0001';
    end if;
    saved := public.board_save((w->>'week')::date, 'picks', w->>'id', w->'body', coalesce((w->>'revision')::bigint, 0), 'Krish');
    if not coalesce((saved->>'ok')::boolean, false) then
      raise exception 'revision_conflict: picks/% in the week of % changed since the board was read', w->>'id', w->>'week' using errcode = 'P0001';
    end if;
    revs := revs || jsonb_build_object('week', w->>'week', 'id', w->>'id', 'revision', (saved->>'revision')::bigint);
  end loop;
  for x in select * from jsonb_array_elements(coalesce(p->'pieces', '[]'::jsonb)) loop
    v_id := (x->>'id')::uuid;
    v_to := nullif(x->>'scheduled_for', '')::date;
    if coalesce(x->>'to_place', 'day') <> 'alongside' then
      update public.content_ideas set
        scheduled_for = v_to,
        state = coalesce(nullif(x->>'state', ''), state),
        lane_slot = coalesce(nullif(x->>'lane_slot', ''), lane_slot),
        protected_at = case when coalesce((x->>'protect')::boolean, false) and protected_at is null then now() else protected_at end,
        updated_at = now()
      where id = v_id and date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', (x->>'updated_at')::timestamptz);
      get diagnostics n = row_count;
      if n = 0 then
        raise exception 'stale_piece: % changed since the board was read', v_id using errcode = 'P0001';
      end if;
    end if;
    insert into public.series_moves (piece_id, kind, from_date, to_date, to_place, words, moved_by)
    values (v_id, coalesce(x->>'kind', p->>'kind'), nullif(x->>'from_date', '')::date, v_to, coalesce(x->>'to_place', 'day'),
      nullif(left(btrim(coalesce(p->>'words', '')), 2000), ''), 'Krish');
    done := done || jsonb_build_object('id', v_id, 'scheduled_for', v_to, 'to_place', coalesce(x->>'to_place', 'day'));
  end loop;
  return jsonb_build_object('ok', true, 'revisions', revs, 'pieces', done);
end $$;
revoke all on function public.series_piece_place(jsonb) from public, anon, authenticated;
grant execute on function public.series_piece_place(jsonb) to service_role;
