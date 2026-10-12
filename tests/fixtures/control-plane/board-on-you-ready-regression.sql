-- supabase/migrations/20261013093000_board_on_you_is_ready.sql, applied
-- twice after board-on-you-ready-setup.sql: the ready rows stay on Krish,
-- the rest are held in progress with their reason said once, and from then
-- on no writer can put an item on him that is not ready.
do $$
declare
  r record;
  n integer;
  prefix text;
  closes text := 'does not say how it closes itself';
  press text := 'is not ready for one press';
  needs text := 'does not need you';
begin
  -- The constraint is there and validated.
  select count(*) into n from pg_constraint
    where conrelid = 'public.work_board_items'::regclass and conname = 'work_board_items_on_you_is_ready' and convalidated;
  if n <> 1 then raise exception 'work_board_items_on_you_is_ready is missing or not validated'; end if;

  -- The ready rows are untouched.
  for r in select * from public.work_board_items where id in ('monday-record', 'friday-record', 'week-2026-10-19') loop
    if r.lane <> 'on_you' or r.updated_by = 'control_center' or r.detail like 'Held from%' then
      raise exception 'a ready row was moved: % (% by %)', r.id, r.lane, r.updated_by;
    end if;
  end loop;

  -- The rest are held in progress, by control_center, with every gate each
  -- one fails said once, in Control Center's words, before what it said. The
  -- date is the New York day the migration moved the row, read from the
  -- row's own updated_at, never this session's clock: a run that straddles
  -- midnight there would otherwise expect the next day.
  select count(*) into n from public.work_board_items
    where id in ('week-publish-board-2026-10-12', 'you-launch-today', 'you-engine-github-key', 'you-welcome-days', 'take-aaaaaaaaaaaa', 'plan-week-oct-19', 'take-ffffffffffff');
  if n <> 7 then raise exception 'the setup rows are missing: % of 7', n; end if;
  for r in select b.*, w.why from public.work_board_items b join (values
      ('week-publish-board-2026-10-12', closes),
      ('you-launch-today', closes),
      ('you-engine-github-key', closes),
      ('you-welcome-days', press || ' and ' || closes),
      ('take-aaaaaaaaaaaa', needs || ', ' || press || ' and ' || closes),
      ('plan-week-oct-19', closes),
      ('take-ffffffffffff', needs)
    ) as w(id, why) on w.id = b.id loop
    if r.lane <> 'in_progress' or r.updated_by <> 'control_center' then
      raise exception 'a row that is not ready was left on him: % (% by %)', r.id, r.lane, r.updated_by;
    end if;
    prefix := 'Held from your list on ' || to_char(r.updated_at at time zone 'America/New_York', 'FMDD FMMonth') || ': it ' || r.why || '.';
    if left(r.detail, length(prefix)) <> prefix then
      raise exception 'the held row does not say why: % (expected "%", got "%")', r.id, prefix, left(r.detail, 160);
    end if;
    if (length(r.detail) - length(replace(r.detail, 'Held from your list', ''))) <> length('Held from your list') then
      raise exception 'the reason was written more than once on %', r.id;
    end if;
    if length(r.detail) > 2000 then raise exception 'the held detail is over 2,000 characters on %', r.id; end if;
    if r.id = 'you-launch-today' and r.detail <> prefix || ' Article 1 is done: checked 11 October.' then
      raise exception 'the held detail lost what it said: %', r.detail;
    end if;
    if r.id = 'you-welcome-days' and r.detail <> prefix then
      raise exception 'an empty detail gained more than the reason: "%"', r.detail;
    end if;
  end loop;

  -- Not on him: untouched.
  select count(*) into n from public.work_board_items
    where (id = 'doing-build' and lane = 'in_progress' and updated_by = 'codex') or (id = 'old-note' and lane = 'done' and updated_by = 'Krish');
  if n <> 2 then raise exception 'a row that was not on him was changed'; end if;

  -- From now on: an item put on him that is not ready is refused, by any writer.
  begin
    insert into public.work_board_items (id, lane, title, only_you, link) values ('post-901', 'on_you', 'Which piece is this post?', null, 'https://home.makeyourmindup.ai/p/x');
    raise exception 'an item with no reason and no close was put on him';
  exception when check_violation then null; end;
  begin
    update public.work_board_items set lane = 'on_you' where id = 'you-welcome-days';
    raise exception 'a held row was moved back on him without a link or a close';
  exception when check_violation then null; end;
  begin
    update public.work_board_items set link = null where id = 'monday-record';
    raise exception 'an edit stripped the link from an item on him';
  exception when check_violation then null; end;
  begin
    update public.work_board_items set closes_on = 'video', idea_id = null where id = 'friday-record';
    raise exception 'an item on him lost its piece and kept a step close';
  exception when check_violation then null; end;
  -- Each of these lacks one thing only, so the rule's own clause for it is
  -- what refuses it: a reason only he can do it, and the week's close on an
  -- item that is not the week's.
  begin
    insert into public.work_board_items (id, lane, title, only_you, link, closes_on, idea_id)
      values ('take-gggggggggggg', 'on_you', 'Which cut is this take?', null, 'https://controlcenter.krishraja.com/#/content?idea=f328382d-71b3-41a7-a221-d8615826f12e', 'record', 'f328382d-71b3-41a7-a221-d8615826f12e');
    raise exception 'an item with no reason only he can do it was put on him';
  exception when check_violation then null; end;
  begin
    update public.work_board_items set only_you = null where id = 'monday-record';
    raise exception 'an edit stripped the reason only he can do it from an item on him';
  exception when check_violation then null; end;
  begin
    update public.work_board_items set lane = 'on_you' where id = 'take-ffffffffffff';
    raise exception 'a held row with no reason only he can do it was moved back on him';
  exception when check_violation then null; end;
  begin
    insert into public.work_board_items (id, lane, title, only_you, link, closes_on)
      values ('plan-week-oct-26', 'on_you', 'Plan the week', 'judgment', 'https://controlcenter.krishraja.com/#/week', 'week_planned');
    raise exception 'the week''s close was taken on an item that is not the week''s';
  exception when check_violation then null; end;
  begin
    update public.work_board_items set lane = 'on_you' where id = 'plan-week-oct-19';
    raise exception 'a held row with the week''s close on another item was moved back on him';
  exception when check_violation then null; end;

  -- A ready write passes, an item held in progress can be edited, and one that is not on him needs nothing.
  insert into public.work_board_items (id, lane, title, only_you, link, closes_on, idea_id)
    values ('take-bbbbbbbbbbbb', 'on_you', 'Which cut is this take?', 'judgment', 'https://controlcenter.krishraja.com/#/content?idea=f328382d-71b3-41a7-a221-d8615826f12e', 'record', 'f328382d-71b3-41a7-a221-d8615826f12e');
  update public.work_board_items set detail = detail || ' Nothing can see it done yet.' where id = 'you-welcome-days';
  insert into public.work_board_items (id, lane, title) values ('post-902', 'in_progress', 'Which piece is this post?');
  update public.work_board_items set lane = 'done' where id = 'monday-record';

  -- Deleting a piece empties the idea_id of the items about it (on delete set
  -- null), so one still on him stops the delete: the purge archives it first.
  begin
    delete from public.content_ideas where id = '904658db-4df2-4537-a0ed-ebe93e081db7';
    raise exception 'a piece was deleted from under an item on him';
  exception when check_violation then null; end;
  update public.work_board_items set lane = 'archived' where id = 'friday-record';
  delete from public.content_ideas where id = '904658db-4df2-4537-a0ed-ebe93e081db7';
  select count(*) into n from public.work_board_items where id = 'friday-record' and idea_id is null and lane = 'archived';
  if n <> 1 then raise exception 'the archived item did not let go of its deleted piece'; end if;
end $$;
