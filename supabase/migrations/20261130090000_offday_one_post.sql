-- One post is one off-day item (docs/PUBLISH_BOARDS.md, "One post, one item"). Ruling (Krish, 2026-11-12): the board
-- shows exactly where everything is, and one post is one item that can never sprawl across days or go stale.
--
-- An item's key names the option id it was first offered under (engine:<week>:<option>). On 11 Nov a session moved a
-- post by copying it: it deleted Tue 17's povteach from the week's plan and wrote the same post as Thu 12's
-- agentnotsetup. His Approve on povteach (10 Nov) still stood on Tue 17, so the one post sat on two days. Here the
-- database learns what a post is (offday_post_keys, the same keys as apps/control-plane/api/board/_onePost.ts):
--
--   item:<key>       the item an option names (a re-plan that carries an item says so)
--   hook:<words>     its hook in plain lower-case words, 12 characters or more (a weekly hook keyed by its week too)
--   drive:<id>       its post folder in Drive
--   asset:<site:id>  the one public post or video it reposts (YouTube, Instagram, TikTok, X), never an article
--
-- and refuses a second item of one post on a day (offday_items_one_post): two rows offered or approved that share a
-- key cannot both stand. His Approve on the same post under another id carries the one item there instead
-- (offday_item_move now takes the option id his press was on, only for the same post), taking his approval off the day
-- it leaves in the same transaction. Nothing of his is changed or removed: board_history keeps every press,
-- idea_outcomes records the old day's approval as withdrawn, offday_moves keeps the carry.
--
-- Additive: one column, one index, two functions, one trigger, and offday_item_move replaced with the carry. Re-runnable.
-- Replayed on PGlite by tests/offday-one-post-db.mjs on every pull request.
--
-- Undo: drop trigger offday_items_one_post on offday_items; drop function offday_items_one_post();
-- restore offday_item_move from 20261129090000_offday_items.sql; drop function offday_post_keys(text, jsonb, date, text);
-- drop index offday_items_post_keys; alter table offday_items drop column post_keys.

create or replace function public.offday_post_keys(p_item text, p_option jsonb, p_week date, p_drive text)
returns text[] language sql immutable set search_path = public, pg_temp as $$
  with o as (select coalesce(p_option, '{}'::jsonb) as j),
  src as (
    select btrim(j->'source'->>'url') as u from o where jsonb_typeof(j->'source') = 'object' and jsonb_typeof(j->'source'->'url') = 'string'
  ),
  hook as (
    select btrim(regexp_replace(lower(j->>'hook'), '[^a-z0-9]+', ' ', 'g')) as w,
      (jsonb_typeof(j->'weekly') is not null and j->'weekly' not in ('false'::jsonb, '""'::jsonb, 'null'::jsonb)) as weekly
    from o where jsonb_typeof(j->'hook') = 'string'
  ),
  parts as (
    select 'item:' || p_item as k
      where p_item ~ '^(engine|growth):[0-9]{4}-[0-9]{2}-[0-9]{2}:[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,59}$'
    union
    select 'item:' || (j->>'item') from o
      where jsonb_typeof(j->'item') = 'string' and (j->>'item') ~ '^(engine|growth):[0-9]{4}-[0-9]{2}-[0-9]{2}:[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,59}$'
    union
    select case when weekly then 'hook:' || coalesce(p_week::text, '') || ':' || w else 'hook:' || w end from hook where length(w) >= 12
    union
    select 'drive:' || coalesce(
      substring(btrim(j->>'drive') from '^https://drive\.google\.com/drive/(?:u/[0-9]+/)?folders/([A-Za-z0-9_-]{20,80})'),
      case when p_drive ~ '^[A-Za-z0-9_-]{20,80}$' then p_drive end) from o
    union
    select 'asset:' || coalesce(
      'youtube:' || substring(u from '(?i)^https?://(?:www\.|m\.)?youtube\.com/(?:shorts/|watch\?(?:[^#]*&)?v=)([A-Za-z0-9_-]{6,20})'),
      'youtube:' || substring(u from '(?i)^https?://youtu\.be/([A-Za-z0-9_-]{6,20})'),
      'instagram:' || substring(u from '(?i)^https?://(?:www\.)?instagram\.com/(?:[A-Za-z0-9_.]+/)?(?:p|reel|reels|tv)/([A-Za-z0-9_-]{5,40})'),
      'tiktok:' || substring(u from '(?i)^https?://(?:www\.|m\.)?tiktok\.com/@[A-Za-z0-9_.]+/(?:video|photo)/([0-9]{5,25})'),
      'x:' || substring(u from '(?i)^https?://(?:www\.|mobile\.)?(?:x|twitter)\.com/[A-Za-z0-9_]+/status/([0-9]{5,25})')) from src
  )
  select coalesce(array_agg(k order by k collate "C"), '{}'::text[]) from parts where k is not null
$$;
revoke all on function public.offday_post_keys(text, jsonb, date, text) from public, anon, authenticated;
grant execute on function public.offday_post_keys(text, jsonb, date, text) to service_role;

alter table public.offday_items add column if not exists post_keys text[] not null default '{}'::text[];
create index if not exists offday_items_post_keys on public.offday_items using gin (post_keys);

-- One post on one day: a row offered or approved may share no key with another row offered or approved. Each key is
-- locked first, so two writers at once cannot both put the same post on a day.
create or replace function public.offday_items_one_post() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare k text; other text;
begin
  new.post_keys := public.offday_post_keys(new.item, new.option, new.origin_week, new.drive_folder);
  if new.state in ('offered', 'approved') then
    foreach k in array new.post_keys loop
      perform pg_advisory_xact_lock(hashtextextended('offday-post/' || k, 0));
    end loop;
    select o.item into other from public.offday_items o
      where o.item <> new.item and o.state in ('offered', 'approved') and o.post_keys && new.post_keys limit 1;
    if other is not null then
      raise exception 'same_post: % is the same post as %, already on a day; one post is one item, so it moves there, never a second copy', new.item, other
        using errcode = '23505',
          hint = 'His Approve on the post carries the one item (offday_item_move with the item already there and the option he approved).';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.offday_items_one_post() from public, anon, authenticated, service_role;
drop trigger if exists offday_items_one_post on public.offday_items;
create trigger offday_items_one_post before insert or update on public.offday_items
  for each row execute function public.offday_items_one_post();

-- Every row learns its keys. Two rows of one post already on days would stop here, by name: none stood when this was
-- written (read 12 Nov 2026: mcpskin, homework, shell, gitbroke, oldproof and povteach, six posts).
update public.offday_items set post_keys = public.offday_post_keys(item, option, origin_week, drive_folder)
  where post_keys is distinct from public.offday_post_keys(item, option, origin_week, drive_folder);

-- One move, in one transaction (20261129090000), now also the carry: p.option_id may name the option his Approve was on
-- when it is the same post as the item (its keys meet, or it names the item), and the row follows it there.
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
  -- One post, one item (20261130090000): a move may carry the item under the option a re-plan gave it (his Approve on
  -- that option), but only when that option is the same post; never to turn one item into another post.
  if had and v_option_id is distinct from r.option_id and not (
       coalesce(p->'option'->>'item', '') = v_item
       or public.offday_post_keys(null, p->'option', r.origin_week, null) && public.offday_post_keys(null, r.option, r.origin_week, r.drive_folder)) then
    raise exception 'not_the_same_post: % is another post than %', v_option_id, v_item using errcode = 'P0001';
  end if;
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
    update public.offday_items set state = v_state, week = v_week, day = v_day, date = v_date, option_id = coalesce(v_option_id, option_id),
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
