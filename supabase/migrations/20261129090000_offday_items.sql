-- The one home of the day of every off-day item (docs/PUBLISH_BOARDS.md, "Moving an off-day item to any day").
--
-- Ruling (Krish, 2026-11-12): any off-day post or idea moves to any day at his press, and the move updates every place
-- that names its day. His words: "I should be able to fluidly reassign any off-day post or assign any off-day idea to
-- any day at will, and that should update the single source of truth everywhere."
--
-- Until now an off-day item's day was written in three places at once: the key it sat under in the week's ideas.json
-- on GitHub (offdays.<day>), the id of the board document his press saved (queue/off-<day>-<option>), and, for a piece
-- he records, content_ideas.scheduled_for. A file on GitHub cannot take a press every few seconds from two writers, and
-- Growth's own options (growth.py mix offdays) never reached the live board at all, because the board read only that
-- file. So the day moves here, and only here:
--
--   offday_items   one row per off-day item: what it is (its option as shown), where it came from (engine: the
--                  week's ideas.json; growth: Growth's options, written through the engine's API), and where it is now:
--                  offered on a day (the slate, not yet his), approved on a day (on the publish board), later (in his
--                  Ideas for Later) or withdrawn (Growth took back a proposal he never pressed). Versioned: every
--                  change bumps version, and a move names the version it saw, so two writers at once never both land.
--   offday_moves   every move he made, append only: from where, to where, when, his words.
--
-- ideas.json stays the plan's starting point only: an engine option no press has touched sits on the day the plan
-- offered it; the moment he approves it, moves it or files it for later, its row is the one place that says its day,
-- and nothing in ideas.json moves it again.
--
-- The gate holds here as it holds on content_ideas (20261126090000_ideas_gate.sql): a row is approved on a day only
-- while his approval for exactly that board document on exactly that date stands (board_approval_holds). A move is one
-- transaction (offday_item_move): it saves his press for the new day (an Approve of queue/off-<day>-<option> in the new
-- week), takes his approval off the old day (the same document with `moved`, which idea_outcome_record now reads as
-- withdrawn), moves the row, and for a piece he records moves content_ideas.scheduled_for too; any part refused, none
-- of it lands. Growth's options come in through offday_items_offer, which never touches a row he has pressed.
--
-- Additive: two tables, four functions, three triggers, a backfill of every off-day approval that stands, and one
-- branch added to idea_outcome_record (a revision of an off-day document carrying `moved` and no verdict is his
-- approval taken back). Re-runnable. Replayed on PGlite by tests/offday-items-db.mjs on every pull request.
--
-- Undo: drop trigger offday_items_gate on offday_items; drop trigger offday_items_signal on offday_items;
-- drop trigger offday_moves_no_change on offday_moves; drop function offday_item_move(jsonb);
-- drop function offday_items_offer(date, text, jsonb); drop function offday_items_gate(); drop function
-- offday_items_signal(); drop function offday_moves_refuse(); drop table offday_moves (his moves: keep a copy first);
-- drop table offday_items; and restore idea_outcome_record from 20261126090000_ideas_gate.sql.

create table if not exists public.offday_items (
  item text primary key check (item ~ '^(engine|growth):[0-9]{4}-[0-9]{2}-[0-9]{2}:[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,59}$'),
  source text not null check (source in ('engine', 'growth')),
  origin_week date not null check (extract(isodow from origin_week) = 1),
  option_id text not null check (option_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,59}$'),
  -- The option as it was shown (id, format, source, copy, hook, pitch, cards, drive, lane...): what the board draws
  -- when the item is on a day its week's ideas.json does not list it, and what his approval's hash is worked from.
  option jsonb not null check (jsonb_typeof(option) = 'object' and length(option::text) <= 60000),
  state text not null check (state in ('offered', 'approved', 'later', 'withdrawn')),
  week date check (week is null or extract(isodow from week) = 1),
  day text check (day is null or day in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun')),
  date date,
  -- The board document his presses on it go to in `week`: queue/off-<day>-<option_id>.
  doc text,
  -- A piece he records (an off-day piece with its own content_ideas row), when the item is one.
  piece_id uuid,
  -- Its post's folder in Drive (3 Posts), by ID: renamed to its new date when it moves.
  drive_folder text check (drive_folder is null or drive_folder ~ '^[A-Za-z0-9_-]{20,80}$'),
  -- What Growth has scheduled for it on a platform ([{channel, due_at, buffer_post_id, state}]), as Growth reports it.
  scheduled jsonb not null default '[]'::jsonb check (jsonb_typeof(scheduled) = 'array' and length(scheduled::text) <= 20000),
  -- What each place that names its day did after the last move (Drive, the research library), for the board to say.
  followed jsonb not null default '{}'::jsonb check (jsonb_typeof(followed) = 'object' and length(followed::text) <= 8000),
  version bigint not null default 1 check (version >= 1),
  placed_by text not null check (length(placed_by) between 1 and 80),
  placed_at timestamptz not null default now(),
  -- The board_history revision of his press that put it where it is.
  revision bigint,
  created_at timestamptz not null default now(),
  check ((week is null) = (day is null) and (day is null) = (date is null)),
  check (date is null or date = week + (array_position(array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], day) - 1)),
  check (doc is null or doc = 'queue/off-' || day || '-' || option_id),
  check (state <> 'approved' or (date is not null and doc is not null and placed_by = 'Krish')),
  check (state <> 'offered' or (date is not null and doc is not null)),
  check (state <> 'later' or (date is null and doc is null and placed_by = 'Krish'))
);
create index if not exists offday_items_week on public.offday_items (week, day);
create index if not exists offday_items_origin on public.offday_items (origin_week, source);
-- One item per board document: two options never share his press.
create unique index if not exists offday_items_doc on public.offday_items (week, doc) where state in ('offered', 'approved');

create table if not exists public.offday_moves (
  id bigint generated always as identity primary key,
  item text not null references public.offday_items (item),
  version bigint not null,
  from_state text,
  from_week date,
  from_day text,
  from_date date,
  to_state text not null check (to_state in ('offered', 'approved', 'later')),
  to_week date,
  to_day text,
  to_date date,
  words text check (words is null or length(words) <= 2000),
  moved_by text not null check (moved_by = 'Krish'),
  moved_at timestamptz not null default now()
);
create index if not exists offday_moves_item on public.offday_moves (item, id desc);

alter table public.offday_items enable row level security;
alter table public.offday_moves enable row level security;
revoke all on public.offday_items from public, anon, authenticated, service_role;
revoke all on public.offday_moves from public, anon, authenticated, service_role;
grant select, insert, update on public.offday_items to service_role;
grant select, insert on public.offday_moves to service_role;

-- His moves are append only.
create or replace function public.offday_moves_refuse() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  raise exception 'offday_moves is append only: his moves are never changed or removed' using errcode = 'P0001';
end $$;
drop trigger if exists offday_moves_no_change on public.offday_moves;
create trigger offday_moves_no_change before update or delete on public.offday_moves
  for each row execute function public.offday_moves_refuse();

-- The gate: an item is approved on a day only while his approval for that document on that date stands, and a row he
-- placed is never moved by anyone else.
create or replace function public.offday_items_gate() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.state = 'approved' and (tg_op = 'INSERT' or old.state is distinct from 'approved' or new.date is distinct from old.date
     or new.doc is distinct from old.doc) then
    if not board_approval_holds(coalesce(new.piece_id::text, split_part(new.doc, '/', 2)), new.date, new.doc) then
      raise exception 'not_approved_by_krish: % goes on the publish board for % only once Krish approves it there', new.item, new.date
        using errcode = 'P0001',
          hint = 'His Move to or Approve on the live Publish Board (Control Centre, Content) puts it on a day. A session or Growth proposes; it never places.';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.state in ('approved', 'later') and new.placed_by is distinct from 'Krish'
     and (new.state, new.week, new.day, new.doc) is distinct from (old.state, old.week, old.day, old.doc) then
    raise exception 'his_placement: % was placed by Krish; only his press moves it', new.item using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.offday_items_gate() from public, anon, authenticated, service_role;
drop trigger if exists offday_items_gate on public.offday_items;
create trigger offday_items_gate before insert or update on public.offday_items
  for each row execute function public.offday_items_gate();

-- The live board hears a change to an item on its old week and its new one (board_signal, 20261125090000).
create or replace function public.offday_items_signal() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  begin
    if tg_op = 'UPDATE' and old.week is not null and old.week is distinct from new.week then perform board_signal_bump(old.week, 'offday'); end if;
    if new.week is not null then perform board_signal_bump(new.week, 'offday'); end if;
    if new.origin_week is distinct from new.week then perform board_signal_bump(new.origin_week, 'offday'); end if;
  exception when others then null;
  end;
  return null;
end $$;
revoke all on function public.offday_items_signal() from public, anon, authenticated, service_role;
drop trigger if exists offday_items_signal on public.offday_items;
create trigger offday_items_signal after insert or update on public.offday_items
  for each row execute function public.offday_items_signal();

-- A revision of an off-day document that carries `moved` and no verdict on its idea is his approval taken back (the
-- move's other half): recorded as withdrawn, so board_approvals_now no longer stands it on the day it left. Everything
-- else is 20261126090000_ideas_gate.sql's function, unchanged.
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
    d := h.doc_id; v_via := 'pick'; v_outcome := 'approved';
    v_idea := b->>'idea_id';
    if v_idea is null or v_idea !~ uuid_re then return; end if;
    v_ref := b->>'pick';
    v_words := nullif(btrim(coalesce(b->>'note', '')), '');
    v_sha := case when b->>'option_sha256' ~ sha_re then b->>'option_sha256' end;
    v_shown := jsonb_strip_nulls(jsonb_build_object('so_what', b->'so_what', 'story', b->'story'));
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
      -- 20261129090000: the item moved to another day (offday_item_move): his approval here is taken back.
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

-- One move, in one transaction (docs/PUBLISH_BOARDS.md, "Moving an off-day item to any day"). p:
--   item, version (the version he saw; 0 for an item with no row yet), actor (must be Krish), source, origin_week,
--   option_id, option (as shown), drive_folder, piece_id,
--   state ('approved' on a day, 'later' for his Ideas for Later, 'offered' only to put back what an Undo restores),
--   place {week, day} (null for later), words (his, optional),
--   writes: the board documents of his press, in order, each {week, id, body, revision}: the day it leaves (with
--   `moved`), then the day it goes to (his Approve). Only queue/off-<day>-<option> documents.
-- Answers {ok: true, item, version, state, week, day, date, revisions} or {ok: false, error: 'stale', version, ...}. A
-- refused write (a revision that changed, no approval standing) raises, and nothing of the move lands.
create or replace function public.offday_item_move(p jsonb) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  days constant text[] := array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  v_item text := p->>'item';
  v_expected bigint := coalesce((p->>'version')::bigint, 0);
  v_state text := p->>'state';
  r public.offday_items%rowtype;
  had boolean;
  w jsonb; saved jsonb; revs jsonb := '[]'::jsonb; v_rev bigint;
  v_week date; v_day text; v_date date; v_doc text; v_option_id text := p->>'option_id';
  v_piece uuid := nullif(p->>'piece_id', '')::uuid; v_next bigint;
begin
  if coalesce(p->>'actor', '') <> 'Krish' then
    raise exception 'his_press: only his press moves an off-day item' using errcode = 'P0001';
  end if;
  if v_state not in ('approved', 'later', 'offered') then raise exception 'invalid_move: state %', v_state using errcode = 'P0001'; end if;
  if jsonb_typeof(p->'place') = 'object' then
    v_week := (p->'place'->>'week')::date; v_day := p->'place'->>'day';
    if v_day <> all(days) or extract(isodow from v_week) <> 1 then raise exception 'invalid_move: place' using errcode = 'P0001'; end if;
    v_date := v_week + (array_position(days, v_day) - 1);
    v_doc := 'queue/off-' || v_day || '-' || v_option_id;
  end if;
  if (v_state = 'later') <> (v_week is null) then raise exception 'invalid_move: a day for a day, none for later' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended('offday-item/' || v_item, 0));
  select * into r from public.offday_items where item = v_item for update;
  had := found;
  if (had and r.version <> v_expected) or (not had and v_expected <> 0) then
    return jsonb_build_object('ok', false, 'error', 'stale', 'version', case when had then r.version else 0 end,
      'state', case when had then r.state end, 'week', case when had then r.week end, 'day', case when had then r.day end);
  end if;
  for w in select * from jsonb_array_elements(coalesce(p->'writes', '[]'::jsonb)) loop
    if coalesce(w->>'id', '') !~ '^off-(mon|tue|wed|thu|fri|sat|sun)-[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,59}$' then
      raise exception 'invalid_move: only off-day documents are written' using errcode = 'P0001';
    end if;
    saved := public.board_save((w->>'week')::date, 'queue', w->>'id', w->'body', coalesce((w->>'revision')::bigint, 0), 'Krish');
    if not coalesce((saved->>'ok')::boolean, false) then
      raise exception 'revision_conflict: % in the week of % changed since the board was read', w->>'id', w->>'week' using errcode = 'P0001';
    end if;
    revs := revs || jsonb_build_object('week', w->>'week', 'id', w->>'id', 'revision', (saved->>'revision')::bigint);
    v_rev := (saved->>'revision')::bigint;
  end loop;
  if had then
    update public.offday_items set state = v_state, week = v_week, day = v_day, date = v_date,
      doc = case when v_state = 'later' then null else v_doc end,
      option = coalesce(p->'option', option), drive_folder = coalesce(nullif(p->>'drive_folder', ''), drive_folder),
      piece_id = coalesce(v_piece, piece_id), version = version + 1, placed_by = 'Krish', placed_at = now(),
      revision = coalesce(v_rev, revision)
    where item = v_item returning version into v_next;
  else
    insert into public.offday_items (item, source, origin_week, option_id, option, state, week, day, date, doc, piece_id, drive_folder,
      version, placed_by, placed_at, revision)
    values (v_item, p->>'source', (p->>'origin_week')::date, v_option_id, coalesce(p->'option', '{}'::jsonb), v_state, v_week, v_day, v_date,
      case when v_state = 'later' then null else v_doc end, v_piece, nullif(p->>'drive_folder', ''), 1, 'Krish', now(), v_rev)
    returning version into v_next;
  end if;
  -- A piece he records moves with it: the content_ideas gate checks his approval for the new date.
  if coalesce(v_piece, r.piece_id) is not null then
    update public.content_ideas set scheduled_for = case when v_state = 'approved' then v_date end,
      meta = jsonb_set(coalesce(meta, '{}'::jsonb), '{offday}', coalesce(meta->'offday', '{}'::jsonb)
        || jsonb_build_object('week', v_week, 'day', v_day, 'date', v_date, 'doc', case when v_state = 'later' then null else v_doc end))
    where id = coalesce(v_piece, r.piece_id);
  end if;
  insert into public.offday_moves (item, version, from_state, from_week, from_day, from_date, to_state, to_week, to_day, to_date, words, moved_by)
  values (v_item, v_next, case when had then r.state end, case when had then r.week end, case when had then r.day end,
    case when had then r.date end, v_state, v_week, v_day, v_date, nullif(left(btrim(coalesce(p->>'words', '')), 2000), ''), 'Krish');
  return jsonb_build_object('ok', true, 'item', v_item, 'version', v_next, 'state', v_state, 'week', v_week, 'day', v_day, 'date', v_date,
    'doc', case when v_state = 'later' then null else v_doc end, 'revisions', revs);
end $$;
revoke all on function public.offday_item_move(jsonb) from public, anon, authenticated;
grant execute on function public.offday_item_move(jsonb) to service_role;

-- Growth's off-day options for a week, written through the engine's API (POST /api/board/<Monday>/offdays): each one
-- offered on its day, its words as Growth wrote them. A row he has pressed (approved, later) is never touched; a
-- Growth option of that week no longer in the list, and never pressed by him, is withdrawn (kept, never deleted).
-- p_items: [{item, option_id, option, day, drive_folder}]. Answers the counts.
create or replace function public.offday_items_offer(p_week date, p_source text, p_items jsonb) returns jsonb
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  days constant text[] := array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  x jsonb; v_day text; v_doc text; offered int := 0; his int := 0; taken int := 0; withdrawn int := 0; keys text[] := '{}';
  st text;
begin
  if p_source <> 'growth' or extract(isodow from p_week) <> 1 then raise exception 'invalid_offer' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended('offday-offer/' || p_week::text, 0));
  for x in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    v_day := x->>'day';
    if v_day <> all(days) then raise exception 'invalid_offer: day %', v_day using errcode = 'P0001'; end if;
    v_doc := 'queue/off-' || v_day || '-' || (x->>'option_id');
    keys := keys || (x->>'item');
    select state into st from public.offday_items where item = x->>'item';
    if found and st in ('approved', 'later') then his := his + 1; continue; end if;
    begin
      insert into public.offday_items (item, source, origin_week, option_id, option, state, week, day, date, doc, drive_folder, version, placed_by)
      values (x->>'item', 'growth', p_week, x->>'option_id', x->'option', 'offered', p_week, v_day, p_week + (array_position(days, v_day) - 1),
        v_doc, nullif(x->>'drive_folder', ''), 1, 'growth')
      on conflict (item) do update set option = excluded.option, state = 'offered', week = excluded.week, day = excluded.day,
        date = excluded.date, doc = excluded.doc, drive_folder = coalesce(excluded.drive_folder, offday_items.drive_folder),
        version = offday_items.version + 1, placed_by = 'growth', placed_at = now()
      where offday_items.state in ('offered', 'withdrawn')
        and (offday_items.option, offday_items.day, offday_items.state, offday_items.drive_folder)
          is distinct from (excluded.option, excluded.day, 'offered', coalesce(excluded.drive_folder, offday_items.drive_folder));
      offered := offered + 1;
    exception when unique_violation then
      taken := taken + 1;
    end;
  end loop;
  update public.offday_items set state = 'withdrawn', version = version + 1, placed_by = 'growth', placed_at = now()
    where source = 'growth' and origin_week = p_week and state = 'offered' and not (item = any(keys));
  get diagnostics withdrawn = row_count;
  return jsonb_build_object('ok', true, 'offered', offered, 'his', his, 'taken', taken, 'withdrawn', withdrawn);
