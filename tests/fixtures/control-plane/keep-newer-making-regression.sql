-- supabase/migrations/20261012120000_keep_newer_making.sql: a stale copy of
-- meta never puts back an older making record; everything else is written.
do $$
declare
  piece uuid := gen_random_uuid();
  bare uuid := gen_random_uuid();
  m jsonb;
begin
  insert into public.content_ideas (id, meta) values (piece, jsonb_build_object(
    'cleo_chat', '[]'::jsonb,
    'making', jsonb_build_object('updated_at', '2026-10-12T11:00:00.000Z', 'recordings', '[]'::jsonb)));

  -- The making route records Krish's take while a chat waits on the model.
  update public.content_ideas set meta = jsonb_set(meta, '{making}', jsonb_build_object(
    'updated_at', '2026-10-12T11:00:30.000Z', 'recordings', jsonb_build_array(jsonb_build_object('cut', 'long', 'path', 'recordings/aaa.mov'))))
  where id = piece;

  -- The chat then writes the meta it read 40 seconds ago, with its own key.
  update public.content_ideas set meta = jsonb_build_object(
    'cleo_chat', jsonb_build_array('a reply'),
    'making', jsonb_build_object('updated_at', '2026-10-12T11:00:00.000Z', 'recordings', '[]'::jsonb))
  where id = piece;
  select meta into m from public.content_ideas where id = piece;
  if jsonb_array_length(m -> 'making' -> 'recordings') <> 1 then
    raise exception 'a stale copy put back the older making record: %', m -> 'making';
  end if;
  if m -> 'cleo_chat' <> jsonb_build_array('a reply') then
    raise exception 'the stale writer''s own key was not written: %', m -> 'cleo_chat';
  end if;

  -- A writer whose meta had no making record yet.
  update public.content_ideas set meta = jsonb_build_object('score', 7) where id = piece;
  select meta into m from public.content_ideas where id = piece;
  if m -> 'making' is null or (m ->> 'score') <> '7' then
    raise exception 'a meta with no making record dropped it, or lost its own key: %', m;
  end if;

  -- The same stamp but different contents is not newer either.
  update public.content_ideas set meta = jsonb_set(meta, '{making}', jsonb_build_object(
    'updated_at', '2026-10-12T11:00:30.000Z', 'recordings', '[]'::jsonb)) where id = piece;
  select meta into m from public.content_ideas where id = piece;
  if jsonb_array_length(m -> 'making' -> 'recordings') <> 1 then
    raise exception 'a record with the same stamp replaced the stored one';
  end if;

  -- A newer record lands.
  update public.content_ideas set meta = jsonb_set(meta, '{making}', jsonb_build_object(
    'updated_at', '2026-10-12T11:05:00.000Z', 'recordings', jsonb_build_array(
      jsonb_build_object('cut', 'long', 'path', 'recordings/aaa.mov'), jsonb_build_object('cut', 'short', 'path', 'recordings/bbb.mov'))))
  where id = piece;
  select meta into m from public.content_ideas where id = piece;
  if jsonb_array_length(m -> 'making' -> 'recordings') <> 2 then
    raise exception 'a newer making record did not land: %', m -> 'making';
  end if;

  -- A piece with no making record is written as sent.
  insert into public.content_ideas (id, meta) values (bare, '{"a": 1}'::jsonb);
  update public.content_ideas set meta = '{"b": 2}'::jsonb where id = bare;
  select meta into m from public.content_ideas where id = bare;
  if m <> '{"b": 2}'::jsonb then
    raise exception 'a piece with no making record was changed: %', m;
  end if;

  -- An update that does not touch meta is left alone.
  update public.content_ideas set state = 'published' where id = piece;
  select meta into m from public.content_ideas where id = piece;
  if jsonb_array_length(m -> 'making' -> 'recordings') <> 2 then
    raise exception 'an update of another column changed the making record';
  end if;

  delete from public.content_ideas where id in (piece, bare);
  raise notice 'keep-newer-making regression: 7 checks passed';
end
$$;
