-- After 20261021100000_manual_is_his_words.sql, run twice: the CHECK is there
-- and not yet validated; a new manual row with no ref, or with a ref that is
-- not his words, is refused; a new manual row naming a said part is kept; a
-- row dated before 2026-10-13 is kept on its date; another source with no
-- ref is kept. Every row here is synthetic and removed at the end.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'content_ideas_manual_is_his_words'
       and conrelid = 'public.content_ideas'::regclass
       and not convalidated
  ) then
    raise exception 'manual_is_his_words: expected the NOT VALID check';
  end if;

  if (select count(*) from pg_constraint
       where conname = 'content_ideas_manual_is_his_words'
         and conrelid = 'public.content_ideas'::regclass) <> 1 then
    raise exception 'manual_is_his_words: expected exactly one check after two runs';
  end if;

  begin
    insert into public.content_ideas (source_type, source_ref) values ('manual', null);
    raise exception 'manual_is_his_words: a new manual row with no ref was kept';
  exception when check_violation then
    if sqlerrm not like '%content_ideas_manual_is_his_words%' then
      raise exception 'manual_is_his_words: wrong check: %', sqlerrm;
    end if;
  end;

  begin
    insert into public.content_ideas (source_type, source_ref) values ('manual', 'shift:synthetic');
    raise exception 'manual_is_his_words: a new manual row with a shift ref was kept';
  exception when check_violation then
    null;
  end;

  insert into public.content_ideas (source_type, source_ref) values
    ('manual', 'said:00000000-0000-4000-8000-000000000001'),
    ('week_research', null);
  insert into public.content_ideas (source_type, source_ref, created_at) values
    ('manual', 'synthetic-worked-example', timestamptz '2026-09-23 19:10:00+00');

  if (select count(*) from public.content_ideas
       where source_ref in ('said:00000000-0000-4000-8000-000000000001', 'synthetic-worked-example')
          or (source_type = 'week_research' and source_ref is null)) <> 3 then
    raise exception 'manual_is_his_words: expected the three allowed rows kept';
  end if;

  -- An edit to the old row is checked again, and still passes on its date.
  update public.content_ideas set source_ref = 'synthetic-worked-example-2' where source_ref = 'synthetic-worked-example';

  delete from public.content_ideas
   where source_ref in ('said:00000000-0000-4000-8000-000000000001', 'synthetic-worked-example-2')
      or (source_type = 'week_research' and source_ref is null);
end $$;
