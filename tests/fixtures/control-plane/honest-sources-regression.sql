-- After 20261021080000_honest_sources.sql, run twice: both sources exist
-- under their owners, the control-center owner exists once, and a piece can
-- now be written under each new source.
do $$
declare
  n int;
begin
  select count(*) into n from public.intake_sources
   where (slug, owner, active) in (('shift_write', 'content-engine', true), ('pilot_build', 'control-center', true));
  if n <> 2 then
    raise exception 'honest_sources regression: expected 2 sources under their owners, found %', n;
  end if;

  select count(*) into n from public.intake_owners where slug = 'control-center';
  if n <> 1 then
    raise exception 'honest_sources regression: expected one control-center owner, found %', n;
  end if;

  insert into public.content_ideas (source_type, source_ref) values
    ('shift_write', 'shift:synthetic'),
    ('pilot_build', 'pilot:synthetic');

  -- Leave no rows behind, so the guard cases can reset the vocabulary.
  delete from public.content_ideas where source_ref in ('shift:synthetic', 'pilot:synthetic');
end $$;
