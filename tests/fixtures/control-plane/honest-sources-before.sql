-- Before 20261021080000_honest_sources.sql: live has no shift_write row, so
-- the shift card's insert fails the source foreign key. This is the failure
-- the engine's write route falls back from (apps/control-plane/api/shifts/
-- [id]/write.ts); it must be the foreign key, by name.
do $$
begin
  begin
    insert into public.content_ideas (source_type, source_ref) values ('shift_write', 'shift:synthetic');
    raise exception 'honest_sources: shift_write was accepted before its row existed';
  exception when foreign_key_violation then
    if sqlerrm not like '%content_ideas_source_type_fkey%' then
      raise exception 'honest_sources: wrong foreign key: %', sqlerrm;
    end if;
  end;
end $$;