end $$;
revoke all on function public.offday_items_offer(date, text, jsonb) from public, anon, authenticated;
grant execute on function public.offday_items_offer(date, text, jsonb) to service_role;

-- Every off-day approval that stands now gets its row, once: from today the row is where its day lives. Its option is
-- the words his approval was bound to (idea.shown), with the format and source the press carried.
do $$
declare a record;
begin
  for a in
    select w.week, ap.doc, ap.day, ap.date, ap.decided_at, ap.revision, d.body,
      substring(ap.doc from '^queue/off-[a-z]{3}-(.+)$') as option_id
    from (select distinct o.week from public.idea_outcomes o where o.via = 'offday') w
    cross join lateral public.board_approvals_now(w.week) ap
    join public.board_documents d on d.week = w.week and d.collection = 'queue' and 'queue/' || d.doc_id = ap.doc
    where ap.via = 'offday'
  loop
    continue when a.option_id is null or a.option_id !~ '^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,59}$';
    insert into public.offday_items (item, source, origin_week, option_id, option, state, week, day, date, doc, version, placed_by, placed_at, revision)
    values ('engine:' || a.week || ':' || a.option_id, 'engine', a.week, a.option_id,
      jsonb_strip_nulls(jsonb_build_object('id', a.option_id, 'format', a.body->'format', 'source', a.body->'source',
        'copy', a.body->'idea'->'shown'->'copy', 'hook', a.body->'idea'->'shown'->'hook', 'pitch', a.body->'idea'->'shown'->'pitch',
        'cards', a.body->'idea'->'shown'->'cards')),
      'approved', a.week, a.day, a.date, a.doc, 1, 'Krish', a.decided_at, a.revision)
    on conflict do nothing;
  end loop;
end $$;
